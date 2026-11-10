import { test, expect, Page } from '@playwright/test';
import path from 'node:path';
import type { LocalNotificationSchema } from '@capacitor/local-notifications';

type Document = { id: string; owner_id: string; [key: string]: any };
type MockState = {
  pets: Document[];
  records: Document[];
  requests: { method: string; path: string; body: any }[];
  failLoad: boolean;
  failMissingTables: boolean;
  failPetSaves: number;
  failPetDelete: boolean;
  failRefresh: boolean;
  failUploads: boolean;
  confirmationRequired: boolean;
  uploads: number;
  refreshes: number;
  authCalls: number;
  signups: number;
};
const supabaseUrl = 'https://hykutdgbuycbfquefice.supabase.co';
const publishableKey = 'sb_publishable_iiPy0P0yJLhkWmRW1WUnyQ_rm4SWe83';

async function mockApi(page: Page): Promise<MockState> {
  const state: MockState = {
    pets: [],
    records: [],
    requests: [],
    failLoad: false,
    failMissingTables: false,
    failPetSaves: 0,
    failPetDelete: false,
    failRefresh: false,
    failUploads: false,
    confirmationRequired: false,
    uploads: 0,
    refreshes: 0,
    authCalls: 0,
    signups: 0,
  };
  let nextId = 1;
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  };
  const session = (email = 'student@example.com', token = 'test-access-token') => ({
    access_token: token,
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    user: { id: 'demo-user', email },
  });
  await page.route(supabaseUrl + '/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (method === 'GET' && url.pathname.startsWith('/storage/v1/object/sign/')) {
      expect(url.searchParams.get('token')).toBe('test-signature');
      await route.fulfill({
        path: path.resolve('public/assets/paw.png'),
        contentType: 'image/png',
        headers,
      });
      return;
    }
    expect(request.headers()['apikey']).toBe(publishableKey);
    if (url.pathname.startsWith('/auth/v1/')) {
      state.authCalls++;
      const body = request.postData() ? request.postDataJSON() : {};
      if (url.pathname.endsWith('/settings')) {
        await route.fulfill({ json: { mailer_autoconfirm: !state.confirmationRequired }, headers });
        return;
      }
      if (url.pathname.endsWith('/logout')) {
        await route.fulfill({ status: 204, headers });
        return;
      }
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        state.refreshes++;
        expect(body.refresh_token).toBeTruthy();
        if (state.failRefresh)
          await route.fulfill({
            status: 400,
            json: { error_code: 'refresh_token_not_found' },
            headers,
          });
        else
          await route.fulfill({ json: session('student@example.com', 'refreshed-token'), headers });
        return;
      }
      if (body.password === 'wrong-password') {
        await route.fulfill({ status: 400, json: { error_code: 'invalid_credentials' }, headers });
        return;
      }
      expect(['/auth/v1/token', '/auth/v1/signup']).toContain(url.pathname);
      if (url.pathname.endsWith('/signup')) {
        expect(state.confirmationRequired).toBe(false);
        state.signups++;
      }
      await route.fulfill({ json: session(body.email), headers });
      return;
    }
    expect(request.headers()['authorization']).toMatch(
      /^Bearer (test-access-token|refreshed-token)$/,
    );
    if (url.pathname.startsWith('/storage/v1/')) {
      if (url.pathname.startsWith('/storage/v1/object/sign/pet-photos/')) {
        expect(request.postDataJSON()).toEqual({ expiresIn: 3600 });
        expect(url.pathname).toContain('/demo-user/');
        if (url.pathname.endsWith('/missing.jpg')) {
          await route.fulfill({
            status: 400,
            json: { statusCode: '404', message: 'Object not found' },
            headers,
          });
          return;
        }
        await route.fulfill({
          json: { signedURL: url.pathname.replace('/storage/v1', '') + '?token=test-signature' },
          headers,
        });
        return;
      }
      expect(url.pathname).toMatch(
        /^\/storage\/v1\/object\/pet-photos\/demo-user\/[a-f0-9-]+\.jpg$/,
      );
      expect(request.headers()['content-type']).toBe('image/jpeg');
      expect(request.headers()['x-upsert']).toBe('false');
      expect(request.postDataBuffer()!.subarray(0, 3)).toEqual(Buffer.from([255, 216, 255]));
      state.uploads++;
      if (state.failUploads) await route.fulfill({ status: 403, json: { code: '42501' }, headers });
      else await route.fulfill({ json: { Key: url.pathname.split('/object/')[1] }, headers });
      return;
    }
    const collection = url.pathname.endsWith('/pet_records') ? 'records' : 'pets';
    expect(['/rest/v1/pets', '/rest/v1/pet_records']).toContain(url.pathname);
    const id = url.searchParams.get('id')?.slice(3);
    const body = ['POST', 'PATCH'].includes(method) ? request.postDataJSON() : null;
    state.requests.push({ method, path: url.pathname, body });
    if (state.failMissingTables) {
      await route.fulfill({ status: 404, json: { code: 'PGRST205' }, headers });
      return;
    }
    if (state.failLoad && method === 'GET') {
      await route.fulfill({ status: 403, json: { code: '42501' }, headers });
      return;
    }
    if (collection === 'pets' && ['POST', 'PATCH'].includes(method) && state.failPetSaves > 0) {
      state.failPetSaves--;
      await route.fulfill({ status: 503, json: { message: 'Service unavailable' }, headers });
      return;
    }
    if (collection === 'pets' && method === 'DELETE' && state.failPetDelete) {
      await route.fulfill({ status: 503, json: { message: 'Service unavailable' }, headers });
      return;
    }
    if (method === 'GET') {
      if (!id) expect(url.searchParams.get('owner_id')).toBe('eq.demo-user');
      let documents = state[collection].filter((item) => !id || item.id === id);
      const petId = url.searchParams.get('petId')?.slice(3);
      if (petId) documents = documents.filter((item) => item.petId === petId);
      documents = [...documents].sort((a, b) =>
        collection === 'pets' ? a.name.localeCompare(b.name) : b.date.localeCompare(a.date),
      );
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = Number(url.searchParams.get('limit') || 100);
      await route.fulfill({ json: documents.slice(offset, offset + limit), headers });
    } else if (method === 'POST' || method === 'PATCH') {
      expect(request.headers()['prefer']).toBe('return=representation');
      expect(body.owner_id).toBe('demo-user');
      expect(body.fields).toBeUndefined();
      expect(body.imageUrl).toBeUndefined();
      const document = { ...body, id: id || 'item-' + nextId++ };
      state[collection] = [
        ...state[collection].filter((item) => item.id !== document.id),
        document,
      ];
      await route.fulfill({ json: [document], headers });
    } else if (method === 'DELETE') {
      const deleted = state[collection].filter((item) => item.id === id);
      state[collection] = state[collection].filter((item) => item.id !== id);
      if (collection === 'pets') state.records = state.records.filter((item) => item.petId !== id);
      await route.fulfill({ json: deleted, headers });
    } else throw new Error('Unexpected API method: ' + method);
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
    id,
    owner_id: 'demo-user',
    name,
    species: 'Cat',
    breed: 'Mixed breed',
    sex: 'Female',
    birthday: '2023-04-01',
    weightKg: 4.5,
    allergies: 'Test care note',
    notes: 'Test fixture, used only by automated tests.',
    imagePath: '',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });
}

