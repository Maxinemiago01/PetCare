import { test, expect, Page } from '@playwright/test';
import path from 'node:path';

type Document = { name: string; fields: Record<string, unknown> };
type MockState = {
  pets: Document[];
  records: Document[];
  requests: { method: string; path: string; body: any }[];
  failLoad: boolean;
  failPetSaves: number;
  failRecordDelete: boolean;
  failRefresh: boolean;
  uploads: number;
  refreshes: number;
  authCalls: number;
};
const resource = 'projects/petclinic-e4c37/databases/(default)/documents/users/demo-user';

async function mockApi(page: Page): Promise<MockState> {
  const state: MockState = {
    pets: [],
    records: [],
    requests: [],
    failLoad: false,
    failPetSaves: 0,
    failRecordDelete: false,
    failRefresh: false,
    uploads: 0,
    refreshes: 0,
    authCalls: 0,
  };
  let nextId = 1;
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  await page.route('https://identitytoolkit.googleapis.com/**', async (route) => {
    state.authCalls++;
    const request = route.request();
    const body = request.postDataJSON();
    if (request.url().includes('sendOobCode')) {
      expect(body.requestType).toBe('PASSWORD_RESET');
      await route.fulfill({ json: { email: body.email }, headers });
      return;
    }
    if (body.password === 'wrong-password') {
      await route.fulfill({
        status: 400,
        json: { error: { message: 'INVALID_LOGIN_CREDENTIALS' } },
        headers,
      });
      return;
    }
    await route.fulfill({
      json: {
        localId: 'demo-user',
        email: body.email,
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: '3600',
      },
      headers,
    });
  });
  await page.route('https://securetoken.googleapis.com/**', async (route) => {
    state.refreshes++;
    expect(route.request().postData()).toContain('grant_type=refresh_token');
    if (state.failRefresh)
      await route.fulfill({
        status: 400,
        json: { error: { message: 'INVALID_REFRESH_TOKEN' } },
        headers,
      });
    else
      await route.fulfill({
        json: {
          id_token: 'refreshed-token',
          refresh_token: 'new-refresh-token',
          expires_in: '3600',
        },
        headers,
      });
  });
  await page.route('https://firestore.googleapis.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const match = url.pathname.match(/\/users\/([^/]+)\/(pets|records)(?:\/([^/]+))?$/);
    expect(match, 'REST requests must stay inside the signed-in user path').not.toBeNull();
    expect(match![1]).toBe('demo-user');
    expect(request.headers()['authorization']).toMatch(/^Bearer (test-id-token|refreshed-token)$/);
    const collection = match![2] as 'pets' | 'records';
    const id = match![3];
    const body = method === 'POST' || method === 'PATCH' ? request.postDataJSON() : null;
    state.requests.push({ method, path: url.pathname, body });
    if (state.failLoad && method === 'GET') {
      await route.fulfill({
        status: 403,
        json: { error: { message: 'PERMISSION_DENIED' } },
        headers,
      });
      return;
    }
    if (collection === 'pets' && ['POST', 'PATCH'].includes(method) && state.failPetSaves-- > 0) {
      await route.fulfill({ status: 503, json: { error: { message: 'UNAVAILABLE' } }, headers });
      return;
    }
    if (collection === 'records' && method === 'DELETE' && state.failRecordDelete) {
      await route.fulfill({ status: 503, json: { error: { message: 'UNAVAILABLE' } }, headers });
      return;
    }
    if (method === 'GET') {
      const document = state[collection].find((document) => document.name.endsWith(`/${id}`));
      if (id)
        await route.fulfill({
          status: document ? 200 : 404,
          json: document || { error: { message: 'NOT_FOUND' } },
          headers,
        });
      else {
        const offset = Number(url.searchParams.get('pageToken') || 0);
        const limit = Number(url.searchParams.get('pageSize') || 100);
        const documents = state[collection].slice(offset, offset + limit);
        await route.fulfill({
          json: {
            documents,
            ...(offset + limit < state[collection].length
              ? { nextPageToken: String(offset + limit) }
              : {}),
          },
          headers,
        });
      }
    } else if (method === 'POST' || method === 'PATCH') {
      if (id) expect(url.searchParams.get('currentDocument.exists')).toBe('true');
      const document = { name: `${resource}/${collection}/${id || nextId++}`, fields: body.fields };
      state[collection] = [
        ...state[collection].filter((item) => item.name !== document.name),
        document,
      ];
      await route.fulfill({ json: document, headers });
    } else if (method === 'DELETE') {
      state[collection] = state[collection].filter((document) => !document.name.endsWith(`/${id}`));
      await route.fulfill({ json: {}, headers });
    } else throw new Error(`Unexpected API method: ${method}`);
  });
  await page.route('https://api.cloudinary.com/**', async (route) => {
    state.uploads++;
    expect(route.request().url()).toBe('https://api.cloudinary.com/v1_1/o8wnfkuc/image/upload');
    const body = route.request().postDataBuffer()!.toString('latin1');
    expect(body).toContain('petcare');
    expect(body).toContain('Content-Type: image/jpeg');
    expect(body).not.toContain('api_secret');
    await route.fulfill({
      json: { secure_url: 'http://127.0.0.1:8100/assets/paw.png', public_id: 'test-pet-photo' },
      headers,
    });
  });
  return state;
}

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill('student@example.com');
  await page.locator('input[name="password"]').fill('petcare123');
  await page.getByRole('button', { name: 'Open my notebook' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator('.loading-state')).not.toBeVisible();
}

