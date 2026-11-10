# Verification

Verified on November 7, 2026 (Asia/Manila).

## Build and browser checks

- PASS: `npm run build` produces the production app in `www/` with no build errors.
- PASS: `ionic serve --no-open --host=127.0.0.1 --port=8101 --no-interactive` starts the development server. The login page, paw icon, and pet photo return HTTP 200.
- PASS: `npm test` runs 12 Playwright scenarios against the locally served Angular application.
- PASS: no browser page errors were recorded in the CRUD and responsive scenarios.
- PASS: application source contains no Firebase or Cloudinary integration, Firestore wrappers, or email-recovery routes.
- PASS: the duplicate Home “Add my first pet” and profile “Add a care record” buttons remain removed. The main Add a pet and Add a record controls work.

Browser tests intercept Supabase HTTP requests. They assert the publishable API key, user bearer token, plain JSON payloads, REST verbs, and private-photo requests. They do not alter the live project.

## Live Supabase checks

Connected project: `hykutdgbuycbfquefice` (PetCare).

- PASS: `pets` and `pet_records` exist with owner policies, validation constraints, and cascading deletion.
- PASS: the `pet-photos` bucket is private, allows JPEG images, and limits files to 2 MB.
- PASS: Auth settings report email sign-in enabled, registration enabled, and email confirmation disabled.
- PASS: two temporary accounts registered using made-up `@petcare.test` addresses and received immediate sessions.
- PASS: password login and refresh-token exchange returned usable sessions.
- PASS: REST create, list, and update of a pet using ordinary JSON.
- PASS: REST creation of a care record linked to that pet.
- PASS: a second account could not read the first account's pet; anonymous pet reads were denied.
- PASS: owner JPEG upload, signed-URL creation, and image retrieval through the signed URL.
- PASS: fetching the private photo anonymously without a signed URL failed.
- PASS: the second account could neither sign the first owner's photo nor upload into that owner's folder.
- PASS: deleting the temporary pet also removed its care record.
- PASS: the temporary photo and both Auth accounts were removed. A final query confirmed zero test pets, records, photo objects, and test Auth accounts.
- PASS: the SQL verification in `supabase/verify.sql` checked owner CRUD, cross-account read/update isolation, forged-owner rejection, cross-owner record rejection, and cascading deletion. Its fixtures were rolled back.
- PASS: Supabase security advisors returned no findings. Performance advisors reported only an informational unused index on the initially empty database.

No verification or recovery email was requested. Existing remote Firebase and Cloudinary data was left untouched.

## Browser coverage

| Controls or flow                            | Observed result                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| Protected page before login                 | Redirects to login                                                      |
| Empty login submit                          | Focuses required email field without an API call                        |
| Show / hide password                        | Changes input visibility                                                |
| Incorrect credentials                       | Shows a readable error                                                  |
| Registration password mismatch              | Shows an error without registering                                      |
| Made-up email registration                  | Opens the notebook immediately; password is absent from session storage |
| Confirmation accidentally enabled           | Settings check blocks signup before requesting an email                 |
| Privacy links and notebook navigation       | Open real destinations and return correctly                             |
| Add / edit pet and remove photo             | Persist changes using plain JSON; temporary signed URL is excluded      |
| Photo selection                             | Creates a JPEG preview and uploads to the owner's storage folder        |
| Unsupported image / upload permission error | Shows an error; retry works                                             |
| Save fails after photo upload               | Keeps form data and reuses the upload on retry                          |
| Missing private photo                       | Uses the placeholder and still opens the pet's care records             |
| Vaccination / medical / health records      | Create, display, filter, edit, and delete                               |
| Native record dialog                        | Cancel and Escape dismiss; focus is inside the dialog                   |
| Delete confirmation                         | Cancel keeps data; confirm removes it                                   |
| Failed pet deletion                         | Keeps the profile and records available; retry succeeds                 |
| Reminder completion                         | Clears next due date and preserves the record                           |
| Search / species / Clear filters            | Filter profiles and recover from no results                             |
| Permission or missing-table error           | Shows useful feedback and a working retry                               |
| Expired session                             | Refreshes once for concurrent reads; invalid refresh returns to login   |
| More than 100 pets                          | Loads subsequent REST pages                                             |
| Desktop and mobile logout                   | Clear the session and return to login                                   |

The running app starts with the user's real account data. Named pets in screenshots are automated-test fixtures.

## Responsive and visual checks

- PASS: home, add-pet form, pet profile, reminders, and record dialog were exercised at 320, 390, 768, 1024, and 1440 pixels without horizontal overflow.
- PASS: desktop and mobile login and notebook screenshots were visually inspected.
- PASS: controls have a 44px minimum touch target, visible focus styles, and native keyboard behavior.
- PASS: the file input is reached through the visible Choose photo button.
- PASS: reduced-motion settings suppress transitions and animations.
- PASS: the new email-format hint uses the existing muted-text color, whose contrast on cream is 5.50:1.

Previously measured palette ratios remain applicable; the migration keeps these colors:

| Pair                                   | Ratio   |
| -------------------------------------- | ------- |
| Cocoa body text on cream               | 12.02:1 |
| Secondary text on cream                | 5.50:1  |
| White on the primary button            | 5.87:1  |
| Sage status text on its background     | 6.94:1  |
| Error text on its background           | 7.27:1  |
| Placeholder text on an input           | 4.89:1  |
| Selected filter text on its background | 7.11:1  |

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
- C-5 PASS: claims are supported by the recorded live and simulated checks.
- R-11 PASS: buttons, fields, panels, photos, and status labels use distinct, consistent radii.
- R-15 PASS: action labels name the actual task, such as Add a pet and Save record.
- R-16 PASS: no AI marketing buzzwords in app copy.
- R-20 PASS: paw motifs, pet photos, care dates, and notebook language identify the product.
- R-21 PASS: the light paper theme supports the user's warm notebook direction.
- R-29 PASS: the core palette is cream/cocoa with terracotta actions and sage care status; user-supplied photographs retain their colors.
- R-30 PASS: the layout was built around this notebook's forms, profiles, and care entries.

## Demo limits

- Made-up email addresses are login IDs. There is no email verification or password recovery; users must remember their credentials.
- Photo links expire after one hour. Opening the notebook again requests fresh links.
- Replacing or removing a photo leaves the old private file in storage. Unused files need manual cleanup in Supabase.
- Reminders appear inside the app; they are not scheduled email or push notifications.
- This migration starts fresh. Earlier Firebase accounts and records are not imported.
- Android build and download verification is recorded in `docs/android.md`.
