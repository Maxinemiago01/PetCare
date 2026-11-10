# Verification

Verified on November 5, 2026 (Asia/Manila).

## Build and startup

- PASS: `npm run build` produces the production app in `www/` with no build errors.
- PASS: `ionic serve --no-open --host=127.0.0.1 --port=8100 --no-interactive` builds and serves the app. Ionic selected port 8101 because another application already occupied its default port. The Petcare preview returned HTTP 200.
- PASS: all nine Playwright browser tests passed. The final photo-picker accessibility adjustment is also covered by a targeted rerun of the upload and responsive tests.

## Live Firebase verification

These checks used a temporary account and temporary records in the supplied Firebase project:

- PASS: email/password account registration and login.
- PASS: refresh token exchange returns a usable ID token.
- PASS: create, list, get, and update an owner-scoped pet profile.
- PASS: create and list a care record connected to that pet.
- PASS: a signed-in user receives HTTP 403 for a different owner's data path.
- PASS: unauthenticated reads receive HTTP 403.
- PASS: both temporary documents were deleted, and the temporary account was deleted.

No password-reset email was requested against the live service.

## Browser coverage

Browser tests simulate Firebase and Cloudinary REST responses. They check HTTP methods, bearer tokens, owner-specific paths, Firestore value payloads, and Cloudinary multipart form data in addition to the visible UI.

| Controls or flow | Observed result |
| --- | --- |
| Protected page before login | Redirects to login |
| Empty login submit | Browser validation focuses the required email field; no API call |
| Show / hide password | Changes input visibility |
| Incorrect credentials | Shows a readable error |
| Register with different passwords | Shows a mismatch error |
| Register with matching passwords | Opens the empty pet notebook |
| Password reset | Opens a dialog, submits a simulated request, displays confirmation; close button, Close, and Escape work |
| Privacy and terms links | Open the real privacy page and return to the notebook |
| Add a pet / Add my first pet | Open the profile form |
| Choose a photo | Prepares a preview; upload request contains JPEG data and the supplied preset |
| Unsupported image format | Displays an error |
| Save profile | Creates a pet and opens its profile |
| Edit profile / Remove photo / Save changes | Persists edits without deleting the Cloudinary original |
| Failed save after photo upload | Retains entered data and reuses the upload on retry |
| Add vaccination, medical, and health records | Persists each category and renders its record |
| Health weight field | Saves and displays the entered weight |
| Edit record | Persists changes |
| Record category filters | Show the matching records and counts |
| Record dialog Cancel / Escape | Close the form; native focus stays inside the open dialog |
| Delete record / Keep it / Confirm | Cancel preserves the record; confirm removes it |
| Home calendar entry | Opens the correct pet profile |
| Care reminders / Mark done | Clears the due date and preserves the care record |
| Pet species filters / search / Clear filters | Filter profiles and recover from no results |
| Delete pet / Keep it / Confirm | Cancel preserves the profile; confirm removes its records and profile |
| Failed record deletion during pet removal | Keeps the pet available and shows an error; retry succeeds |
| Permission error / Try again | Shows an error and recovers after the service succeeds |
| Token expiry | Refreshes the token; invalid refresh returns to login |
| More than 100 pets | Fetches subsequent Firestore pages |
| Brand links, sidebar, summary link, calendar link, footer | Navigate to existing pages |
| Mobile My pets / Add pet / Reminders / Cancel | Navigate to the expected pages |
| Desktop and mobile logout | Clear the session and return to login |

The CRUD and responsive scenarios recorded no browser page errors. No demo data is included in the running app. Screenshots containing “Test pet” or “student” use clearly named automated-test fixtures.

## Responsive and visual checks

- PASS: home, add-pet form, pet profile, reminders, and record dialog were exercised at 320, 390, 768, 1024, and 1440 pixels. Body and Ionic scroll containers had no horizontal overflow.
- PASS: inspected desktop and mobile login and notebook screenshots.
- PASS: touch controls use a 44px minimum target, with larger submit buttons and fields. The hidden file input is reached through its visible Choose photo button rather than an invisible tab stop.
- PASS: native controls and dialogs provide keyboard behavior; visible focus styling is defined globally. Escape closes the record and password-reset dialogs.
- PASS: reduced-motion settings suppress transitions and animations.

Measured text contrast ratios:

| Pair | Ratio |
| --- | --- |
| Cocoa body text on cream | 12.02:1 |
| Secondary text on cream | 5.50:1 |
| White on the primary button | 5.87:1 |
| Sage status text on its background | 6.94:1 |
| Error text on its background | 7.27:1 |
| Placeholder text on an input | 4.89:1 |
| Selected filter text on its background | 7.11:1 |