function seedPet(state: MockState, id = 'sample-pet', name = 'Test pet'): void {
  state.pets.push({
    name: `${resource}/pets/${id}`,
    fields: {
      name: { stringValue: name },
      species: { stringValue: 'Cat' },
      breed: { stringValue: 'Mixed breed' },
      sex: { stringValue: 'Female' },
      birthday: { stringValue: '2023-04-01' },
      weightKg: { doubleValue: 4.5 },
      allergies: { stringValue: 'Test care note' },
      notes: { stringValue: 'Test fixture, used only by automated tests.' },
      imageUrl: { stringValue: '' },
      imagePublicId: { stringValue: '' },
      createdAt: { stringValue: '2026-01-01T00:00:00Z' },
      updatedAt: { stringValue: '2026-01-01T00:00:00Z' },
    },
  });
}

test('account validation, registration, password visibility, reset, privacy, and logout', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto('/app/pets/new');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Open my notebook' }).click();
  expect(state.authCalls).toBe(0);
  await expect(page.locator('input[name="email"]')).toBeFocused();
  await page.locator('input[name="email"]').fill('student@example.com');
  await page.locator('input[name="password"]').fill('wrong-password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.locator('input[name="password"]')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await page.getByRole('button', { name: 'Open my notebook' }).click();
  await expect(page.getByRole('alert')).toContainText('email or password is incorrect');
  await page.getByRole('button', { name: 'Forgot your password?' }).click();
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('reset link');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Forgot your password?' }).click();
  await page.getByRole('button', { name: 'Close password reset' }).click();
  await page.getByRole('link', { name: 'Privacy & terms' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy & demo terms' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to my notebook' }).click();
  await page.getByRole('link', { name: 'Create account', exact: true }).click();
  await page.locator('input[name="email"]:visible').fill('new-student@example.com');
  await page.locator('input[name="password"]:visible').fill('petcare123');
  await page.locator('input[name="confirmPassword"]').fill('different123');
  await page.getByRole('button', { name: 'Create my account' }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  await page.locator('input[name="confirmPassword"]').fill('petcare123');
  await page.getByRole('button', { name: 'Create my account' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your notebook starts with a name' }),
  ).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('petcare-session'))).not.toContain(
    'petcare123',
  );
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem('petcare-session'))).toBeNull();
  await expect(page.locator('input[name="password"]')).toHaveValue('');
});

