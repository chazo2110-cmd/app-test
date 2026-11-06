# FORM — Training journal

A responsive, monochrome workout journal built with HTML5, CSS3 and vanilla JavaScript. No dependencies, accounts, analytics or external fonts.

## Run

Use Node.js 20+ and run `npm start` in this directory. The server listens on port 3000 (override with `PORT`). No dependency installation is necessary. Run `npm test` for the data-model tests.

For an iPhone, deploy the static files on an HTTPS host and open that site in Safari. Safari on iOS 16+ is supported. Use Share → Add to Home Screen for an app-like window. After the first successful online load, the service worker caches the app for offline use. Live processes need restarting in a new development environment.

## Features

- Create exercises; log individual sets with reps and kg on any selected day.
- Edit/delete workouts; record/update/remove one body weight entry per day.
- See daily exercise count, working sets, total reps and body weight. Open the Daily exercises tab to see the selected day’s workouts and each set’s kg and reps; edit or delete entries there.
- Line charts by exercise for maximum weight, total reps and sets, plus a separate daily body weight chart. Choose 7 days, 30 days or all history, ending on the selected day. Tap a point for its date/value. Multiple workouts of the same exercise are combined for each day. Missing days are not treated as zero; lines connect recorded days. Bodyweight exercises use 0 kg added load.
- Export and restore validated JSON backups. Import replaces existing data only after confirmation.
- Enter kg using either decimal separator: `22.5` or `22,5` (also supported for body weight). Reps remain whole numbers.
- Choose **Manage** next to Exercise to remove starter or custom exercises. Unused entries are deleted; exercises with saved workouts are removed from logging choices while preserving history and charts, and can be restored. Old backups continue to work.
- In **Daily exercises**, choose **Copy to another day**, pick a date and confirm. Copies all saved workouts from the selected day, including sets, reps and kg, with independent entries. Existing destination workouts remain; body weight is not copied. Copying twice intentionally adds two copies.

## Data and privacy

Data is stored in LocalStorage under `form.training.v1` for the current browser and origin. No server receives it. Changing the site address, clearing Safari website data, device loss, or private browsing can remove or isolate it. Export backups regularly; storage is not cloud sync. A failed storage write is reported and never treated as a successful save. Malformed saved data is preserved for recovery. A change from another tab blocks writes until reload to prevent stale overwrites.

Do not open `index.html` directly using a file URL; serve it over HTTP for development or HTTPS on an iPhone. Offline installation requires HTTPS (or localhost for development). The app does not require a database, API credentials or a build step.
