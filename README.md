# hao — Training journal

A responsive, monochrome workout journal built with HTML5, CSS3 and vanilla JavaScript. No dependencies, accounts, analytics or external fonts.

## Run

Use Node.js 20+ and run `npm start` in this directory. The server listens on port 3000 (override with `PORT`). No dependency installation is necessary. Run `npm test` for the data-model tests.

For an iPhone, deploy the static files on an HTTPS host and open that site in Safari. Safari on iOS 16+ is supported. Use Share → Add to Home Screen for an app-like window. After the first successful online load, the service worker caches the app for offline use. Live processes need restarting in a new development environment.

## Features

- Create exercises; log individual sets with reps and kg on any selected day. Exercise dropdowns, the library and the daily list are sorted A–Z (case insensitive).
- Edit/delete workouts; record/update/remove one body weight entry per day.
- See daily exercise count, working sets, total reps and body weight. Open the Daily exercises tab to see the selected day’s workouts and each set’s kg and reps; edit or delete entries there.
- A combined three-line chart by exercise shows daily maximum weight, total sets and total reps together. The lines are red for kg, green for sets and yellow for reps, all using one shared scale with whole-number ticks on the left. Every calendar day in the selected range is labelled below; the chart scrolls horizontally for long ranges while the value axis stays fixed. Exact decimal kg values remain available in the day readout. A separate view charts daily body weight. Choose 7 days, 30 days or all history, ending on the selected day. Tap or keyboard-focus a day to see its date and all three training values. Multiple workouts of the same exercise are combined for each day. Missing days are not treated as zero; lines connect recorded days. Bodyweight exercises use 0 kg added load.
- Export and restore validated JSON backups. Import replaces existing data only after confirmation.
- Enter kg using either decimal separator: `22.5` or `22,5` (also supported for body weight). Reps remain whole numbers.
- Choose **Manage** next to Exercise to remove starter or custom exercises. Unused entries are deleted; exercises with saved workouts are removed from logging choices while preserving history and charts, and can be restored. Old backups continue to work.
- In **Daily exercises**, choose **Copy workouts**, select any **From date** and **To date**, then confirm. A preview shows the source day’s workouts, exercises, sets and reps. Copy is available even when the day you are viewing is empty, provided another day has saved workouts. Copies all saved workouts from the chosen source day, including sets, reps and kg, with independent entries. Existing destination workouts remain; body weight is not copied. Copying twice intentionally adds two copies.

## Nutrition

Open **Nutrition** and use the shared date selector to review any day.

- Set daily protein, carbs and fat targets plus sugar and salt limits, all in grams. Blank means unset; zero is a valid limit. Targets are saved per day; **Use previous day** fills the form for review before saving. These are your own goals, not automatically generated dietary recommendations.
- Add/edit/delete foods in **Food library**, entering nutrient grams per **100 g** or **100 ml** from the food label. Salt means salt, not sodium. Dot and comma decimals both work. No automatic mass-to-volume conversion is applied.
- Choose a food and enter the actual amount eaten in its g/ml unit. The preview and daily comparison calculate each nutrient as `label value × amount / 100`.
- The **Food diary** supports editing portions and deleting entries. Food library edits take effect on the actual local calendar day they are saved, regardless of the date currently selected. Linked portions on that day and later recalculate using the new values; earlier diary entries stay unchanged. Label versions are retained so new backdated portions use the values effective on their selected date. Repeated edits on the same day replace that day’s version. Deleting a food keeps diary snapshots. Foods with logged portions keep their g/ml unit; add a separate food for a different unit. Legacy entries are linked by matching name and unit when updating; label history from before this feature cannot be reconstructed, so the previous library value is the initial baseline.
- Nutrition is included in LocalStorage and JSON export/import. Existing training-only data and backups remain compatible. Copying a training day does not copy food entries or nutrition targets.

## Data and privacy

The original storage key is retained after the rename to hao so existing data remains available. Data is stored in LocalStorage under `form.training.v1` for the current browser and origin. No server receives it. Changing the site address, clearing Safari website data, device loss, or private browsing can remove or isolate it. Export backups regularly; storage is not cloud sync. A failed storage write is reported and never treated as a successful save. Malformed saved data is preserved for recovery. A change from another tab blocks writes until reload to prevent stale overwrites.

The small footer storage counter estimates remaining LocalStorage space against a typical 5 MB budget, counting UTF-16 keys and values for this website. It refreshes on load, saves, deletion, imports and changes from another tab. This is an estimate: browsers do not expose the exact LocalStorage quota, and offline app cache uses separate storage. No quota-probing writes are performed.

Do not open `index.html` directly using a file URL; serve it over HTTP for development or HTTPS on an iPhone. Offline installation requires HTTPS (or localhost for development). The app does not require a database, API credentials or a build step.