test('account validation, fake-email registration, password visibility, privacy, and logout', async ({
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
  await expect(page.getByRole('button', { name: 'Forgot your password?' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Privacy & terms' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy & demo terms' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to my notebook' }).click();
  await page.getByRole('link', { name: 'Create account', exact: true }).click();
  await page.locator('input[name="email"]:visible').fill('alex@petcare.test');
  await page.locator('input[name="password"]:visible').fill('petcare123');
  await page.locator('input[name="confirmPassword"]').fill('different123');
  await page.getByRole('button', { name: 'Create my account' }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  await page.locator('input[name="confirmPassword"]').fill('petcare123');
  await page.getByRole('button', { name: 'Create my account' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your notebook starts with a name' }),
  ).toBeVisible();
  expect(state.signups).toBe(1);
  expect(
    await page.evaluate(() => sessionStorage.getItem('petcare-supabase-session')),
  ).not.toContain('petcare123');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem('petcare-supabase-session'))).toBeNull();
  await expect(page.locator('input[name="password"]')).toHaveValue('');
});

test('pet and record CRUD, photo upload, filters, reminders, and cascading deletion', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-01-02T12:00:00+08:00'));
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
  expect(state.pets[0].imagePath).toMatch(/^demo-user\/[a-f0-9-]+\.jpg$/);
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

  await page.clock.setFixedTime(new Date('2026-01-03T12:00:00+08:00'));
  await page.getByRole('link', { name: 'Care reminders', exact: true }).click();
  await expect(page.getByText('Overdue', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'For Mochi Bean' }).click();
  await page.getByRole('button', { name: 'Edit Rabies', exact: true }).click();
  const overdueForm = page.getByRole('dialog');
  await overdueForm.locator('input[name="title"]').fill('Rabies vaccination');
  await overdueForm.getByRole('button', { name: 'Save record' }).click();
  await expect(overdueForm).not.toBeVisible();
  expect(state.records.find((item) => item.title === 'Rabies vaccination')?.nextDate).toBe(
    '2026-01-02',
  );
  await page.getByRole('link', { name: 'Care reminders', exact: true }).click();
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

test('Android care alerts schedule both dates, replace edits, and cancel completed reminders', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-04-30T12:00:00+08:00'));
  const state = await mockApi(page);
  seedPet(state);
  state.records.push({
    id: 'booster',
    owner_id: 'demo-user',
    petId: 'sample-pet',
    category: 'vaccination',
    title: 'Vaccine booster',
    date: '2026-04-29',
    nextDate: '2026-05-02',
    veterinarian: '',
    notes: '',
    weightKg: null,
    createdAt: '2026-04-29T00:00:00Z',
  });

  await page.addInitScript(() => {
    let granted = false;
    const methods = {
      getPending: () => ({
        notifications: JSON.parse(localStorage.getItem('test-alarms') || '[]'),
      }),
      checkPermissions: () => ({ display: granted ? 'granted' : 'prompt' }),
      requestPermissions: () => {
        granted = true;
        return { display: 'granted' };
      },
      createChannel: (channel: object) =>
        localStorage.setItem('test-channel', JSON.stringify(channel)),
      schedule: ({ notifications }: { notifications: LocalNotificationSchema[] }) => {
        const scheduled = methods.getPending().notifications;
        localStorage.setItem('test-alarms', JSON.stringify([...scheduled, ...notifications]));
        return { notifications };
      },
      cancel: ({ notifications }: { notifications: { id: number }[] }) => {
        const ids = new Set(notifications.map((item) => item.id));
        const remaining = methods
          .getPending()
          .notifications.filter((item: { id: number }) => !ids.has(item.id));
        localStorage.setItem('test-alarms', JSON.stringify(remaining));
      },
      removeDeliveredNotificationsById: () => undefined,
      cancelAll: () => localStorage.removeItem('test-alarms'),
      removeAllDeliveredNotifications: () => undefined,
    };
    Object.assign(window, {
      androidBridge: {},
      Capacitor: {
        PluginHeaders: [
          {
            name: 'LocalNotifications',
            methods: Object.keys(methods).map((name) => ({ name, rtype: 'promise' })),
          },
        ],
        nativePromise: async (_: string, method: keyof typeof methods, options: never) =>
          methods[method](options),
      },
    });
  });

  const scheduledTimes = () =>
    page.evaluate(() =>
      (JSON.parse(localStorage.getItem('test-alarms') || '[]') as LocalNotificationSchema[])
        .map((item) => item.schedule?.at)
        .sort(),
    );
  await login(page);
  await expect
    .poll(scheduledTimes)
    .toEqual(['2026-05-01T01:00:00.000Z', '2026-05-02T01:00:00.000Z']);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('test-channel')!).vibration),
  ).toBe(true);

  // A new Android WebView loses sessionStorage but retains the device's app storage.
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.locator('.pet-card')).toBeVisible();
  expect(state.authCalls).toBe(1);

  await page.locator('.pet-card').click();
  await page.getByRole('button', { name: 'Edit Vaccine booster', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const dueDate = dialog.locator('input[name="nextDate"]');
  await expect(dueDate).toHaveAttribute('min', '2026-04-30');
  await dueDate.fill('2026-04-29');
  await dialog.locator('form').dispatchEvent('submit');
  await expect(dialog.getByRole('alert')).toHaveText(
    'Choose today or a future date for the next reminder.',
  );
  expect(state.records[0].nextDate).toBe('2026-05-02');
  await dueDate.fill('2026-05-01');
  await dialog.getByRole('button', { name: 'Save record' }).click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(scheduledTimes)
    .toEqual(['2026-04-30T01:00:00.000Z', '2026-05-01T01:00:00.000Z']);

  await page.getByRole('link', { name: 'Care reminders', exact: true }).click();
  await page.getByRole('button', { name: 'Mark done' }).click();
  await expect(
    page.getByRole('heading', { name: 'Nothing on the calendar just yet' }),
  ).toBeVisible();
  expect(await scheduledTimes()).toEqual([]);
  expect(state.records[0].nextDate).toBe('');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('petcare-supabase-session'))).toBeNull();
});

