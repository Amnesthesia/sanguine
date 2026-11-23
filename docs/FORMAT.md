# Sanguine data format, version 1

One day-based JSON file. Every importer (Clue, Natural Cycles, drip, ...) converts its app's files into it, and the app imports only this. Our own export writes it, so a file in this format always imports. Decision: D-159. Code: `apps/mobile/src/data/format/sanguineData.ts` (types and `validateSanguineData`).

This is not `events.jsonl`. That file is the app's internal event log (Lamport clocks, retractions, notes encrypted with the device key) used by backup, restore and phone-to-phone sync. It stays as it is.

## Shape

```json
{
  "format": "sanguine-data",
  "version": 1,
  "exportedAt": "2026-11-02T09:00:00Z",
  "source": { "app": "sanguine" },
  "days": [
    {
      "date": "2026-10-31",
      "flow": { "level": "medium", "kind": "period", "clots": false },
      "temperatures": [{ "valueC": 36.45, "type": "bbt", "time": "06:40", "source": "oral", "disturbed": false }],
      "lh": "negative",
      "pregTest": "negative",
      "mucus": { "quality": "creamy", "amount": "light" },
      "cervix": { "position": "low", "firmness": "firm", "opening": "closed" },
      "sex": { "protected": true },
      "symptoms": [{ "code": "cramps", "intensity": 2 }, { "code": "fatigue" }],
      "energy": 2,
      "note": "Plain text."
    }
  ],
  "lifeStates": [{ "kind": "pregnant", "start": "2026-01-10", "end": "2026-02-20", "outcome": "loss" }],
  "cycleMarks": [{ "cycleStart": "2026-03-01", "mark": "exclude" }]
}
```

Every field except `format`, `version` and `days` is optional. `days` holds at most one entry per date, sorted by date. Dates are `YYYY-MM-DD` in the person's own calendar (no time zone).

## Fields

| Field | Values | Notes |
|---|---|---|
| `flow.level` | `spotting`, `light`, `medium`, `heavy` | A bleeding day. |
| `flow.kind` | `period` (default), `withdrawal_bleed`, `intermenstrual`, `on_contraception`, `post_pregnancy` | Only `period` starts a cycle. |
| `flow.clots` | true / false | |
| `temperatures[]` | `valueC` 34 to 42 (°C), `type` `bbt` or `skin_temp`, `time` `HH:MM`, `source` `oral`, `vaginal` or `other`, `disturbed` | Several a day are allowed. `disturbed` means the source said the reading is unreliable. |
| `lh`, `pregTest` | `negative`, `positive` | |
| `mucus` | `quality` `dry`, `sticky`, `creamy`, `watery`, `eggwhite`; `amount` `light`, `medium`, `heavy` | |
| `cervix` | `position` `low`/`mid`/`high`, `firmness` `firm`/`medium`/`soft`, `opening` `closed`/`partial`/`open` | All three or none. |
| `sex.protected` | true / false | True means a condom was used. |
| `symptoms[]` | `code` from `copy/symptoms.json`; `intensity` 1 to 3, default 1 | Presence only when the source records no intensity. |
| `energy` | 1 to 5 | |
| `note` | text | Plain text. Our export writes it decrypted: the file is the user's to keep, so treat it as sensitive. |
| `lifeStates[]` | `kind` as in the app (`pregnant`, `postpartum`, `perimenopause`, ...), `start`, optional `end`, `outcome` (`birth` or `loss`, for `pregnant`), `detail` | |
| `cycleMarks[]` | `cycleStart`, `mark` `exclude` or `confirm_long` | The person's own correction of a cycle. |

## What changes a prediction

Only flow, temperatures, `lh`, `mucus`, `cervix` and life states. Symptoms, energy, sex and notes never do (CLAUDE.md non-negotiable).

## Importing

- The reader checks every field. A bad field or day is reported and left out; the rest imports. A file from a newer `version` is refused.
- Each imported value is an `imported` event with `external_id` `<source app>:<date>:<field>`, so importing the same file twice adds nothing.
- The device's own entry wins: a field the person logged by hand on that day is kept and counted, never overwritten.

## Versioning

Within version 1 only optional fields are added. A change that removes or reinterprets a field is version 2. Readers ignore nothing silently: an unknown field is reported.

## Adapters

`apps/mobile/src/data/adapters/`: each adapter detects its app's files, decodes them to this format and may later encode this format back to the app's. Unmapped values are reported in the import result and never guessed.