## Antislop delivery gate

### Hard gate

- R-02 PASS: source scan found no em dash in app copy.
- R-03 PASS: five-width responsive checks found no horizontal overflow.
- R-17 PASS: notebook counts derive from loaded pets and records; no marketing statistics.
- R-18 PASS: no testimonials or invented people.
- R-23 PASS: visual assets were supplied by the user; missing pet photos use a paw and initial placeholder.
- R-24 PASS: navigation targets are defined in `app.routes.ts` and exercised by browser tests.
- R-25 PASS: measured app text pairs exceed 4.5:1.
- R-26 PASS: the click-through matrix above records working controls and feedback.
- R-27 PASS: empty notebooks, loading indicators, failed API requests, and retries are implemented and exercised.
- R-28 PASS: no FAQ section.
- R-32 PASS: native controls, visible focus styling, dialog focus checks, and working Escape dismissal.
- R-33 PASS: UI features are implemented in source files; Prettier was used only for formatting.
- R-34 PASS: the app has one deliberate cream paper theme, with no partially implemented theme toggle.
- R-35 PASS: production build, Ionic startup, browser click-throughs, screenshots, and runtime-error checks recorded above.
- R-36 PASS: no fabricated security, compliance, customer, or performance claims.
- R-37 PASS: the user's pet-lover notebook direction and supplied images are recorded in `DESIGN.md`.
- R-38 PASS: the runtime starts empty; named test fixtures exist only in the test suite.

### Purpose gate

- R-01 PASS: cream/cocoa/terracotta come from the supplied paw image and notebook identity; no gradients or glow.
- R-04 PASS: filled Ionicons identify pets, calendar dates, photos, health, and medical records; meanings are recorded in `DESIGN.md`.
- R-06 PASS: locally bundled Nunito supports the requested rounded, friendly character.
- R-07 PASS: no decorative grid or dot wallpaper; the supplied paw is the identity motif.
- R-08 PASS: the auth arrow indicates form progression; chevrons identify navigable content.
- R-09 PASS: tags identify species or actual care status; no promotional badges.
- R-10 PASS: no glassmorphism.
- R-12 PASS: only dialogs use elevation shadows.
- R-13 PASS: no glow effects.
- R-14 PASS: pet cards support scanning comparable profiles; records, notes, and reminders have layouts fitted to their content.
- R-19 PASS: motion is limited to feedback and loading; reduced-motion preferences are supported.
- R-22 PASS: pet imagery comes from the user and directly relates to the app.

### Liveliness

- PASS: ENERGY 2 / RHYTHM 2 / MOTION 1 declared in the design direction.
- PASS: each screen prioritizes its task, such as opening a notebook, saving a profile, or adding a record.
- PASS: spacing separates profile information, care records, and actions.
- PASS: terracotta identifies primary actions; paw prints supply the repeated identity motif.
- PASS: the Design Read preceded implementation and is retained in `DESIGN.md`.

### Craftsmanship and consistency

- C-1 / R-31 PASS: major visual choices have written reasons in `DESIGN.md`.
- C-2 PASS: the click-through matrix covers real navigation, forms, filters, dialogs, and deletion.
- C-3 / R-05 PASS: screens follow pet-notebook tasks; no unrelated marketing sections.
- C-4 PASS: error recovery, dialog behavior, and five responsive widths were exercised.
- C-5 PASS: claims are supported by observed checks; live-upload verification is explicitly limited below.
- R-11 PASS: buttons, fields, panels, photos, and status labels use distinct, consistent radii.
- R-15 PASS: action labels name the actual task, such as Add a pet and Save record.
- R-16 PASS: no AI marketing buzzwords in app copy.
- R-20 PASS: paw motifs, pet photos, care dates, and notebook language identify the product.
- R-21 PASS: the light paper theme supports the user's warm notebook direction.
- R-29 PASS: the core palette is cream/cocoa with terracotta actions and sage care status; user-supplied photographs retain their colors.
- R-30 PASS: the layout was built around this notebook's forms, profiles, and care entries.

## Remaining verification limit

Cloudinary's upload endpoint responded to a request with no file, and the app's upload/compression/save sequence passed with simulated upload responses. No photo was uploaded to the live Cloudinary account, so its `petcare` unsigned preset has not been confirmed by a successful live upload. The first real pet-photo upload verifies that remaining account setting.

Unused photos need manual cleanup in Cloudinary, as documented in the README. Reminders are in-app entries, not scheduled push notifications.