test('failed saves keep form data and do not upload the same photo twice on retry', async ({
  page,
}) => {
  const state = await mockApi(page);
  await login(page);
  await page.getByRole('link', { name: 'Add a pet', exact: true }).click();
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

test('a failed pet deletion preserves the profile and its records for retry', async ({ page }) => {
  const state = await mockApi(page);
  seedPet(state);
  state.records.push({
    id: 'care-1',
    owner_id: 'demo-user',
    petId: 'sample-pet',
    category: 'medical',
    title: 'Test visit',
    date: '2026-01-01',
    nextDate: '',
    veterinarian: '',
    weightKg: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00Z',
  });
  await login(page);
  await page.locator('.pet-card').click();
  state.failPetDelete = true;
  await page.getByRole('button', { name: 'Delete pet profile', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, remove' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(state.pets).toHaveLength(1);
  expect(state.records).toHaveLength(1);
  state.failPetDelete = false;
  await page.getByRole('button', { name: 'Delete pet profile', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, remove' }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(state.pets).toHaveLength(0);
  expect(state.records).toHaveLength(0);
});

test('secondary navigation and mobile logout work', async ({ page }) => {
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
  await page.locator('app-auth:not(.ion-page-hidden) .brand').click();
});

test('permission errors offer a working retry and loading/empty states', async ({ page }) => {
  const state = await mockApi(page);
  state.failLoad = true;
  await login(page);
  await expect(page.getByRole('alert')).toContainText('You do not have permission');
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
      'petcare-supabase-session',
      JSON.stringify({
        uid: 'demo-user',
        email: 'student@example.com',
        accessToken: 'test-access-token',
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

test('pagination loads every pet instead of stopping at the first REST page', async ({ page }) => {
  const state = await mockApi(page);
  for (let index = 0; index < 101; index++) seedPet(state, `pet-${index}`, `Test pet ${index}`);
  await login(page);
  await expect(page.locator('.pet-card')).toHaveCount(101);
});

test('responsive pages, native dialog focus, and desktop/mobile screenshots', async ({ page }) => {
  test.setTimeout(120000);
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

test('confirmation-enabled configuration blocks signup before any email can be requested', async ({
  page,
}) => {
  const state = await mockApi(page);
  state.confirmationRequired = true;
  await page.goto('/register');
  await page.locator('input[name="email"]').fill('alex@petcare.test');
  await page.locator('input[name="password"]').fill('petcare123');
  await page.locator('input[name="confirmPassword"]').fill('petcare123');
  await page.getByRole('button', { name: 'Create my account' }).click();
  await expect(page.getByRole('alert')).toContainText('Turn off Confirm email');
  expect(state.signups).toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem('petcare-supabase-session'))).toBeNull();
});

test('a missing private photo does not prevent opening pet records', async ({ page }) => {
  const state = await mockApi(page);
  seedPet(state);
  state.pets[0].imagePath = 'demo-user/missing.jpg';
  await login(page);
  await expect(page.locator('.pet-card')).toBeVisible();
  await page.locator('.pet-card').click();
  await expect(page.getByRole('heading', { name: 'Test pet.', exact: true })).toBeVisible();
  await expect(page.locator('.profile-avatar img')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add a record', exact: true })).toBeVisible();
});

test('missing schema and private-photo upload errors allow a useful retry', async ({ page }) => {
  const state = await mockApi(page);
  state.failMissingTables = true;
  await login(page);
  await expect(page.getByRole('alert')).toContainText('database has not been set up');
  state.failMissingTables = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByRole('link', { name: 'Add a pet', exact: true }).click();
  await page.locator('input[name="name"]').fill('Photo retry');
  await page.locator('input[type="file"]').setInputFiles(path.resolve('public/assets/paw.png'));
  await expect(page.getByAltText('Pet profile preview')).toBeVisible();
  state.failUploads = true;
  await page.getByRole('button', { name: 'Save pet profile' }).click();
  await expect(page.getByRole('alert')).toContainText('permission');
  expect(state.pets).toHaveLength(0);
  state.failUploads = false;
  await page.getByRole('button', { name: 'Save pet profile' }).click();
  await expect(page.getByRole('heading', { name: 'Photo retry.', exact: true })).toBeVisible();
  await expect(page.getByAltText('Photo retry', { exact: true })).toBeVisible();
});
