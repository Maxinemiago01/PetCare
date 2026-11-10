# Petcare

A beginner-friendly Ionic Angular standalone app with Supabase for accounts, pet records, and private photos. The app uses Angular `HttpClient` and REST requests.

## Run

Dependencies are already installed in this workspace.

```powershell
npm install
ionic serve
```

Keep the terminal open while using the app. Open the URL printed by Ionic; if port 8100 is occupied, Ionic can choose 8101.

You can also use `npm start` at http://127.0.0.1:8100.

```powershell
npm run build
npm test
```

The production app goes into `www/`. Browser tests use Chrome at its standard Windows location. On another computer, install the test browser once with `npx playwright install chromium`.

This project uses Ionic 9 and Angular 20. All app components are standalone.

## Supabase project

Project: **PetCare**

Project URL: https://hykutdgbuycbfquefice.supabase.co

The URL, publishable key, and bucket name are in `src/environments/environment.ts`. The publishable key is intended for client apps. Never put a database password, secret key, or service-role key in the frontend.

The app starts fresh in Supabase. Existing Firebase accounts, records, and Cloudinary photos are not imported or deleted. Create a Supabase account to use this version.

## Database setup

The complete database setup is in `supabase/setup.sql`. It creates:

- `pets`: profiles belonging to a signed-in account.
- `pet_records`: vaccinations, medical visits, and health notes.
- `pet-photos`: a private storage bucket.
- Row-level security policies for owner-only access.
- A foreign key that deletes a pet's records automatically when its profile is deleted.

If creating another project, run the script in that project's SQL Editor, then update the environment file. Running the app does not create tables automatically.

The quoted SQL names, such as `"petId"` and `"weightKg"`, match the existing TypeScript models. This keeps the API responses usable directly without another data-conversion layer.

## Authentication setup

Email/password sign-in is enabled. Under **Authentication > Sign In / Providers > Email**, turn **Confirm email** OFF. This was verified on the supplied project.

Users can register with a made-up address such as `alex@petcare.test` and a password of at least six characters. The address is their login ID and must still use email format. Registration signs them in immediately.

The app checks the confirmation setting before registering. If confirmation is turned on again, it shows a setup message instead of requesting an email.

There are no verification or password-reset emails in this demo. Remember the login ID and password. Existing Auth redirect URLs can remain configured, but this version does not use email callbacks.

## Simple code structure

```text
src/app/
  models.ts                 Pet and care-record interfaces
  app.routes.ts             Routes
  auth.guard.ts             Sign-in protection
  services/
    auth.service.ts         Signup, login, logout, token refresh
    pet.service.ts          GET, POST, PATCH, DELETE for plain JSON records
    image.service.ts        Prepare and upload photos; request temporary links
    errors.ts               Readable error messages
  pages/
    auth/                   Login and registration
    shell/                  Shared navigation
    home/                   Pet list, search, and species filters
    pet-form/               Add and edit profiles
    pet-detail/             Pet details and care records
    reminders/              Due dates and reminder completion
    privacy/                Demo privacy information
src/environments/
  environment.ts            Supabase public configuration
supabase/
  setup.sql                 Tables, access policies, private photo bucket
tests/
  petcare.spec.ts            Browser tests with simulated Supabase APIs
```

Forms use `ngModel`, and service methods use straightforward `async/await`. `firstValueFrom` makes an Angular HTTP request awaitable.

`PetService` sends and receives ordinary objects. For example, a profile contains `name`, `species`, and `imagePath`. A care record contains `petId`, `category`, `title`, `date`, and `nextDate`.

## REST calls

All endpoints start with the project's URL.

| Action                      | Request                                                    |
| --------------------------- | ---------------------------------------------------------- |
| Register                    | `POST /auth/v1/signup`                                     |
| Login                       | `POST /auth/v1/token?grant_type=password`                  |
| Refresh session             | `POST /auth/v1/token?grant_type=refresh_token`             |
| Log out                     | `POST /auth/v1/logout?scope=local`                         |
| List pets                   | `GET /rest/v1/pets`                                        |
| Get one pet                 | `GET /rest/v1/pets?id=eq.PET_ID`                           |
| Create pet                  | `POST /rest/v1/pets`                                       |
| Edit pet                    | `PATCH /rest/v1/pets?id=eq.PET_ID`                         |
| Delete pet                  | `DELETE /rest/v1/pets?id=eq.PET_ID`                        |
| Care records                | The same methods on `/rest/v1/pet_records`                 |
| Upload photo                | `POST /storage/v1/object/pet-photos/USER_ID/FILE.jpg`      |
| Create temporary photo link | `POST /storage/v1/object/sign/pet-photos/USER_ID/FILE.jpg` |

Requests identify the app using an `apikey` header. Protected requests also identify the user using `Authorization: Bearer <access token>`. The publishable key is not used as a bearer token.

List filters improve the request, but database row-level security is what enforces ownership. Clients cannot access another owner's records simply by changing the URL.

## Photos

The app accepts JPG, PNG, and WebP files up to 10 MB. Before upload, it converts the image to JPEG, limits the longest dimension to 800 pixels, and uses 82% quality. The storage bucket independently limits uploads to 2 MB and JPEG content.

Files are stored at `USER_ID/RANDOM_ID.jpg`. Only `imagePath` is saved in the pet table. The app gets a temporary photo URL valid for one hour when loading profiles. Anyone holding that URL can view the image until it expires, so avoid sharing it.

If upload succeeds but saving the profile fails, the form keeps the uploaded path and preview. Retrying does not upload the same selected image again.

For this simple demo, removing or replacing a profile photo does not delete its old file from storage. Old files stay private and still count toward storage usage. The project owner can clean up unused files in the Supabase Storage dashboard.

## Other behavior

- Deleting a pet and its care records is one database transaction.
- Marking a reminder done clears its next due date and keeps the original care record.
- Reminders are displayed inside the app; there are no scheduled email or push reminders.
- Session tokens are kept in the browser's session storage. Passwords are not stored by the app.
- Firebase sessions are not reused for Supabase.

## Verification

`npm test` simulates Supabase responses and checks authentication, CRUD, private-photo requests, retries, pagination, and responsive screens. It does not send emails or upload files to the live account. See `docs/verification.md` for the latest results and live verification scope.

## Android download

The Android build workflow is `.github/workflows/android.yml`. It builds a signed demo APK and publishes it with a download QR to GitHub Releases. See [Android setup and download](docs/android.md).

```powershell
npm run android:sync
npm run android:qr
```

## References

- [Supabase REST API](https://supabase.com/docs/guides/api)
- [API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
