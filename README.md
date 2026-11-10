# Petcare

A beginner-friendly Ionic Angular standalone app: a digital notebook for your pets. All authentication, database, and photo-upload requests use Angular `HttpClient` and REST endpoints. There is no Firebase SDK or separate backend server.

## Run the app

Use Node.js 22.12+ or 24 and npm. Dependencies have already been installed in this workspace.

```powershell
npm install
ionic serve
```

If you do not have the Ionic CLI installed, `npm start` also serves the same app at http://127.0.0.1:8100. To install the CLI globally, run `npm install -g @ionic/cli`.

```powershell
npm run build
npm test
```

The production build is written to `www/`. Tests use Chrome when installed at its usual Windows location; on another computer, run `npx playwright install chromium` once before `npm test`.

This project uses Ionic 9 and Angular 20. In Ionic 9, standalone components are imported from `@ionic/angular` directly. The components in this app are all standalone; there is no `AppModule`.

## One-time Firebase setup

Your project ID and web API key are already configured in `src/environments/environment.ts`.

Authentication, Firestore CRUD, and owner-only access have now been verified with live REST requests for this project. The steps below are retained as setup instructions for reuse.

1. Open [Firebase Authentication](https://console.firebase.google.com/project/petclinic-e4c37/authentication/providers). Enable **Email/Password** under sign-in providers.
2. Open [Cloud Firestore](https://console.firebase.google.com/project/petclinic-e4c37/firestore). Create the default **Standard edition** database if it does not exist. Choose an available location suitable for your project. Firebase Storage is not used.
3. Open the Firestore **Rules** tab. Copy the contents of `firestore.rules` and click **Publish**. These rules let a signed-in user access only the data under their own Firebase user ID. Do not leave the database open in test mode.
4. Start the app, create an account, and add your first pet.

The configuration identifies the Firebase project; it does not enable authentication, create the database, or publish rules automatically. These console changes require access to your Firebase account.

## Cloudinary setup

Your supplied settings are already in `src/environments/environment.ts`:

```text
Cloud name: o8wnfkuc
Upload preset: petcare
```

In Cloudinary Console, open Settings > Upload > Upload presets. Verify that `petcare` exists and its signing mode is **Unsigned**. Restrict allowed formats to JPG, JPEG, PNG, and WebP. You can also enable `disallow_public_id` and normalize dimensions with an incoming transformation.

The app rejects selected files larger than 10 MB and converts accepted images to JPEG with a maximum dimension of 800 pixels before upload. Cloudinary upload presets do not enforce a per-preset file-size limit; the app's size check is a convenience, not a server-side security boundary.

No Cloudinary API secret belongs in this app. Unsigned upload presets are discoverable in browser requests. This simple approach is intended for the school demo. Normal image links are public to anyone who has the link.

## Features

- Email/password registration, login, logout, and password-reset email requests.
- Session storage and automatic token refresh. Passwords are not saved by the app.
- Create, view, edit, search, filter, and delete multiple pet profiles.
- Optional compressed pet profile photos, uploaded automatically to Cloudinary.
- Vaccination records, medical visits, and health notes, with editing and deletion.
- Optional weights, veterinarian details, notes, and next due dates on care records.
- In-app reminders sorted by date, including overdue dates and marking reminders done.
- Responsive desktop navigation and phone bottom navigation.
- Loading, empty, validation, confirmation, and error states.

Reminders are shown inside the app. The app does not send push notifications or scheduled emails. Marking a reminder done clears its next due date and keeps the original care record.

## Where the code lives

```text
src/app/
  app.routes.ts            Page routes and login protection
  auth.guard.ts            Checks the sign-in session
  models.ts                Pet and care-record interfaces
  services/
    auth.service.ts        Firebase Authentication REST calls
    pet.service.ts         Firestore REST CRUD and value conversion
    image.service.ts       Image resizing and Cloudinary REST upload
    errors.ts              Readable API error messages
  pages/
    auth/                  Login, registration, and password reset
    shell/                 Shared navigation and account controls
    home/                  Pet notebook overview, search, and filters
    pet-form/              Add and edit a pet
    pet-detail/            Pet profile and care-record forms
    reminders/             Care dates and reminder completion
    privacy/               Demo privacy and terms
src/environments/
  environment.ts           Firebase and Cloudinary configuration
src/global.scss            App styles and responsive layouts
public/assets/             The images supplied for this project
firestore.rules            Owner-only database access
tests/petcare.spec.ts       Browser tests using simulated REST APIs
```

Forms use `ngModel` and straightforward `async/await` functions. `firstValueFrom` lets a function await an Angular HTTP request without nested subscriptions. The only Firestore-specific data conversion is in `PetService`, because its REST API represents values using fields such as `stringValue` and `doubleValue`.

## Database structure

```text
users/{firebaseUserId}/pets/{petId}
  name, species, breed, sex, birthday, weightKg
  allergies, notes, imageUrl, imagePublicId, createdAt, updatedAt

users/{firebaseUserId}/records/{recordId}
  petId, category, title, date, nextDate
  veterinarian, weightKg, notes, createdAt
```

Records live in one collection per user. `petId` connects each record to its pet; `category` is `vaccination`, `medical`, or `health`. For a small demo this makes the code easy to follow: load the user's records, then filter them in the app. Lists support Firestore pagination.

## REST requests used

| Action | Request |
| --- | --- |
| Register | `POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=...` |
| Login | `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=...` |
| Reset password | `POST https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=...` |
| Refresh token | `POST https://securetoken.googleapis.com/v1/token?key=...` |
| List pets or records | `GET {documentsUrl}/users/{uid}/pets` or `/records` |
| Get one pet | `GET {documentsUrl}/users/{uid}/pets/{id}` |
| Create | `POST {documentsUrl}/users/{uid}/{collection}` |
| Update | `PATCH {documentsUrl}/users/{uid}/{collection}/{id}` |
| Delete | `DELETE {documentsUrl}/users/{uid}/{collection}/{id}` |
| Upload photo | `POST https://api.cloudinary.com/v1_1/o8wnfkuc/image/upload` |

`documentsUrl` is `https://firestore.googleapis.com/v1/projects/petclinic-e4c37/databases/(default)/documents`. Firestore requests include `Authorization: Bearer <Firebase ID token>`. Updates require an existing document, preventing an edit from recreating a profile deleted elsewhere.

## Photo and deletion behavior

Photos go to Cloudinary; only the image URL and public ID go to Firestore. If photo upload succeeds but the database save fails, a retry in the same form reuses the uploaded image instead of uploading it twice.

Firestore does not cascade deletes. The app deletes a pet's care records first, then its profile. If any deletion fails, it stops and shows an error; retry after checking the connection. This simple sequence is not an atomic operation.

Replacing a photo, removing a photo, or deleting a pet does not delete the original Cloudinary file. Clean up unused photos manually in Cloudinary for this demo. Fully automated secure cleanup and protection against unsigned-upload abuse would require a trusted backend.

## Verification scope

`npm test` runs browser tests with simulated Firebase and Cloudinary REST responses. They verify the request methods, owner-specific paths, bearer tokens, photo multipart payload, CRUD flows, retries, token refresh, and responsive layouts without creating accounts or uploading files to your live services. See `docs/verification.md` for recorded results and the limits of live verification.

## Reference documentation

- [Firebase Authentication REST API](https://firebase.google.com/docs/reference/rest/auth)
- [Firestore REST API and authentication](https://firebase.google.com/docs/firestore/use-rest-api)
- [Cloudinary browser uploads](https://cloudinary.com/documentation/client_side_uploading)
- [Cloudinary upload presets](https://cloudinary.com/documentation/upload_presets)
- [Ionic 9 import changes](https://github.com/ionic-team/ionic-framework/blob/main/BREAKING.md)
