# Import from Clue: copy

Every string in the frames, en-AU, with a proposed key for `copy/en-AU.json`. Keys under `settings.importClue.*` are new; the Health keys extend the existing `settings.health.*`. Interpolation uses the file's `{name}` style. Strings already in `copy/en-AU.json` are marked "existing" and are not repeated as new keys.

The forbidden-word test in `copy/copy.test.ts` covers these once pasted; none of them matches its list today.

## Settings > Privacy and data (the row that opens the guide; not drawn)

| Key | String |
| --- | --- |
| `settings.importClue.row` | Import from Clue |
| `settings.importClue.rowDesc` | A step-by-step guide to bring your Clue history across. |

## Guide

| Key | String |
| --- | --- |
| `settings.importClue.title` | Import from Clue |
| `settings.importClue.intro` | Bring your Clue history into Sanguine in four steps. Steps 1 to 3 happen in Clue and your email; step 4 is here. |
| `settings.importClue.stepA11y` | Step {n}: |
| `settings.importClue.crumbsA11y` | Where to tap: {path} |
| `settings.importClue.crumbsJoin` | , then |
| `settings.importClue.step1.title` | Ask Clue for your data |
| `settings.importClue.step1.body` | In Clue, open More, then Settings, then Download my data. |
| `settings.importClue.step1.crumbs.more` | More |
| `settings.importClue.step1.crumbs.settings` | Settings |
| `settings.importClue.step1.crumbs.download` | Download my data |
| `settings.importClue.step2.title` | Note the password |
| `settings.importClue.step2.body` | Clue shows a password. Write it down or leave that screen open: you type it in step 4. If Clue says your data was already sent, the same password is still on that screen. |
| `settings.importClue.step2.drawing` | Clue's password, for step 4 |
| `settings.importClue.step3.title` | Save the file from Clue's email |
| `settings.importClue.step3.body` | Clue emails you a link. Open it on this phone within 72 hours and save the file to Files. |
| `settings.importClue.step3.bodyAndroid` | Clue emails you a link. Open it on this phone within 72 hours and save the file to Downloads. |
| `settings.importClue.step3.crumbs.email` | Email from Clue |
| `settings.importClue.step3.crumbs.link` | Open the link |
| `settings.importClue.step3.crumbs.save` | Save to Files |
| `settings.importClue.step3.crumbs.saveAndroid` | Save to Downloads |
| `settings.importClue.step3.fileLabel` | The file name starts with |
| `settings.importClue.step3.fileName` | ClueDataDownload |
| `settings.importClue.step4.title` | Choose the file here |
| `settings.importClue.step4.body` | Sanguine asks for the password, then shows what came across. |
| `settings.importClue.step4.button` | Choose the Clue file |
| `settings.importClue.step4.ownEntries` | Days you already logged in Sanguine keep your own entry. |
| `settings.importClue.unzipped` | Unzipped it on a computer? Choose measurements.json from the folder instead. It needs no password. |
| `settings.importClue.privacy` | The file is read on this phone. Nothing is sent anywhere, and the password is not kept. |

## Password sheet

| Key | String |
| --- | --- |
| `settings.importClue.sheet.title` | Type Clue's password |
| `settings.importClue.sheet.body` | The one Clue showed on its Download my data screen. You can paste it. |
| `settings.importClue.sheet.label` | Password |
| `settings.importClue.sheet.a11yLabel` | Clue's password |
| `settings.importClue.sheet.placeholder` | Paste or type the password |
| `settings.importClue.sheet.show` | Show password |
| `settings.importClue.sheet.hide` | Hide password |
| `settings.importClue.sheet.wrong` | That password does not open this file. Compare it with the one on Clue's Download my data screen; capitals count. |
| `settings.importClue.sheet.open` | Open |
| (existing) `common.cancel` | Cancel |

The file name chip shows the chosen file's own name (sample: `ClueDataDownload-1798.zip`); no string.

## Result

| Key | String |
| --- | --- |
| `settings.importClue.result.imported` | Imported {n} records |
| `settings.importClue.result.imported_one` | Imported 1 record |
| `settings.importClue.result.keptOwn` | Kept your own entry on {n} days where Clue had something different. |
| `settings.importClue.result.keptOwn_one` | Kept your own entry on 1 day where Clue had something different. |
| `settings.importClue.result.symptomsOn` | Switched on in Tracking, so they show when you log: {list}. |
| `settings.importClue.result.notImported` | Not imported |
| `settings.importClue.result.count` | × {n} |
| `settings.importClue.result.notImportedNote` | These stay in your Clue file. |

The "Not imported" item names (sample: Weight, Ovulation test) come from the importer's list of Clue categories it skipped; the symptom names in `symptomsOn` come from `copy/symptoms.json`, lower case, joined with ", ".

## Cannot open the zip

| Key | String |
| --- | --- |
| `settings.importClue.cannotOpen.title` | Sanguine cannot open this zip |
| `settings.importClue.cannotOpen.body` | Clue locked it with a kind of encryption this app cannot read. On a computer, unzip it with the password, get the file measurements.json onto this phone (by email, for example) and choose it here. |
| `settings.importClue.cannotOpen.button` | Choose measurements.json |

## Settings > Health sync

| Key | String |
| --- | --- |
| (existing) `settings.health.since` | Import from |
| (existing) `settings.health.window.30d` / `1y` / `2y` | 30 days / 1 year / 2 years |
| `settings.health.window.all` | All history |
| (existing) `settings.health.windowNote` | Applies the next time you switch a type on. |
| `settings.health.otherApps` | Coming from Flo or Natural Cycles? Both can share their data with {platform}. Choose All history and it comes across from there. |

`{platform}` is the value the existing `settings.health.intro` already uses (Apple Health / Health Connect).
