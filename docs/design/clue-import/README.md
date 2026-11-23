# Import from Clue: mockups

Screens for Settings > Privacy and data > Import from Clue (backlog P5-1) and the "All history" window in Settings > Health sync. Made 2026-11-24 in the glass design language (`docs/superpowers/specs/2026-11-18-glass-design-language.md`), copying the Settings frames in `docs/design/glass-redesign/frames/` (Privacy, Backup restore, Health on, Delete confirm). Open `index.html` to see every image grouped; `COPY.md` lists every string with a proposed i18n key.

All data is invented. iPhone treatment, 440 pt wide (PNG at 2x, 880 px).

## Images

| File | Shows |
| --- | --- |
| `frames/Guide-Light.png` | The guide, light, full length: intro line, four numbered step cards (breadcrumb chips or a small drawing in each), the primary button "Choose the Clue file" inside step 4, the unzipped-on-a-computer line and the privacy card. |
| `frames/Guide-Dark.png` | The same, dark. |
| `frames/Guide-Light-150.png` | The same, light, every text size at 150%. Breadcrumbs wrap with the chevron leading the next chip; nothing is clipped; the toolbar title still fits on one line. |
| `frames/Password-Sheet-Empty.png` | After a zip is chosen: the sheet over the dimmed guide, above the keyboard. File name chip, masked field with placeholder "Paste or type the password", eye button (Show password), Cancel and Open. Open is unavailable until something is typed. |
| `frames/Password-Sheet-Wrong.png` | The same after a wrong password: field ringed in period red, the password shown in plain text (eye toggled, so she can compare it with Clue's screen), the error under the field. Open is available again. |
| `frames/Result.png` | After an import: result card at the top of the guide (as Privacy shows its result panel): records imported, days where her own entry was kept, symptoms switched on in Tracking, and a "Not imported" list with counts. Screen height only. |
| `frames/Cannot-Open.png` | The zip uses an encryption the app cannot read: amber caution panel at the top with the computer route and a secondary button "Choose measurements.json". Screen height only. |
| `frames/Health-All-History.png` | Health sync with a fourth window chip, "All history", chosen, and a note that Flo and Natural Cycles can share their data with Apple Health. Data-type rows trimmed to three; the rest of the screen is unchanged from `glass-redesign/frames/Settings-Health-On.html`. |

## Re-render

From the repo root: `node docs/design/clue-import/render.mjs`. It runs `frames.mjs` (the single source: it writes every `frames/*.html`), then screenshots each frame's phone element with Playwright's Chromium at 2x. Playwright must resolve as `playwright` or be in the npx cache (`npx playwright install chromium`). Edit `frames.mjs`, not the HTML: the HTML is regenerated. Text sizes are `calc(<size> * var(--t))`, so the 150% frame is the same markup with `--t: 1.5`; dark is the same markup with the dark tokens.

## Design decisions

- **One screen, four step cards.** The steps happen in two other apps, so each card names exactly where to tap as breadcrumb chips (More › Settings › Download my data) rather than a screenshot or Clue's logo (no third-party branding). Step 2 has a small drawing of a password; step 3 shows the file name start ("ClueDataDownload") so she can find it in Files.
- **The single primary action sits inside step 4**, so the order of the steps is the order of the screen. Everything else is text or a secondary pill.
- **Password in a sheet, not on the guide.** It is asked only after a file is chosen, and only for a zip; a chosen `measurements.json` goes straight to the import. The sheet names the chosen file so she knows which one she is unlocking. Paste is allowed (said in the body and the placeholder), and the eye button shows the password, which matters because Clue's passwords are long and mixed-case. On a wrong password the field keeps what she typed and reveals it; the error says capitals count.
- **Open is unavailable on an empty field** (dimmed fill, `aria-disabled`) rather than showing an error for nothing typed.
- **Platform words.** The frames are iPhone: "save the file to Files", "Save to Files", "Apple Health". COPY.md gives the Android variants ("Downloads", "Health Connect") as separate keys, the same way the app already splits `discreetIconDesc` / `discreetIconDescAndroid`, instead of the brief's "Files (iPhone) or Downloads (Android)" in one sentence.
- **Result as a card, not the amber CautionPanel.** A finished import is good news; amber is kept for the cannot-open case. Both sit at the top of the guide, where Privacy shows its result, and stay until the next action.
- **"Your own entry wins" is said before and after**: under the button in step 4 and in the result.
- **Wording avoids the §2.3/§8.7 list**: no "password-protected", "safe" or "should" (checked with the `copy/copy.test.ts` regexes over the frames' text).

## Not done, on purpose

- No "Open Clue" button: there is no documented link into Clue's settings, and a wrong deep link is worse than a breadcrumb.
- No list of what comes across from Clue on the guide: the importer's mapping is not settled here, and a promise the importer does not keep would mislead. The result panel reports what actually happened.
- No Android frames (the differences are copy only), and the 150% frame covers the guide only, not the sheet or the panels; check those at 150% on the simulator when they are built.
- The Settings > Privacy row that opens this screen is not drawn; it is an ordinary row like "Report for a doctor" (strings in COPY.md).
- The keyboard is a placeholder block (`[System keyboard]`), sized like an iPhone keyboard with its suggestion bar (336 pt), only to show the sheet's buttons stay above it.

## Not verified

- The rendering is Chromium; the app uses the system glass material and SF Pro, so blur and exact line breaks differ on a device.
- Clue's menu path, password behaviour, 72-hour link and file name come from the brief, not from a check of the current Clue app.
- Whether Flo and Natural Cycles write past history (not only new entries) to Apple Health is the brief's claim; the note says only that they "can share their data".