test('pet and record CRUD, photo upload, filters, reminders, and cascading deletion', async ({
  page,
}) => {
  const state = await mockApi(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  await page.getByRole('link', { name: 'Add a pet', exact: true }).click();
  await page.locator('input[name="name"]').fill('Mochi');
  await page.locator('select[name="species"]').selectOption('Cat');
  await page.locator('input[name="breed"]').fill('Persian');
  await page.locator('input[name="birthday"]').fill('2023-04-01');
  await page.locator('input[name="weight"]').fill('4.5');
  await page.locator('textarea[name="notes"]').fill('Loves sunny windows.');
  await page.locator('input[type="file"]').setInputFiles(path.resolve('public/assets/paw.png'));
  await expect(page.getByAltText('Pet profile preview')).toBeVisible();
  await page.getByRole('button', { name: 'Save pet profile' }).click();
  await expect(page.getByRole('heading', { name: 'Mochi.', exact: true })).toBeVisible();
  expect(state.uploads).toBe(1);
  expect(state.pets[0].fields['imagePublicId']).toEqual({ stringValue: 'test-pet-photo' });
  await page.getByRole('link', { name: 'Edit profile' }).click();
  await page.locator('input[name="name"]').fill('Mochi Bean');
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Mochi Bean.', exact: true })).toBeVisible();

  for (const [category, title] of [
    ['vaccination', 'Rabies'],
    ['medical', 'Annual checkup'],
    ['health', 'Weight check'],
  ]) {
    await page.getByRole('button', { name: 'Add a record', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('select[name="category"]').selectOption(category);
    await dialog.locator('input[name="title"]').fill(title);
    await dialog.locator('input[name="date"]').fill('2026-01-01');
    if (category === 'vaccination')
      await dialog.locator('input[name="nextDate"]').fill('2026-01-02');
    if (category === 'health') await dialog.locator('input[name="weightKg"]').fill('4.75');
    await dialog.getByRole('button', { name: 'Save record' }).click();
    await expect(dialog).not.toBeVisible();
  }
  await expect(page.locator('.record-card')).toHaveCount(3);
  await page.getByRole('button', { name: /^Health notes/ }).click();
  await expect(page.locator('.record-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit Weight check', exact: true }).click();
  await page.getByRole('dialog').locator('input[name="title"]').fill('Updated weight');
  await page.getByRole('dialog').getByRole('button', { name: 'Save record' }).click();
  await expect(page.getByRole('heading', { name: 'Updated weight' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Updated weight', exact: true }).click();
  await page.getByRole('button', { name: 'Keep it' }).click();
  await page.getByRole('button', { name: 'Delete Updated weight', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, remove' }).click();
  await expect(page.locator('.record-card')).toHaveCount(0);
  await page.getByRole('button', { name: /^Vaccinations/ }).click();
  await expect(page.locator('.record-card')).toHaveCount(1);
  await page.getByRole('button', { name: /^Medical history/ }).click();
  await expect(page.locator('.record-card')).toHaveCount(1);
  await page.getByRole('button', { name: /^All records/ }).click();
  await expect(page.locator('.record-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Add a record', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();

  await page.getByRole('link', { name: 'Back to my pets', exact: true }).click();
  await page.locator('.reminder-mini').click();
  await expect(page.getByRole('heading', { name: 'Mochi Bean.', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Care reminders', exact: true }).click();
  await expect(page.getByText('Overdue', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark done' }).click();
  await expect(
    page.getByRole('heading', { name: 'Nothing on the calendar just yet' }),
  ).toBeVisible();
  expect(state.records).toHaveLength(2);
  await page.getByRole('link', { name: 'Back to my pets' }).click();
  await page.getByRole('button', { name: 'Dogs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No little friends found' })).toBeVisible();
  await page.getByRole('button', { name: 'Cats', exact: true }).click();
  await expect(page.locator('.pet-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Other pets', exact: true }).click();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('searchbox').fill('does-not-exist');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.locator('.pet-card').click();
  await page.getByRole('button', { name: 'Delete pet profile', exact: true }).click();
  await page.getByRole('button', { name: 'Keep it' }).click();
  await page.getByRole('button', { name: 'Delete pet profile', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, remove' }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(state.pets).toHaveLength(0);
  expect(state.records).toHaveLength(0);
  expect(state.requests.some((request) => request.method === 'PATCH')).toBeTruthy();
  expect(errors).toEqual([]);
});

test('failed saves keep form data and do not upload the same photo twice on retry', async ({
  page,
}) => {
  const state = await mockApi(page);
  await login(page);
  await page.getByRole('link', { name: 'Add my first pet', exact: true }).click();
  await page.locator('input[name="name"]').fill('Retry pet');
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'invalid.gif', mimeType: 'image/gif', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert')).toContainText('JPG, PNG, or WebP');
  await page.locator('input[type="file"]').setInputFiles(path.resolve('public/assets/paw.png'));
  await expect(page.getByAltText('Pet profile preview')).toBeVisible();
  state.failPetSaves = 1;
  await page.getByRole('button', { name: 'Save pet profile' }).click();
  await expect(page.getByRole('alert')).toContainText('could not save or load');
  await expect(page.locator('input[name="name"]')).toHaveValue('Retry pet');
  await page.getByRole('button', { name: 'Save pet profile' }).click();
  await expect(page.getByRole('heading', { name: 'Retry pet.', exact: true })).toBeVisible();
  expect(state.uploads).toBe(1);
});

test('a failed record deletion leaves its pet profile available for retry', async ({ page }) => {
  const state = await mockApi(page);
  seedPet(state);
  state.records.push({
    name: `${resource}/records/care-1`,
    fields: {
      petId: { stringValue: 'sample-pet' },
      category: { stringValue: 'medical' },
      title: { stringValue: 'Test visit' },
      date: { stringValue: '2026-01-01' },
      nextDate: { stringValue: '' },
      veterinarian: { stringValue: '' },
      weightKg: { nullValue: null },
      notes: { stringValue: '' },
      createdAt: { stringValue: '2026-01-01T00:00:00Z' },
    },
  });
  await login(page);
  await page.locator('.pet-card').click();
  state.failRecordDelete = true;
  await page.getByRole('button', { name: 'Delete pet profile', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, remove' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(state.pets).toHaveLength(1);
  expect(state.records).toHaveLength(1);
  state.failRecordDelete = false;
  await page.getByRole('button', { name: 'Delete pet profile', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, remove' }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(state.pets).toHaveLength(0);
});

test('secondary navigation, dialog close controls, and mobile logout work', async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.locator('.sidebar .brand').click();
  await page.locator('.desktop-nav').getByRole('link', { name: 'My pets', exact: true }).click();
  await page.locator('.notebook-summary a').click();
  await expect(page.getByRole('heading', { name: 'Care reminders.' })).toBeVisible();
  await page.getByRole('link', { name: 'Open my pets’ notebooks' }).click();
  await page.getByRole('link', { name: 'View care reminders' }).click();
  await page.getByRole('link', { name: 'Back to my pets' }).click();
  await page.locator('.workspace-footer').getByRole('link', { name: 'Privacy & terms' }).click();
  await page.locator('.privacy-page .brand').click();
  await page.locator('.sidebar-privacy').click();
  await page.getByRole('link', { name: 'Back to my notebook' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.mobile-brand').click();
  await page.locator('.mobile-nav').getByRole('link', { name: 'My pets', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Forgot your password?' }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('app-auth:not(.ion-page-hidden) .brand').click();
});

test('permission errors offer a working retry and loading/empty states', async ({ page }) => {
  const state = await mockApi(page);
  state.failLoad = true;
  await login(page);
  await expect(page.getByRole('alert')).toContainText('Access was denied');
  state.failLoad = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your notebook starts with a name' }),
  ).toBeVisible();
});

test('expired sessions refresh once for concurrent REST reads and invalid refresh returns to login', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'petcare-session',
      JSON.stringify({
        uid: 'demo-user',
        email: 'student@example.com',
        idToken: 'test-id-token',
        refreshToken: 'old-token',
        expiresAt: 1,
      }),
    ),
  );
  await page.goto('/app');
  await expect(
    page.getByRole('heading', { name: 'Your notebook starts with a name' }),
  ).toBeVisible();
  expect(state.refreshes).toBe(1);
  state.failRefresh = true;
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Open my notebook' })).toBeVisible();
});

test('pagination loads every pet instead of stopping at the first Firestore page', async ({
  page,
}) => {
  const state = await mockApi(page);
  for (let index = 0; index < 101; index++) seedPet(state, `pet-${index}`, `Test pet ${index}`);
  await login(page);
  await expect(page.locator('.pet-card')).toHaveCount(101);
});

test('responsive pages, native dialog focus, and desktop/mobile screenshots', async ({ page }) => {
  const state = await mockApi(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.screenshot({ path: 'docs/screenshots/login-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/screenshots/login-mobile.png', fullPage: true });
  seedPet(state);
  await login(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/app', '/app/pets/new', '/app/pets/sample-pet', '/app/reminders']) {
      await page.goto(route);
      await expect(page.locator('.loading-state')).not.toBeVisible();
      const overflows = await page.evaluate(() => {
        const scroll = document
          .querySelector('ion-content')
          ?.shadowRoot?.querySelector('.inner-scroll');
        return {
          body: document.documentElement.scrollWidth > innerWidth + 1,
          content: !!scroll && scroll.scrollWidth > scroll.clientWidth + 1,
        };
      });
      expect(overflows, `${route} at ${width}px`).toEqual({ body: false, content: false });
    }
    await page.goto('/app/pets/sample-pet');
    await page.getByRole('button', { name: 'Add a record', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate((element) => element.contains(document.activeElement)),
    ).toBeTruthy();
    expect(
      await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBeTruthy();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/app');
  await expect(page.locator('.pet-card')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/notebook-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/screenshots/notebook-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Add pet', exact: true }).click();
  await expect(page.locator('input[name="name"]')).toBeVisible();
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await page.getByRole('link', { name: 'Reminders', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Care reminders.' })).toBeVisible();
  expect(errors).toEqual([]);
});
