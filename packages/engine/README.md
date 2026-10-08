# @sanguine/engine

The Sanguine prediction engine. Pure TypeScript with no runtime dependencies and no platform, clock, randomness or I/O access: `predict(history, settings, today)` is deterministic. Specification: `docs/PLAN.md` section 4. Requirements trace: `docs/regulatory/requirements.md`.

Symptoms never change a prediction. Only period dates, temperature (oral and wearable), LH tests, cervical mucus and cervical position do.

```ts
import { predict } from '@sanguine/engine';
const p = predict(history, settings, '2026-10-10');
p.nextPeriod?.i80; // { lo, hi } range, never a single day
```

`ENGINE_BUILD_HASH` (from `pnpm engine-hash`) is shown in Settings > About. Licence: MIT.
