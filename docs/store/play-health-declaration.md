# Google Play: health apps declaration and Health Connect data-type declaration (draft)

Submitted by the owner in Play Console. Text drafted from PLAN.md §6.6 and §7.

## Health apps declaration

- Category: menstrual cycle tracking (health and fitness). Not a medical device, not a diagnostic app; no clinical claims.
- The app does not collect health data to a server. Data stays on the device. It is not shared and not used for advertising.

## Health Connect: data types and why

| Data type | Read | Write | Reason shown to the user |
| --- | --- | --- | --- |
| MenstruationFlow, MenstruationPeriod | yes | yes | Keep the user's period log in step between Sanguine and other apps |
| IntermenstrualBleeding | yes | yes | Same |
| BasalBodyTemperature | yes | yes | Same; used in the user's own ovulation estimate |
| SkinTemperature | yes | no | Nightly values are read to improve the user's ovulation estimate and are never written back |
| OvulationTest | yes | yes | Same as period log |
| CervicalMucus | yes | yes | Same |
| SexualActivity | yes | yes | Only when the user turns on sexual-activity logging; off by default and unavailable under 18 |

## Separately declared permissions

- `READ_HEALTH_DATA_HISTORY`: the user may import up to two years of existing history on first connection; without it only 30 days are offered.
- `READ_HEALTH_DATA_IN_BACKGROUND`: an hourly background check picks up changes made in other apps so the log stays current without opening Sanguine.

## In-app requirements

- Permission rationale screen: shown before the system dialog (Settings > Health sync).
- Privacy policy: https://amnesthesia.github.io/sanguine/privacy.html (from `docs/privacy-policy.md`), also shown in the app (Settings > About > Privacy policy) and linked on the store page.
