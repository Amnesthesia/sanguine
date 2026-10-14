# Food and movement notes by cycle phase, and energy tracking: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**

- **Part A (Tasks 1–5).** Today shows one card for the estimated part of the cycle. It holds a food note, a movement note and, where research exists, supplements. Each note gives its reason and how well supported it is. The day screen (opened from the Calendar) shows the same card for any day. There it adds what changes in the body, the full reasons and the sources.
- **Part B (Tasks 6–9).** The user can log an energy level from 1 to 5 for any day. Insights charts energy over time and averages it by part of the cycle. From her own pattern it makes suggestions, for example "Your energy was lowest in the days before your period…", backed by the movement-for-mood evidence. On Today, the card adds one line when today falls in her lowest-energy part of the cycle.

**Architecture:**

- **Part A.** A pure `phaseOn()` in `apps/mobile/src/features/guidance/guidance.ts` places any date in one of six guide phases. It uses the engine's existing prediction and the analysed cycle records, and it does not change `packages/engine`.
  - All wording lives in `copy/en-AU.json` under `guidance.*`.
  - A TS table gives every note and every supplement an evidence grade.
  - One component, `GuidanceCard`, renders a short form on Today and a full form on the day screen.
  - The preference `cycleGuidance` switches the card off.
- **Part B.** Energy is stored and processed in three steps:
  - **Storage.** A new event kind `energy` (`{ day, level }`, where level 0 clears) projects into a new nullable column `daily_log.energy`, added by migration 004. It never reaches the engine's `History`.
  - **Computation.** A pure `energyModel.ts` computes the averages per phase (through `phaseOn`) and the suggestions.
  - **Display.** Insights and Today read the column with one query.

**Tech Stack:** TypeScript, React Native (Expo SDK 57, dev client), expo-router, react-native-svg (already used by `charts.tsx`), i18next, vitest with the better-sqlite3 test DB, and Maestro (iOS simulator only).

**Spec:** The owner's messages of 2026-10-14:

1. "Research what's low/high when, and what nutrition and exercise best supports that part of the cycle. On the Today view, show nutrition and exercise advice (with reason to back it up). When clicking a day in the calendar view, show advice for that day and an explanation for the reasoning."
2. "When you log energy levels, Insights can show a chart of your energy levels over time, and use this to make suggestions based on that."
3. "It's not about performance, it's about how it affects your mood. Exercising to improve your mood when you feel low is well supported."
4. "Don't leave out omega-3 and ginger! For supplements with evidence, mention that there is some evidence for them. Recommend things that may work, but be sure to mention how well supported the claim is."
5. "There may also be other food suggestions for other parts of the cycle, like Vitamin B, Vitamin C and Zinc during the follicular phase, fibre-rich foods during ovulation, Magnesium and B12 during the luteal phase. When suggesting nutrition like this, give examples of such foods and meals."

Messages 3, 4 and 5 are owner decisions. They replace the more conservative first draft, which led with exercise performance and named no supplements. The research behind every note is in "Research summary" below. Read that section before Task 2: the copy argues from it.

## Global Constraints

- **Engine.** Do not change `packages/engine`. Add no engine export. Parts A and B are app-only changes.
- **Inputs.** Symptoms and energy never feed `predict`. `phaseOn` reads only the prediction, the cycle records and the date. Energy never enters `History` or any engine type.
- **Forbidden words** (PLAN.md §2.3, §8.7; enforced by `copy/copy.test.ts`). Never use: safe, unsafe, protected, contraception, birth control, conceive, fertile today, chance of pregnancy, risk, diagnosis, PCOS, endometriosis, perimenopause, abnormal, ladies, girls, feminine, womanhood, should, normal.
- **Phrasing.** Phrase every note as information: what was found, in how many people, and how strong the evidence is.
  - Every food note names example foods and at least one example meal or snack (owner, message 5).
  - When a popular claim has weak or contrary evidence, say so in the note. The fibre note does this.
  - For supplements, give what the trials used ("Trials used 750 to 2,000 mg a day"), never "take X".
  - Never name a calorie or kilojoule figure, body weight, fasting, a cleanse or any form of restriction. A guard test (Task 2) enforces this.
- **Evidence grades.** Every food note, movement note and supplement carries one of: "Strong evidence", "Some evidence", "Early evidence", "General guidance, not specific to this phase". The card always shows the general caveat. When it lists supplements, it also shows the supplement caveat.
- **Teen mode** (PLAN.md §8.6; `effectivePrefs(...).teen`):
  - The word "ovulation" appears only in the `ovulatory` copy. `phaseOn` never returns `ovulatory` when the effective `showOvulationEstimate` is false.
  - Supplements are hidden for under-18s. This is behind one constant, `SUPPLEMENTS_FOR_TEENS = false`, and the teen estimate unlock does not change it. It is a conservative default without clinical review (CLAUDE.md), and the owner can flip it.
- **No card** while prediction is suspended (pregnant, hormonal contraception, postpartum), before the first logged period, or for a future day past the next period's 80% range.
- **Energy suggestions** report the past in her own numbers ("was", "has been"). Never use "will", "expect", "predict" or "likely" in them. The persistent-low suggestion names no condition and ends "A doctor can help you check what is going on." (the §2.3 health-flag pattern).
- **Append-only events.** Re-logging energy for a day retracts the earlier `energy` event first, as `setSymptom` does (D-097).
- **Dependencies.** Add none (Expo Go allow-list, deny-list).
- **Accessibility.** Every interactive element gets an `accessibilityLabel` and a `testID`. Card headings get `accessibilityRole="header"`. The chart is one accessible image with a spoken summary. Check new screens at 150% font scale.
- **Testing** follows CLAUDE.md "Working unattended":
  - Per task: the related vitest files and the type-check.
  - Maestro: only the flows named in each task, iOS only, inside the simulator lock (Task 0).
  - Before the final commit: the full unit suite, lint and soup, once.
- **Ids.** Re-check them in Task 0. Every commit message starts with its backlog id.
  - Part A: backlog **P8-18**, decision **D-107**.
  - Part B: backlog **P8-19**, decision **D-108**.
  - Risks: **RK-25 to RK-28**.

## Review Focus

1. **Irregular cycles and uncertain ovulation.** The 80% ovulation range is wider than 12 days (`ovulationUncertain`). Expect the "general" notes on every non-period day, never a confident phase name. This also covers the energy averages: those days count in no phase. Pinned in Task 1 ("uncertain ovulation gives general") and Task 8 ("general and unknown days count in no phase").
2. **Teen mode around ovulation.** Expect follicular or luteal notes, no "ovulation" anywhere on the card and no supplements. Pinned in Task 1 (fold case), Task 2 (teen copy scan) and Task 3 (`showSupplements`).
3. **Pregnancy, hormonal contraception or postpartum.** Expect no card on Today or on any day screen, even on a logged period day. Expect no energy averages and no energy suggestions, because no phase is placed. The energy chart still shows her own logs. Pinned in Task 1 ("suspended") and on device in Task 4.
4. **Energy changed or cleared on the same day.** For example: Low, then Good, then Good tapped again to clear. Expect at most one value per day, no point on the chart after a clear, and no stale value on the day screen or in `daily.csv`. Pinned in Task 6 (projection) and Task 7 (`setEnergy`).
5. **Too little energy data.** Fewer than 10 logged days in 12 weeks, a phase with fewer than 4 days, or only one phase with enough days. Expect no phase suggestion, never one built from a handful of days. Pinned in Task 8.

Also pinned:

- A late period gives "general" (Task 1).
- A cycle merged by a missed log (`suspect_skip`) gives "general", and a life-state cycle gives no card (Task 1).

Recorded in D-108 rather than tested: a phone still on the old app version that receives a backup or sync carrying `energy` events rejects the file ("the file has invalid lines; nothing was imported"). Nothing is lost, and it works after that phone takes the over-the-air update.

---

## Research summary (read before Task 2)

### What changes across the cycle

The figure the owner attached is from **Draper et al. 2018**, "Menstrual cycle rhythmicity: metabolic patterns in healthy women", *Scientific Reports* 8:14568 ([PMC6167362](https://pmc.ncbi.nlm.nih.gov/articles/PMC6167362/)). It is a row-z-score heatmap of plasma and urine metabolites across five phases. Of 397 metabolites measured in 34 women, 208 changed across the cycle.

| Phase | Hormones | Findings |
| --- | --- | --- |
| Menstrual | Estrogen and progesterone lowest | Amino acids higher than in the luteal phase. Vitamin D (25-OH) "consistently" highest. Pyridoxic acid (a B6 marker) higher than around ovulation. Iron is lost with the blood: the NHMRC iron RDI is 18 mg/day for women aged 19–50, against 8 mg for men, and 15 mg at 14–18. |
| Follicular | Estrogen rising | Amino acids, phospholipids (LPC, PC), glutathione and cholesterol higher than in the luteal phase. |
| Periovulatory | Estrogen peak, LH surge | 25-OH vitamin D and pyridoxic acid lower than in the menstrual phase. |
| Luteal | Progesterone high | **39 amino acids and 18 lipid species lower** (FDR < 0.20), including serotonin (effect −0.71 against follicular). Glucose, cholesterol and vitamin D also lower. The authors read this as an anabolic state. Body temperature 0.2–0.5 °C higher, and sweating starts about 0.5 °C later (GSSI review). Resting metabolic rate slightly higher (Benton 2020, *PLoS ONE*: ES 0.33, n.s. in studies since 2000). Energy intake higher than in the follicular phase (Tucker/Hazell 2024, *Nutrition Reviews* 83:e866). Lysine need higher in a 5-woman tracer study (Kriengsinyos 2004, *AJP Endo* 287:E489). |
| Premenstrual | Both hormones falling | Amino acids recovering. Mood changes, bloating, cravings and lighter subjective sleep are common (Baker & Driver 2007, *Sleep Med*). |

Caveats on Draper 2018:

- One cycle per woman, and no diet record.
- Many results are significant only at nominal p < 0.05.
- Funded by Nestlé.
- Nobody has tested whether eating to these shifts helps.

### Exercise and mood (owner's correction)

| Finding | Source |
| --- | --- |
| Physical activity lowers depression (median SMD −0.43), anxiety (−0.42) and distress (−0.60) against usual care. Effects are largest in healthy people, in pregnant and postpartum women, and at higher intensity. | Singh et al. 2023, *BJSM* 57:1203; umbrella review of 97 reviews, 1,039 trials, 128,119 people |
| Walking or jogging, yoga and strength training work best for depression. Yoga and strength training are the easiest to keep up. | Noetel et al. 2024, *BMJ*; network meta-analysis of 218 RCTs, 14,170 people |
| A single session lifts mood (g 0.34), anxiety (g 0.50) and depressive symptoms (g 0.41). | Weinstein et al. 2024, *Psychosomatic Medicine*; 103 studies |
| Exercise raises feelings of energy (g 0.42) and lowers fatigue (g −0.37). | Wender, Manninen & O'Connor 2022, *Frontiers in Psychology*; 81 RCTs; earlier Puetz 2006 |
| Exercise eases premenstrual symptoms (SMD −1.08). | Pearce et al. 2020, *BJGP Open*; 15 RCTs, poor quality |
| Exercise eases period pain. | Armour et al. 2019, Cochrane CD004142; 12 RCTs, low certainty |
| Exercise *performance* changes little across the cycle. | McNulty 2020 (*Sports Med* 50:1813); Colenso-Semple 2023; D'Souza/Phillips 2023 (*J Appl Physiol*) |

The movement notes therefore lead with mood and energy. "Exercise lifts mood and energy" is graded **strong**: it holds at any point of the cycle. The phase link is the honest one. The days before the period (and, in Draper 2018, the luteal phase, with its lower serotonin) are when many women feel lowest, so those are the days a mood lift helps most.

### Food (several notes per phase, each with example foods and meals)

| Phase | Food id | Evidence | Grade |
| --- | --- | --- | --- |
| Period | `iron` (with vitamin C) | NHMRC NRVs: the extra need comes from menstrual loss (18 mg/day for women aged 19–50, against 8 mg for men). Vitamin C raises non-haem iron absorption. | Strong |
| Period | `omega3` (oily fish, walnuts, chia) | The pain trials used supplements (see below). Food is untested for pain, but it matches the general advice to eat fish twice a week. | Early |
| Follicular | `vitaminC` | Raises iron absorption, which matters after the period's loss. No follicular-specific study. | Strong (absorption) |
| Follicular | `bVitamins` | Chocano-Bedoya et al. 2011, *AJCN*, nested in Nurses' Health Study II (1,057 cases, 1,968 controls): the highest food riboflavin had RR 0.65 for incident PMS, and thiamine about 0.75. No link for B6, folate, B12 or supplements. Observational, with no correction for multiple comparisons. No timing tested. | Early |
| Follicular | `zinc` | Needed for egg-cell maturation in lab and animal studies. Supplement trials eased period pain (Hsu et al. 2024, *Nutrients*, 6 RCTs, 739 women). No timing tested. NHMRC RDI 8 mg/day for women. | Early |
| Around ovulation | `fibre` | Fibre raises estrogen excretion through the gut, which is the basis of the popular claim. Gaskins et al. 2009, *AJCN* (BioCycle, 250 women): higher fibre went with lower estradiol, progesterone and LH, and more anovulatory cycles (OR 1.78 per 5 g/day). The everyday bowel benefits are well established. | Early |
| Around ovulation | `vitaminDB6` | Draper 2018 only; no intervention. | Early |
| Luteal | `protein` | Draper 2018, Kriengsinyos 2004, Tucker 2024. | Early |
| Luteal | `magnesium` | Small, older supplement trials reported benefit; studies of intake from food are mixed (case-control positive, a larger dietary study null). NHMRC RDI 310–320 mg/day for women. | Early |
| Luteal | `b12` | No study links B12 to this phase, and Chocano-Bedoya 2011 found no B12 link to PMS. It is included as everyday advice: B12 deficiency causes tiredness, and it is easy to miss on plant-based diets. | General |
| Days before the period | `calcium` | Bertone-Johnson et al. 2005, *Arch Intern Med* 165:1246 (Nurses' Health Study II): highest food calcium RR 0.59 and vitamin D 0.70 for incident PMS. Plus the Thys-Jacobs 1998 trial. | Some |
| Days before the period | `carbs` | Carbohydrate cravings are common. Regular wholegrain meals are a common suggestion for steadier energy, but there are few trials. | Early |
| Any day (general) | `iron`, `calcium` | As above. | Strong / Some |

### Supplements (owner: include them, with how well supported each one is)

| Supplement | Shown in | Evidence | Grade |
| --- | --- | --- | --- |
| Ginger powder | Period | Daily et al. 2015, *Pain Medicine* 16:2243: 4 placebo RCTs, 750–2,000 mg/day in the first 3–4 days, less pain. 2024 review (*J Integr Complement Med*, 24 studies): pain intensity SMD −1.13 against placebo, no difference from NSAIDs. Trials were small, with high heterogeneity, and one 2015 author is a supplement maker. | Some |
| Omega-3 (fish oil) | Period | 2024 review (*Nutrition & Dietetics*, 12 studies, 881 women): 300–1,800 mg/day for 2–3 months, pain d −1.02. Another meta-analysis calls the effect "mild". | Some |
| Zinc | Period | Hsu et al. 2024, *Nutrients* 16:4116: 6 RCTs, 739 women, pain reduced. Doses varied; one trial gave 40 mg/day zinc sulfate to 103 high-school students. NHMRC upper limit 40 mg/day; long-term excess lowers copper. | Some |
| Calcium | Days before the period | Thys-Jacobs et al. 1998, *AJOG* 179:444: 1,200 mg/day calcium carbonate for 3 cycles, 466 analysed, larger fall in symptom scores than with placebo. The placebo group also improved a lot, and the trial was part-funded by a calcium-product maker. | Some |
| Vitamin B6 | Days before the period | Wyatt et al. 1999, *BMJ* 318:1375: 9 trials, some benefit, poor quality. Safety: the TGA has required a peripheral-neuropathy warning above 10 mg/day since March 2023, with harm reported below 50 mg/day, often from several products together. | Early |
| Magnesium | Days before the period | Small, older trials (28–38 women) reported benefit; one found none. Observational review (13 studies) inconclusive. | Early |

Still rejected, recorded in D-107:

- **Calorie figures.** Includes the roughly 170 kcal/day luteal intake difference. Such figures harm people with disordered eating, and teens are in scope (RED-S literature).
- **"Cycle syncing" training plans.** No phase effect on performance or adaptation (2023 reviews).
- **Supplements for under-18s.** Hidden by the teen-mode constant.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/mobile/src/features/guidance/guidance.ts` (create) | Types, the `GUIDANCE` evidence table with supplements, `SUPPLEMENTS_FOR_TEENS`, `showSupplements()` and `phaseOn()`. Pure. |
| `apps/mobile/src/features/guidance/guidance.test.ts` (create) | `phaseOn` cases, copy-key existence, word guard |
| `apps/mobile/src/features/guidance/GuidanceCard.tsx` (create) | Card, short and full |
| `copy/en-AU.json` (modify) | `guidance.*`, `log.energy*`, `day.entry.energy`, `insights.energy.*`, `settings.tracking.guidance*` |
| `apps/mobile/src/data/prefs.ts`, `apps/mobile/src/app/settings/tracking.tsx` (modify) | `cycleGuidance` preference and its switch |
| `apps/mobile/src/app/(tabs)/today.tsx`, `apps/mobile/src/app/day/[date].tsx` (modify) | Render the card |
| `apps/mobile/src/data/events.ts`, `project.ts`, `store.ts`, `exportImport.ts` (modify) | `energy` event: validation, projection, persistence, export |
| `apps/mobile/src/data/migrations/004_daily_log_energy.ts` (create), `migrations/index.ts` (modify) | `daily_log.energy` column |
| `apps/mobile/src/features/logging/actions.ts`, `describe.ts`, `LogSheet.tsx` (modify) | `setEnergy`, `energyDays`, day screen line, Energy row in the sheet |
| `apps/mobile/src/features/insights/energyModel.ts` (create) + test | Window, averages per phase, suggestions |
| `apps/mobile/src/features/insights/charts.tsx`, `apps/mobile/src/app/(tabs)/insights.tsx` (modify) | `EnergyChart` and the Energy card |
| `apps/mobile/src/features/dev/scenarios.ts` (modify) | `energy` scenario |
| `apps/mobile/src/features/teen/teenAudit.test.ts` (modify) | Teen copy and supplement checks |
| `.maestro/today.yaml`, `calendar.yaml`, `logging.yaml`, `insights.yaml` (modify) | On-device checks |
| `docs/DECISIONS.md`, `BACKLOG.md`, `PLAN.md` §5.3 and §11.1, `regulatory/risk-register.md`, `i18n/strings-for-translation.csv` (modify) | Records |

---

## Task 0: Coordinate with peer sessions

Other Claude sessions may share this checkout (memory: "side-by-side sessions").

- [ ] **Step 1:** Run `git reset -q && git status --short` and `ListAgents`.
- [ ] **Step 2:** Check that the ids are free.

  | Command | Expected output |
  | --- | --- |
  | `grep -o "D-1[0-9][0-9]" docs/DECISIONS.md \| sort -u \| tail -1` | `D-106` |
  | `grep -o "P8-[0-9]*" docs/BACKLOG.md \| sort -t- -k2 -n \| tail -1` | `P8-17` |
  | `grep -o "RK-[0-9]*" docs/regulatory/risk-register.md \| tail -1` | `RK-24` |
  | `ls apps/mobile/src/data/migrations` | highest is `003_…` |

  If any id is taken, use the next free one everywhere. Announce D-107, D-108, P8-18, P8-19, RK-25–28 and migration 004 to peers with `SendMessage` before you write them.
- [ ] **Step 3:** If a peer has uncommitted edits in a file this plan touches, ask the peer to commit first. Otherwise commit only your own hunks through a temporary index, as the memory describes.
- [ ] **Step 4:** Wrap every Maestro run in the simulator lock, and use the dev client:

```bash
cd apps/mobile && until mkdir /tmp/sanguine-sim.lock 2>/dev/null; do sleep 5; done; trap 'rmdir /tmp/sanguine-sim.lock' EXIT; CLIENT=dev .maestro/run.sh ios today.yaml
```

  After a failed run, read your `/tmp/maestro-debug-ios-*` folder, then delete it: the disk is tight.

---

# Part A: Food, movement and supplement notes (P8-18)

## Task 1: `phaseOn`, the evidence table and the supplement gate

**Files:**
- Create: `apps/mobile/src/features/guidance/guidance.ts`
- Test: `apps/mobile/src/features/guidance/guidance.test.ts`

**Interfaces:**
- Consumes:
  - `addDays`, `diffDays`, `LUTEAL_PRIOR`, `type CycleRecord`, `type ISODate`, `type Prediction` from `@sanguine/engine`
  - `ovulationUncertain` from `@/features/today/fertileShown`
- Produces:
  - `export type GuidePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'premenstrual' | 'general'`
  - `export type Evidence = 'strong' | 'some' | 'early' | 'general'`
  - `export type SuppId = 'ginger' | 'omega3' | 'zinc' | 'calcium' | 'b6' | 'magnesium'`
  - `export type FoodId = 'iron' | 'omega3' | 'vitaminC' | 'bVitamins' | 'zinc' | 'fibre' | 'vitaminDB6' | 'protein' | 'magnesium' | 'b12' | 'calcium' | 'carbs'`
  - `export interface GuideDay { phase: GuidePhase; expected: boolean }`, where `expected` is true for a future date
  - `export const GUIDE_PHASES: readonly GuidePhase[]`
  - `export const GUIDANCE: Record<GuidePhase, { foods: ReadonlyArray<{ id: FoodId; evidence: Evidence }>; move: Evidence; supps: ReadonlyArray<{ id: SuppId; evidence: Evidence }> }>`
  - `export const SUPPLEMENTS_FOR_TEENS = false`
  - `export function showSupplements(teen: boolean): boolean`
  - `export interface PhaseOnInput { date: ISODate; today: ISODate; prediction: Prediction | undefined; cycles: CycleRecord[]; showEstimate: boolean }`
  - `export function phaseOn(i: PhaseOnInput): GuideDay | undefined`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/mobile/src/features/guidance/guidance.test.ts
import { type CycleRecord, diffDays, type ISODate, type Prediction } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { GUIDANCE, phaseOn, type PhaseOnInput, showSupplements } from './guidance';

const TODAY = '2026-10-14'; // cycle day 11 of the open cycle
const rec = (start: ISODate, nextStart?: ISODate, extra: Partial<CycleRecord> = {}): CycleRecord =>
  ({ id: start, start, quality: 'valid', ...(nextStart ? { nextStart, length: diffDays(nextStart, start) } : {}), ...extra }) as CycleRecord;
const CYCLES: CycleRecord[] = [
  rec('2026-08-08', '2026-09-05'), // 28 days, bleed end not logged
  rec('2026-09-05', '2026-10-04', { end: '2026-09-08' }), // 29 days, no biomarker
  rec('2026-10-04', undefined, { end: '2026-10-07' }), // open
];
const pred = (over: Partial<Prediction> = {}): Prediction => ({
  engineVersion: 'test', asOf: TODAY, flags: [], cycleQuality: [],
  cycleLength: { mean: 28.5, sd: 2, nu: 5, scale: 2, nCyclesUsed: 2 },
  nextPeriod: { point: '2026-11-01', i80: { lo: '2026-10-30', hi: '2026-11-03' }, i95: { lo: '2026-10-28', hi: '2026-11-05' }, confidence: 'medium', daysOfDataUsed: 60 },
  ovulation: { point: '2026-10-19', i80: { lo: '2026-10-15', hi: '2026-10-23' }, sd: 3, confidence: 'low', basis: 'calendar' },
  currentPhase: { phase: 'follicular', dayOfCycle: 11 },
  ...over,
}) as Prediction;
const on = (date: ISODate, over: Partial<PhaseOnInput> = {}) =>
  phaseOn({ date, today: TODAY, prediction: pred(), cycles: CYCLES, showEstimate: true, ...over });

describe('phaseOn, open cycle', () => {
  it('today, cycle day 11, is follicular', () => expect(on(TODAY)).toEqual({ phase: 'follicular', expected: false }));
  it('a logged bleeding day is menstrual', () => expect(on('2026-10-05')?.phase).toBe('menstrual'));
  it('ovulation day and one day either side are ovulatory, and future days are expected', () => {
    expect(on('2026-10-17')?.phase).toBe('follicular');
    for (const d of ['2026-10-18', '2026-10-19', '2026-10-20']) expect(on(d)).toEqual({ phase: 'ovulatory', expected: true });
    expect(on('2026-10-21')?.phase).toBe('luteal');
  });
  it('the 5 days before the most likely next start are premenstrual', () => {
    expect(on('2026-10-26')?.phase).toBe('luteal');
    expect(on('2026-10-27')?.phase).toBe('premenstrual');
  });
  it('a future day inside the 80% period range is an expected period day', () =>
    expect(on('2026-10-31')).toEqual({ phase: 'menstrual', expected: true }));
  it('a future day past the 80% range gets no card', () => expect(on('2026-11-04')).toBeUndefined());
  it('late: today past the 80% range gives general', () =>
    expect(on('2026-11-05', { today: '2026-11-05' })).toEqual({ phase: 'general', expected: false }));
  it('a hidden estimate (teen mode) folds ovulatory into follicular or luteal', () => {
    expect(on('2026-10-18', { showEstimate: false })?.phase).toBe('follicular');
    expect(on('2026-10-19', { showEstimate: false })?.phase).toBe('luteal');
    for (let i = 0; i < 40; i++) {
      const d = new Date(Date.UTC(2026, 9, 4 + i)).toISOString().slice(0, 10);
      expect(on(d, { showEstimate: false })?.phase).not.toBe('ovulatory');
    }
  });
  it('uncertain ovulation gives general on non-period days and keeps period days', () => {
    const p = pred({ ovulation: { point: '2026-10-19', i80: { lo: '2026-10-08', hi: '2026-10-29' }, sd: 7, confidence: 'low', basis: 'calendar' } });
    expect(on(TODAY, { prediction: p })?.phase).toBe('general');
    expect(on('2026-10-05', { prediction: p })?.phase).toBe('menstrual');
    expect(on('2026-10-31', { prediction: p })).toEqual({ phase: 'menstrual', expected: true });
  });
  it('no ovulation estimate gives general', () => {
    const { ovulation: _o, ...rest } = pred();
    expect(on(TODAY, { prediction: rest as Prediction })?.phase).toBe('general');
  });
});

describe('phaseOn, past cycles', () => {
  it('counts back the luteal prior from the next start when there is no biomarker (29 d cycle: ovulation offset 16)', () => {
    expect(on('2026-09-19')?.phase).toBe('follicular');
    expect(on('2026-09-21')).toEqual({ phase: 'ovulatory', expected: false });
    expect(on('2026-09-23')?.phase).toBe('luteal');
    expect(on('2026-09-28')?.phase).toBe('luteal');
    expect(on('2026-09-29')?.phase).toBe('premenstrual');
  });
  it('uses a biomarker ovulation when the cycle has one', () => {
    const cycles = [CYCLES[0]!, { ...CYCLES[1]!, ovulation: { point: '2026-09-18', offset: 13, sd: 1, basis: 'lh' as const } }, CYCLES[2]!];
    expect(on('2026-09-18', { cycles })?.phase).toBe('ovulatory');
    expect(on('2026-09-21', { cycles })?.phase).toBe('luteal');
  });
  it('an unlogged bleed end counts as 5 days', () => {
    expect(on('2026-08-12')?.phase).toBe('menstrual');
    expect(on('2026-08-13')?.phase).not.toBe('menstrual');
  });
  it('a merged cycle (suspect_skip) gives general, a life-state cycle gives no card', () => {
    const skip = [{ ...CYCLES[0]!, quality: 'suspect_skip' as const }, CYCLES[1]!, CYCLES[2]!];
    expect(on('2026-08-25', { cycles: skip })?.phase).toBe('general');
    const life = [{ ...CYCLES[0]!, quality: 'life_state' as const }, CYCLES[1]!, CYCLES[2]!];
    expect(on('2026-08-09', { cycles: life })).toBeUndefined();
  });
});

describe('phaseOn, no card', () => {
  it('while prediction is suspended, even on a period day', () =>
    expect(on('2026-10-05', { prediction: pred({ suspended: { reason: 'pregnant' } }) })).toBeUndefined());
  it('with no prediction', () => expect(on(TODAY, { prediction: undefined })).toBeUndefined());
  it('before the first logged period', () => expect(on('2026-08-01')).toBeUndefined());
  it('does not depend on the order of the cycle records', () =>
    expect(on('2026-09-29', { cycles: [...CYCLES].reverse() })?.phase).toBe('premenstrual'));
});

describe('foods', () => {
  it('several foods per phase, as the owner listed them (message 5)', () => {
    const ids = (p: keyof typeof GUIDANCE) => GUIDANCE[p].foods.map((f) => f.id);
    expect(ids('menstrual')).toEqual(['iron', 'omega3']);
    expect(ids('follicular')).toEqual(['vitaminC', 'bVitamins', 'zinc']);
    expect(ids('ovulatory')).toEqual(['fibre', 'vitaminDB6']);
    expect(ids('luteal')).toEqual(['protein', 'magnesium', 'b12']);
    expect(ids('premenstrual')).toEqual(['calcium', 'carbs']);
    expect(ids('general')).toEqual(['iron', 'calcium']);
  });
  it('only iron and vitamin C are graded strong; fibre is early because the one cohort found lower hormones', () => {
    const all = Object.values(GUIDANCE).flatMap((g) => g.foods);
    expect([...new Set(all.filter((f) => f.evidence === 'strong').map((f) => f.id))].sort()).toEqual(['iron', 'vitaminC']);
    expect(GUIDANCE.ovulatory.foods.find((f) => f.id === 'fibre')?.evidence).toBe('early');
  });
});

describe('supplements', () => {
  it('ginger, omega-3 and zinc for the period; calcium, B6 and magnesium before it; none elsewhere', () => {
    expect(GUIDANCE.menstrual.supps.map((s) => s.id)).toEqual(['ginger', 'omega3', 'zinc']);
    expect(GUIDANCE.premenstrual.supps.map((s) => s.id)).toEqual(['calcium', 'b6', 'magnesium']);
    for (const p of ['follicular', 'ovulatory', 'luteal', 'general'] as const) expect(GUIDANCE[p].supps).toEqual([]);
  });
  it('no supplement is graded strong, and B6 and magnesium are early', () => {
    const all = Object.values(GUIDANCE).flatMap((g) => g.supps);
    expect(all.filter((s) => s.evidence === 'strong')).toEqual([]);
    expect(all.filter((s) => s.id === 'b6' || s.id === 'magnesium').map((s) => s.evidence)).toEqual(['early', 'early']);
  });
  it('are hidden for under-18s and shown to adults', () => {
    expect(showSupplements(true)).toBe(false);
    expect(showSupplements(false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests and check that they fail**

Run: `pnpm vitest run apps/mobile/src/features/guidance/guidance.test.ts`
Expected: FAIL with "Failed to resolve import './guidance'".

- [ ] **Step 3: Write the implementation**

```ts
// apps/mobile/src/features/guidance/guidance.ts
// Food, movement and supplement notes by cycle phase (P8-18, D-107). Pure: which phase a date sits in, and how strong each note's evidence is.
// Wording: copy/en-AU.json guidance.*. Research: docs/superpowers/plans/2026-10-14-cycle-food-movement-notes.md.
import { addDays, type CycleRecord, diffDays, type ISODate, LUTEAL_PRIOR, type Prediction } from '@sanguine/engine';
import { ovulationUncertain } from '@/features/today/fertileShown';

export type GuidePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'premenstrual' | 'general';
export type Evidence = 'strong' | 'some' | 'early' | 'general';
export type SuppId = 'ginger' | 'omega3' | 'zinc' | 'calcium' | 'b6' | 'magnesium';
export type FoodId = 'iron' | 'omega3' | 'vitaminC' | 'bVitamins' | 'zinc' | 'fibre' | 'vitaminDB6' | 'protein' | 'magnesium' | 'b12' | 'calcium' | 'carbs';
export interface GuideDay { phase: GuidePhase; expected: boolean }
export interface PhaseOnInput {
  date: ISODate;
  today: ISODate;
  prediction: Prediction | undefined;
  /** analyzeCycles(history, settings).map((c) => c.record): carries nextStart, quality and biomarker ovulation. */
  cycles: CycleRecord[];
  /** Effective ovulation-estimate preference (teen mode and SHOW_OVULATION_ESTIMATE folded in). Off: no ovulatory phase. */
  showEstimate: boolean;
}

export const GUIDE_PHASES: readonly GuidePhase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal', 'premenstrual', 'general'];
type Graded<T> = ReadonlyArray<{ id: T; evidence: Evidence }>;
/** Evidence grade per food note, movement note and supplement; the plan's research tables justify each one. */
export const GUIDANCE: Record<GuidePhase, { foods: Graded<FoodId>; move: Evidence; supps: Graded<SuppId> }> = {
  menstrual: {
    foods: [{ id: 'iron', evidence: 'strong' }, { id: 'omega3', evidence: 'early' }], move: 'strong',
    supps: [{ id: 'ginger', evidence: 'some' }, { id: 'omega3', evidence: 'some' }, { id: 'zinc', evidence: 'some' }],
  },
  follicular: { foods: [{ id: 'vitaminC', evidence: 'strong' }, { id: 'bVitamins', evidence: 'early' }, { id: 'zinc', evidence: 'early' }], move: 'strong', supps: [] },
  ovulatory: { foods: [{ id: 'fibre', evidence: 'early' }, { id: 'vitaminDB6', evidence: 'early' }], move: 'some', supps: [] },
  luteal: { foods: [{ id: 'protein', evidence: 'early' }, { id: 'magnesium', evidence: 'early' }, { id: 'b12', evidence: 'general' }], move: 'strong', supps: [] },
  premenstrual: {
    foods: [{ id: 'calcium', evidence: 'some' }, { id: 'carbs', evidence: 'early' }], move: 'strong',
    supps: [{ id: 'calcium', evidence: 'some' }, { id: 'b6', evidence: 'early' }, { id: 'magnesium', evidence: 'early' }],
  },
  general: { foods: [{ id: 'iron', evidence: 'strong' }, { id: 'calcium', evidence: 'some' }], move: 'strong', supps: [] },
};

/** D-107: supplements are hidden under 18, and the teen estimate unlock does not change that (conservative default, no clinician). */
export const SUPPLEMENTS_FOR_TEENS = false;
export const showSupplements = (teen: boolean): boolean => !teen || SUPPLEMENTS_FOR_TEENS;

/** Days before the most likely next start that count as premenstrual (Draper 2018's fifth phase). */
export const PREMENSTRUAL_DAYS = 5;
// ponytail: these two mirror private constants in packages/engine/src/predict.ts; this feature must not touch the engine
const OVULATORY_HALF_WINDOW = 1;
const BLEED_DAYS_IF_UNLOGGED = 5;

export function phaseOn({ date, today, prediction: p, cycles, showEstimate }: PhaseOnInput): GuideDay | undefined {
  if (!p || p.suspended) return undefined;
  let cycle: CycleRecord | undefined;
  for (const c of cycles) if (c.start <= date && (!cycle || c.start > cycle.start)) cycle = c;
  if (!cycle || cycle.quality === 'life_state') return undefined;
  const expected = date > today;
  const at = (phase: GuidePhase): GuideDay => ({ phase, expected });
  if (date <= (cycle.end ?? addDays(cycle.start, BLEED_DAYS_IF_UNLOGGED - 1))) return at('menstrual');

  let nextStart: ISODate;
  let ovulationDay: ISODate;
  if (cycle.nextStart) {
    if (cycle.quality !== 'valid') return at('general');
    nextStart = cycle.nextStart;
    ovulationDay = cycle.ovulation?.point ?? addDays(cycle.start, Math.round(diffDays(nextStart, cycle.start) - LUTEAL_PRIOR.m0 - 1)); // §4.5 offset m − ℓ − 1
  } else {
    const next = p.nextPeriod;
    if (!next || date > next.i80.hi) return expected ? undefined : at('general'); // late, or beyond the forecast
    if (expected && date >= next.i80.lo) return at('menstrual');
    if (!p.ovulation || ovulationUncertain(p)) return at('general');
    nextStart = next.point;
    ovulationDay = p.ovulation.point;
  }
  if (date >= addDays(nextStart, -PREMENSTRUAL_DAYS)) return at('premenstrual');
  const d = diffDays(date, ovulationDay);
  if (Math.abs(d) <= OVULATORY_HALF_WINDOW && showEstimate) return at('ovulatory');
  return at(d < 0 ? 'follicular' : 'luteal');
}
```

- [ ] **Step 4: Run the tests and the type-check, and check that they pass**

Run: `pnpm vitest run apps/mobile/src/features/guidance/guidance.test.ts && pnpm --filter @sanguine/mobile typecheck`
Expected: PASS, with no type errors. If a case fails, fix `phaseOn`, not the test.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/guidance/guidance.ts apps/mobile/src/features/guidance/guidance.test.ts
git commit -m "P8-18 phaseOn and the evidence table: guide phase for any day, graded foods, movement and supplements, supplements hidden under 18 (D-107)"
```

---

## Task 2: Copy and the guards on it

**Files:**
- Modify: `copy/en-AU.json`. Add a top-level `"guidance"` object, and two keys in `settings.tracking`.
- Modify: `apps/mobile/src/features/guidance/guidance.test.ts` (append)
- Modify: `apps/mobile/src/features/teen/teenAudit.test.ts` (append)

**Interfaces:**
- Consumes: `GUIDE_PHASES`, `GUIDANCE` (Task 1).
- Produces these copy keys:
  - `guidance.{title,phaseLine,phaseExpected,foodLabel,moveLabel,bodyLabel,sourcesLabel,suppLabel,suppCaveat,caveat,more,moreA11y,energyLow}`
  - `guidance.phase.<phase>` and `guidance.phaseIn.<phase>`
  - `guidance.evidence.<grade>`
  - `guidance.<phase>.{body,sources}`, `guidance.<phase>.move.{tip,why}`
  - `guidance.food.<id>.{tip,why}`
  - `guidance.supp.<id>.{tip,why}`
  - `settings.tracking.{guidance,guidanceDesc}`

- [ ] **Step 1: Write the failing tests.**
  - Put the imports at the top of each file. Biome rejects duplicate import lines.
    - `guidance.test.ts`: add `import en from '../../../../../copy/en-AU.json';`, and add `GUIDE_PHASES` to the existing `./guidance` import.
    - `teenAudit.test.ts`: add `import en from '../../../../../copy/en-AU.json';` and `import { GUIDANCE, GUIDE_PHASES } from '@/features/guidance/guidance';`.
  - Then append these blocks.

`guidance.test.ts`:

```ts
const get = (path: string): unknown => path.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown> | undefined)?.[k], en);
const allStrings = (n: unknown): string[] => (typeof n === 'string' ? [n] : n && typeof n === 'object' ? Object.values(n).flatMap(allStrings) : []);

describe('guidance copy', () => {
  it('every phase has body, sources and movement; every food, supplement and grade has its words', () => {
    for (const ph of GUIDE_PHASES) {
      for (const k of ['body', 'sources', 'move.tip', 'move.why']) expect(get(`guidance.${ph}.${k}`), `${ph}.${k}`).toMatch(/\S/);
      expect(get(`guidance.phase.${ph}`)).toMatch(/\S/);
      expect(get(`guidance.phaseIn.${ph}`)).toMatch(/\S/);
      const g = GUIDANCE[ph];
      for (const e of [g.move, ...g.foods.map((f) => f.evidence), ...g.supps.map((s) => s.evidence)]) expect(get(`guidance.evidence.${e}`)).toMatch(/\S/);
      for (const f of g.foods) for (const k of ['tip', 'why']) expect(get(`guidance.food.${f.id}.${k}`), `food.${f.id}.${k}`).toMatch(/\S/);
      for (const s of g.supps) for (const k of ['tip', 'why']) expect(get(`guidance.supp.${s.id}.${k}`), `supp.${s.id}.${k}`).toMatch(/\S/);
    }
  });
  it('every food note names example foods and an example meal or snack (owner, message 5)', () => {
    for (const id of Object.keys(get('guidance.food') as object)) expect(get(`guidance.food.${id}.tip`), id).toMatch(/for example/i);
  });
  it('names no calorie, weight, fast, cleanse, restriction or cure (D-107)', () => {
    const banned = /calori|kilojoule|\bkJ\b|\bweight\b|detox|cleanse|fasting|restrict|cut out|\bburn\b|\bcures?\b/i;
    expect(allStrings(get('guidance')).filter((s) => banned.test(s))).toEqual([]);
  });
  it('the B6 note carries the nerve warning wherever it shows', () => {
    expect(get('guidance.supp.b6.tip')).toMatch(/tingling, burning or numbness/);
  });
});
```

`teenAudit.test.ts`:

```ts
describe('food and movement notes (P8-18)', () => {
  it('nothing a teen can reach uses fertility words; teens see no supplement copy', () => {
    const g = (en as unknown as { guidance: Record<string, unknown> & { food: Record<string, unknown> } }).guidance;
    const words = (n: unknown): string => (typeof n === 'string' ? n : n && typeof n === 'object' ? Object.values(n).map(words).join(' ') : '');
    // teens never reach the ovulatory phase (phaseOn folds it), so its notes and foods may name ovulation
    for (const ph of GUIDE_PHASES.filter((p) => p !== 'ovulatory')) {
      expect(words(g[ph]), ph).not.toMatch(/ovulat|fertil|pregnan/i);
      for (const f of GUIDANCE[ph].foods) expect(words(g.food[f.id]), f.id).not.toMatch(/ovulat|fertil|pregnan/i);
    }
    // phase names and "phaseIn" hold the ovulatory label teens never reach; supp* is hidden from teens (SUPPLEMENTS_FOR_TEENS)
    const skip = new Set<string>([...GUIDE_PHASES, 'phase', 'phaseIn', 'food', 'supp', 'suppLabel', 'suppCaveat']);
    expect(words(Object.fromEntries(Object.entries(g).filter(([k]) => !skip.has(k))))).not.toMatch(/ovulat|fertil|pregnan/i);
  });
});
```

- [ ] **Step 2: Run the tests and check that they fail**

Run: `pnpm vitest run apps/mobile/src/features/guidance apps/mobile/src/features/teen`
Expected: FAIL, because `guidance.menstrual.body` is undefined.

- [ ] **Step 3: Add the copy.** Add this top-level object to `copy/en-AU.json`, word for word. Then add the two `settings.tracking` keys after `symptomNoteDesc`.

```json
"guidance": {
  "title": "Food and movement",
  "phaseLine": "{phase} · estimate",
  "phaseExpected": "{phase} · expected",
  "foodLabel": "Food",
  "moveLabel": "Movement",
  "bodyLabel": "What is changing",
  "sourcesLabel": "Sources",
  "suppLabel": "Supplements with some research",
  "suppCaveat": "Supplements are not tested like medicines and can interact with them. A pharmacist or doctor can check one with you before you start, especially if you take other medicines.",
  "more": "Why these notes",
  "moreA11y": "Open the day screen with the reasons and sources for these notes",
  "energyLow": "In your own logs, your energy was lowest in this part of your cycle. Movement lifts energy for most people, even a short walk.",
  "caveat": "Research on eating and training by cycle phase is young, and how you feel is a better guide than the calendar. This is general information, not medical advice.",
  "phase": {
    "menstrual": "Period",
    "follicular": "Follicular phase",
    "ovulatory": "Around ovulation",
    "luteal": "Luteal phase",
    "premenstrual": "Days before your period",
    "general": "Any day of the cycle"
  },
  "phaseIn": {
    "menstrual": "during your period",
    "follicular": "in the follicular phase",
    "ovulatory": "around ovulation",
    "luteal": "in the luteal phase",
    "premenstrual": "in the days before your period",
    "general": "on days Sanguine could not place"
  },
  "evidence": {
    "strong": "Strong evidence",
    "some": "Some evidence",
    "early": "Early evidence",
    "general": "General guidance, not specific to this phase"
  },
  "menstrual": {
    "body": "Estrogen and progesterone are at their lowest, and bleeding carries iron out of the body. In a study that tracked 397 substances in the blood and urine of 34 women across the cycle, amino acids and vitamin D were higher during the period than in the second half of the cycle.",
    "move": {
      "tip": "Any movement that feels good, such as a walk, a swim, yoga or your usual training, can lift your mood and energy. Rest is fine too.",
      "why": "Reviews of more than 1,000 trials find that exercise improves mood and energy, and a single session lifts mood on average. In smaller trials, regular exercise also eased period pain."
    },
    "sources": "NHMRC Nutrient Reference Values: iron. Singh and others 2023, British Journal of Sports Medicine. Weinstein and others 2024, Psychosomatic Medicine. Armour and others 2019, Cochrane review of exercise for period pain. Daily and others 2015, Pain Medicine (ginger). 2024 reviews of ginger and of omega-3 for period pain. Hsu and others 2024, Nutrients (zinc). Draper and others 2018, Scientific Reports."
  },
  "follicular": {
    "body": "After the period, estrogen rises as a follicle grows in the ovary. In the same study, amino acids and fats in the blood were higher in this phase than in the second half of the cycle.",
    "move": {
      "tip": "Exercise lifts mood and energy. If you feel energetic, this can be a good time to try harder sessions.",
      "why": "Reviews of more than 1,000 trials find that exercise improves mood and energy. Performance itself differs little between phases, so let how you feel decide how hard to go."
    },
    "sources": "NHMRC Nutrient Reference Values (iron, zinc). Chocano-Bedoya and others 2011, American Journal of Clinical Nutrition (B vitamins). Hsu and others 2024, Nutrients (zinc). Singh and others 2023, British Journal of Sports Medicine. Wender and others 2022, Frontiers in Psychology. McNulty and others 2020, Sports Medicine. Draper and others 2018, Scientific Reports."
  },
  "ovulatory": {
    "body": "Estrogen peaks and a surge of luteinising hormone triggers ovulation. In the same study, vitamin D and a marker of vitamin B6 were lower around ovulation than during the period.",
    "move": {
      "tip": "Train as usual, and warm up well before sports with jumping, landing and quick changes of direction.",
      "why": "Knee ligaments loosen slightly around this time in some studies, but reviews find no phase with clearly more knee injuries. Warm-up programmes halve knee ligament injuries at any time of the cycle."
    },
    "sources": "Draper and others 2018, Scientific Reports. Gaskins and others 2009, American Journal of Clinical Nutrition (fibre). Systematic review of cycle phase and knee injury measures, 2022. Webster and Hewett 2018, Journal of Orthopaedic Research."
  },
  "luteal": {
    "body": "Progesterone rises and body temperature goes up by a few tenths of a degree. In the same study, 39 amino acids and 18 fats in the blood were lower in this phase, and so was serotonin, a messenger linked to mood. The authors suggest the body is using the amino acids and fats to build tissue, including the lining of the uterus.",
    "move": {
      "tip": "Keep moving: exercise lifts mood and energy. In warm weather, drink regularly and give yourself more time to cool down.",
      "why": "Reviews of more than 1,000 trials find that exercise improves mood, and a single session lifts it on average. Progesterone raises core temperature and the temperature at which sweating starts by about half a degree."
    },
    "sources": "Draper and others 2018, Scientific Reports. Kriengsinyos and others 2004, American Journal of Physiology. NHMRC Nutrient Reference Values (magnesium, B12). Tucker and others 2024, Nutrition Reviews. Benton and others 2020, PLoS ONE. Singh and others 2023, British Journal of Sports Medicine. Weinstein and others 2024, Psychosomatic Medicine. Gatorade Sports Science Institute review of hydration in active women."
  },
  "premenstrual": {
    "body": "Progesterone and estrogen fall in the days before the period. Many women notice lower mood, bloating, cravings or lighter sleep in these days.",
    "move": {
      "tip": "When your mood or energy is low, a walk, a bike ride, a swim, yoga or a dance class can lift it. A regular wind-down before bed can help with sleep.",
      "why": "Reviews of more than 1,000 trials find that exercise improves mood, and walking, yoga and strength training do especially well. In a review of 15 trials, women who exercised also reported fewer premenstrual symptoms."
    },
    "sources": "Singh and others 2023, British Journal of Sports Medicine. Noetel and others 2024, BMJ. Pearce and others 2020, BJGP Open. Bertone-Johnson and others 2005, Archives of Internal Medicine (calcium from food). Thys-Jacobs and others 1998, American Journal of Obstetrics and Gynecology. Wyatt and others 1999, BMJ (vitamin B6). TGA safety alert on vitamin B6, 2023. Baker and Driver 2007, Sleep Medicine."
  },
  "general": {
    "body": "Sanguine cannot place this day in a phase with enough confidence, for example when cycles vary a lot or a period is later than expected. These notes hold for any day of the cycle.",
    "move": {
      "tip": "Regular activity on most days, with muscle-strengthening at least twice a week. On low days, even a short walk helps.",
      "why": "This is Australia's physical activity guideline. Reviews of more than 1,000 trials find that exercise improves mood and energy."
    },
    "sources": "Australian Dietary Guidelines 2013. NHMRC Nutrient Reference Values. Australia's Physical Activity and Sedentary Behaviour Guidelines. Singh and others 2023, British Journal of Sports Medicine. Wender and others 2022, Frontiers in Psychology."
  },
  "food": {
    "iron": {
      "tip": "Iron-rich foods, such as red meat, chicken, fish, lentils, tofu or leafy greens, with vitamin C from citrus, capsicum or tomato in the same meal. For example: a beef and broccoli stir-fry, lentil dahl with a squeeze of lemon, or a spinach and chickpea curry with tomatoes.",
      "why": "Monthly bleeding is why women aged 19 to 50 need 18 mg of iron a day, against 8 mg for men. Vitamin C in the same meal helps the body absorb iron from plant foods."
    },
    "omega3": {
      "tip": "Omega-3 fats from oily fish such as salmon, sardines or mackerel, or from walnuts, chia and linseed. For example: sardines on wholegrain toast, or salmon with greens and rice.",
      "why": "Omega-3 is the fat tested in the period-pain trials, taken as a supplement (see below). Whether eating it as food eases pain is untested; fish twice a week fits general heart-health advice."
    },
    "vitaminC": {
      "tip": "Vitamin C from kiwifruit, oranges, strawberries, capsicum or broccoli, alongside iron-rich meals. For example: muesli with kiwifruit and yoghurt, or a chicken and capsicum stir-fry.",
      "why": "Vitamin C helps the body absorb iron from plant foods, which helps refill what the period used. No study shows a special need for it in this phase."
    },
    "bVitamins": {
      "tip": "Foods rich in B vitamins, especially riboflavin and thiamine, such as milk, yoghurt, eggs, wholegrain cereals, legumes, mushrooms and leafy greens. For example: porridge made with milk, or eggs and mushrooms on wholegrain toast.",
      "why": "In a 10-year study of more than 3,000 nurses, women who got the most riboflavin (B2) and thiamine (B1) from food were 25 to 35% less likely to develop premenstrual symptoms. B vitamins from tablets showed no such link, the study only observed, and nobody has tested whether timing in the cycle matters."
    },
    "zinc": {
      "tip": "Zinc from beef, chicken, oysters, pumpkin seeds, chickpeas or cashews. For example: a chicken and chickpea salad topped with pumpkin seeds, or a beef burrito bowl.",
      "why": "Zinc helps cells grow and repair, and women need 8 mg a day. In 6 small trials, zinc supplements eased period pain. Nobody has tested whether eating more zinc at this time of the cycle helps."
    },
    "fibre": {
      "tip": "Fibre-rich foods such as oats, legumes, vegetables, wholegrains and fruit with the skin on. For example: overnight oats with berries, or a bean and vegetable soup.",
      "why": "Fibre helps the body clear estrogen through the gut, which is the idea behind eating more of it around the estrogen peak. But in a study of 250 women, those who ate the most fibre had lower hormone levels and more cycles without ovulation, so more is not always better. Fibre's everyday benefits for the gut are well established."
    },
    "vitaminDB6": {
      "tip": "Foods with vitamin D and vitamin B6, such as oily fish, eggs, chickpeas, potatoes and bananas. For example: a salmon and potato traybake, or a chickpea curry followed by a banana.",
      "why": "One small study found lower vitamin D and vitamin B6 markers around ovulation. Nobody has yet tested whether eating more of them at this time helps."
    },
    "protein": {
      "tip": "A source of protein at each meal, such as eggs, Greek yoghurt, fish, meat, tofu or legumes. For example: eggs on toast, Greek yoghurt with nuts, or a lentil and feta salad. Feeling hungrier in this phase is common.",
      "why": "Amino acids, the building blocks of protein, were lower in this phase, and a small study found a higher need for one of them. On average women eat a little more now, in step with a small rise in the energy the body uses at rest."
    },
    "magnesium": {
      "tip": "Magnesium from leafy greens, nuts, seeds, legumes, wholegrains and dark chocolate. For example: a handful of almonds, brown rice with black beans, or a spinach and pumpkin-seed salad.",
      "why": "Women need 310 to 320 mg a day. Small trials of magnesium supplements reported fewer premenstrual symptoms, but studies of magnesium from food are mixed."
    },
    "b12": {
      "tip": "Vitamin B12 from meat, fish, eggs and dairy, or from fortified plant milks and nutritional yeast if you eat a plant-based diet. For example: a tuna sandwich, or a smoothie made with fortified soy milk.",
      "why": "B12 is needed to make red blood cells, and running low causes tiredness. No study links B12 needs to this phase; it is here because it is easy to miss without animal foods."
    },
    "calcium": {
      "tip": "Calcium-rich foods such as milk, yoghurt, cheese, calcium-fortified soy drinks, tofu set with calcium or canned salmon with the bones. For example: yoghurt with fruit, a cheese and salad sandwich, or a tofu stir-fry.",
      "why": "In a 10-year study of more than 3,000 nurses, women who got the most calcium from food were about 40% less likely to develop premenstrual symptoms, and in a trial of 466 women calcium eased them more than a placebo did. Calcium also supports bone health at every age."
    },
    "carbs": {
      "tip": "Regular meals with slow-digesting carbohydrate, such as oats, brown rice, wholegrain bread, sweet potato or legumes. For example: a sweet potato and black bean bowl, or wholegrain toast with peanut butter.",
      "why": "Cravings for carbohydrate are common before a period. Regular wholegrain meals are a common suggestion for steadier energy and mood, but few trials have tested it."
    }
  },
  "supp": {
    "zinc": {
      "tip": "Zinc: in 6 small trials with 739 women, zinc supplements eased period pain.",
      "why": "A 2024 review pooled the trials. Doses varied widely; one trial gave 40 mg of zinc sulfate a day to 103 high-school students. More than 40 mg a day over a long time can lower copper levels."
    },
    "ginger": {
      "tip": "Ginger: in small trials, ginger powder taken in the first 3 to 4 days of the period eased period pain.",
      "why": "A 2024 review of 24 studies found less pain than with a placebo and no clear difference from anti-inflammatory pain relievers. Trials used 750 to 2,000 mg of ginger powder a day. The trials were small and their results varied."
    },
    "omega3": {
      "tip": "Omega-3 (fish oil): taken daily for 2 to 3 months, it eased period pain in small trials.",
      "why": "A 2024 review of 12 studies with 881 women found less period pain with 300 to 1,800 mg of omega-3 a day. Reviews disagree on how large the effect is."
    },
    "calcium": {
      "tip": "Calcium: in one large trial, a daily calcium supplement eased premenstrual symptoms. Calcium-rich foods count towards the same amount.",
      "why": "The trial gave 1,200 mg of calcium a day for three cycles to 466 women. Symptom scores fell more than with a placebo, though the placebo group also improved, and a maker of calcium products helped fund it."
    },
    "b6": {
      "tip": "Vitamin B6: small trials for premenstrual symptoms show mixed results. B6 can damage nerves, sometimes at under 50 mg a day: stop and see a doctor if you feel tingling, burning or numbness.",
      "why": "A review of 9 trials found some benefit, but the trials were of poor quality. Since 2023 the TGA has required a nerve warning on products with more than 10 mg a day. Several products can contain B6, also listed as pyridoxine, so check every label."
    },
    "magnesium": {
      "tip": "Magnesium: a few small, older trials reported fewer premenstrual symptoms; reviews call the evidence limited.",
      "why": "The trials had 28 to 38 women each, and another study found no benefit. Studies comparing blood magnesium in women with and without premenstrual symptoms are inconclusive."
    }
  }
}
```

In `settings.tracking`:

```json
"guidance": "Show food and movement notes",
"guidanceDesc": "On Today and the day screen, notes on food, exercise and supplements for each part of the cycle, with the research behind them and how strong it is."
```

- [ ] **Step 4: Run the tests and check that they pass**

Run: `pnpm vitest run apps/mobile/src/features/guidance apps/mobile/src/features/teen copy/copy.test.ts`
Expected: PASS. If `copy.test.ts` reports a forbidden word, reword that string so it keeps its meaning. Never add an exemption.

- [ ] **Step 5: Commit**

```bash
git add copy/en-AU.json apps/mobile/src/features/guidance/guidance.test.ts apps/mobile/src/features/teen/teenAudit.test.ts
git commit -m "P8-18 Food, movement-for-mood and supplement copy with evidence grades and sources; word guard and teen checks (D-107)"
```

---

## Task 3: `GuidanceCard`, the preference and the switch

**Files:**
- Create: `apps/mobile/src/features/guidance/GuidanceCard.tsx`
- Modify: `apps/mobile/src/data/prefs.ts`
- Modify: `apps/mobile/src/app/settings/tracking.tsx` (after the `track-symptom-note` row)

**Interfaces:**
- Consumes: `GuideDay`, `GUIDANCE` (Task 1); the copy (Task 2); `Card`, `Text`, `Button` from `@/ui`.
- Produces:
  - `export function GuidanceCard(props: { day: GuideDay; supplements: boolean; full?: boolean; onMore?: () => void; energyLow?: boolean })`
  - `Prefs.cycleGuidance: boolean`

- [ ] **Step 1: Add the preference.** In `prefs.ts`, after `symptomNote: boolean;` in `Prefs`, add:

```ts
  /** Food, movement and supplement notes on Today and the day screen (P8-18, D-107). */
  cycleGuidance: boolean;
```

  Then add `cycleGuidance: true,` after `symptomNote: true,` in `DEFAULT_PREFS`. `loadPrefs` spreads the defaults first, so no migration is needed.

- [ ] **Step 2: Add the switch.** In `tracking.tsx`, after the `track-symptom-note` row, add:

```tsx
        <SwitchRow testID="track-guidance" title={t('settings.tracking.guidance')} description={t('settings.tracking.guidanceDesc')} value={prefs.cycleGuidance} onChange={(v) => void updatePrefs({ cycleGuidance: v })} />
```

- [ ] **Step 3: Write the card**

```tsx
// apps/mobile/src/features/guidance/GuidanceCard.tsx
// Food, movement and supplement notes (P8-18, D-107). Every note shows its tip, reason and grade on both surfaces (owner: reasons on Today);
// the day screen adds what changes in the body and the sources.
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import { GUIDANCE, type GuideDay } from './guidance';

const label = { fontWeight: '600' as const };

export function GuidanceCard({ day, supplements, full = false, onMore, energyLow = false }: { day: GuideDay; supplements: boolean; full?: boolean; onMore?: () => void; energyLow?: boolean }) {
  const { t } = useTranslation();
  const p = day.phase;
  const supps = supplements ? GUIDANCE[p].supps : [];
  // one graded note: the tip, its reason, and how well supported it is
  const item = (testID: string, key: string, evidence: string) => (
    <View key={testID} testID={testID} style={{ gap: 2 }}>
      <Text>{t(`${key}.tip`)}</Text>
      <Text variant="bodySmall" color="textSecondary">{t(`${key}.why`)}</Text>
      <Text variant="caption" color="textSecondary">{t(`guidance.evidence.${evidence}`)}</Text>
    </View>
  );
  return (
    <Card testID="guidance-card" style={{ gap: 10 }}>
      <Text variant="heading" accessibilityRole="header">{t('guidance.title')}</Text>
      <Text variant="caption" color="textSecondary" testID={`guidance-phase-${p}`}>{t(day.expected ? 'guidance.phaseExpected' : 'guidance.phaseLine', { phase: t(`guidance.phase.${p}`) })}</Text>
      {energyLow ? <Text variant="bodySmall" testID="guidance-energy-low">{t('guidance.energyLow')}</Text> : null}
      {full ? (
        <View style={{ gap: 2 }}>
          <Text variant="bodySmall" style={label}>{t('guidance.bodyLabel')}</Text>
          <Text testID="guidance-body">{t(`guidance.${p}.body`)}</Text>
        </View>
      ) : null}
      <View testID="guidance-food" style={{ gap: 8 }}>
        <Text variant="bodySmall" style={label}>{t('guidance.foodLabel')}</Text>
        {GUIDANCE[p].foods.map((f) => item(`guidance-food-${f.id}`, `guidance.food.${f.id}`, f.evidence))}
      </View>
      <View testID="guidance-move" style={{ gap: 2 }}>
        <Text variant="bodySmall" style={label}>{t('guidance.moveLabel')}</Text>
        {item('guidance-move-note', `guidance.${p}.move`, GUIDANCE[p].move)}
      </View>
      {supps.length ? (
        <View testID="guidance-supps" style={{ gap: 8 }}>
          <Text variant="bodySmall" style={label}>{t('guidance.suppLabel')}</Text>
          {supps.map((s) => item(`guidance-supp-${s.id}`, `guidance.supp.${s.id}`, s.evidence))}
          <Text variant="caption" color="textSecondary">{t('guidance.suppCaveat')}</Text>
        </View>
      ) : null}
      {full ? <Text variant="caption" color="textSecondary" testID="guidance-sources">{`${t('guidance.sourcesLabel')}: ${t(`guidance.${p}.sources`)}`}</Text> : null}
      <Text variant="caption" color="textSecondary">{t('guidance.caveat')}</Text>
      {!full && onMore ? <Button kind="text" testID="guidance-more" label={t('guidance.more')} accessibilityLabel={t('guidance.moreA11y')} onPress={onMore} /> : null}
    </Card>
  );
}
```

  Before you write it, open `packages/ui-tokens` (`type`) and check that `heading`, `bodySmall` and `caption` exist. Today and the day screen already use all three. If a semibold variant exists, use it instead of `fontWeight: '600'`.

- [ ] **Step 4: Type-check.** Run `pnpm --filter @sanguine/mobile typecheck`. Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/guidance/GuidanceCard.tsx apps/mobile/src/data/prefs.ts apps/mobile/src/app/settings/tracking.tsx
git commit -m "P8-18 GuidanceCard (short and full, supplements with grades and caveat) and the cycleGuidance switch (D-107)"
```

---

## Task 4: Today

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/today.tsx`
- Modify: `apps/mobile/.maestro/today.yaml`

**Interfaces:**
- Consumes: `phaseOn`, `showSupplements` (Task 1); `GuidanceCard` (Task 3).
- Produces: a `records` memo in Today. Task 9 adds the energy line to Today, using it.

- [ ] **Step 1: Add the Maestro checks first.** In `.maestro/today.yaml`, add the checks below to each scenario block, after the block's last `assertVisible` and before its `takeScreenshot`. Read the existing blocks to find the places.
  - `typical` (cycle day 11; its fertile band is drawn, so ovulation is not uncertain):

    ```yaml
    - scrollUntilVisible:
        element:
          id: guidance-card
        centerElement: true
    - assertVisible: "Food and movement"
    - assertVisible:
        id: guidance-phase-follicular
    - assertVisible:
        id: guidance-food-vitaminC
    - assertVisible: ".*For example: muesli with kiwifruit.*"
    - scrollUntilVisible:
        element:
          id: guidance-move
        centerElement: true
    - assertNotVisible:
        id: guidance-supps
    - takeScreenshot: guidance-today
    - scrollUntilVisible:
        element:
          id: guidance-more
        centerElement: true
    - tapOn:
        id: guidance-more
    - extendedWaitUntil:
        visible:
          id: screen-day
        timeout: 10000
    - scrollUntilVisible:
        element:
          id: guidance-sources
        centerElement: true
    - assertVisible:
        id: guidance-body
    - assertVisible: "Sources: .*"
    - takeScreenshot: guidance-day-full
    - tapOn:
        id: day-back
    ```

  - `inProgress` (an adult on a period day): scroll to `guidance-card`, then assert `id: guidance-phase-menstrual` and `id: guidance-food-iron`. Scroll to `guidance-supps`, then assert `id: guidance-supp-ginger`, `id: guidance-supp-omega3` and `id: guidance-supp-zinc`. Then `takeScreenshot: guidance-period-supps`.
  - `irregular`: scroll to `guidance-card`, then assert `id: guidance-phase-general`.
  - `pregnant` (in `today.yaml` if the block is there, else in `pregnancy.yaml`): `assertNotVisible` with `id: guidance-card`.
  - `empty`: `assertNotVisible` with `id: guidance-card`.
  - In `.maestro/teen.yaml`, if it seeds a scenario with a period day today: add `assertNotVisible` with `id: guidance-supps`. If it has no such day, rely on the unit test in Task 1.

- [ ] **Step 2: Wire Today.** In `today.tsx`:
  1. Add the imports:

     ```ts
     import { useRouter } from 'expo-router';
     import { GuidanceCard } from '@/features/guidance/GuidanceCard';
     import { phaseOn, showSupplements } from '@/features/guidance/guidance';
     ```

  2. Compute the analysed records once, inside `TodayScreen`:

     ```ts
     const router = useRouter();
     const records = useMemo(() => (history && settings ? analyzeCycles(history, settings).map((c) => c.record) : []), [history, settings]);
     ```

     Replace the two inline `analyzeCycles(history, settings).map((c) => c.record)` calls with `records`:
     - The `note` memo becomes `symptomNote(records, history?.logs ?? [], noteDay(...))`, with deps `[records, history, prefs.symptomNote, model.state, model.dayOfCycle]`.
     - The `shortQ` memo keeps its guard: `history && settings && answered ? shortCycleQuestion(records, today, answered) : undefined`, with deps `[history, settings, records, answered, today]`.
  3. Before `model`, add `const showEstimate = SHOW_OVULATION_ESTIMATE && eff.showOvulationEstimate;`. Pass `showEstimate` into `buildToday` instead of its inline expression. After `model`, add:

     ```ts
     const guide = useMemo(
       () => (prefs.cycleGuidance ? phaseOn({ date: today, today, prediction, cycles: records, showEstimate }) : undefined),
       [prefs.cycleGuidance, today, prediction, records, showEstimate],
     );
     ```

  4. Render the card after the flag-card line and before the footer `View`. It sits low on purpose: the estimates come first.

     ```tsx
     {guide ? <GuidanceCard day={guide} supplements={showSupplements(eff.teen)} onMore={() => router.push({ pathname: '/day/[date]', params: { date: today } })} /> : null}
     ```

- [ ] **Step 3: Run the unit tests and the type-check.** Run `pnpm vitest related "apps/mobile/src/app/(tabs)/today.tsx" --run && pnpm --filter @sanguine/mobile typecheck`. Expected: PASS.
- [ ] **Step 4: Run the Maestro flows (iOS, in the lock).** Run `today.yaml`, plus `pregnancy.yaml` and `teen.yaml` if you edited them. Expected: PASS.
  - Copy the screenshots into `docs/screenshots/P8-18/`.
  - Read `.maestro/fontscale.sh` for its arguments. Then run it on Today with the `inProgress` scenario: that card is the longest. Check at 150% that nothing is clipped, and save that screenshot too.
- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/src/app/(tabs)/today.tsx" apps/mobile/.maestro/today.yaml docs/screenshots/P8-18
git commit -m "P8-18 Today: food, movement and supplement card for today's estimated phase, linking to the reasons (D-107)"
```

  Add `pregnancy.yaml` and `teen.yaml` to the commit if you edited them.

---

## Task 5: Day screen (from the Calendar)

**Files:**
- Modify: `apps/mobile/src/app/day/[date].tsx`
- Modify: `apps/mobile/.maestro/calendar.yaml`

- [ ] **Step 1: Add the Maestro checks.** In `calendar.yaml`, after `takeScreenshot: day-future-predicted` and before `tapOn: id: day-back`, add:

```yaml
# a predicted period day: the full card, marked expected (P8-18)
- scrollUntilVisible:
    element:
      id: guidance-card
    centerElement: true
- assertVisible:
    id: guidance-phase-menstrual
- assertVisible: "Period · expected"
- assertVisible:
    id: guidance-body
- scrollUntilVisible:
    element:
      id: guidance-sources
    centerElement: true
- assertVisible: ".*Trials used 750 to 2,000 mg of ginger powder a day.*"
- takeScreenshot: day-future-guidance
```

- [ ] **Step 2: Wire the day screen.** In `day/[date].tsx`:
  1. Merge these into the existing imports:

     ```ts
     import { analyzeCycles, type ISODate } from '@sanguine/engine';
     import { GuidanceCard } from '@/features/guidance/GuidanceCard';
     import { phaseOn, showSupplements } from '@/features/guidance/guidance';
     ```

  2. Add `history, settings` to the `useApp()` destructuring. Replace the `showEstimate` line with:

     ```ts
     const eff = effectivePrefs(prefs, profile, today);
     const showEstimate = SHOW_OVULATION_ESTIMATE && eff.showOvulationEstimate;
     ```

  3. After the `estimates` memo, add:

     ```ts
     const guide = useMemo(
       () => (prefs.cycleGuidance && history && settings
         ? phaseOn({ date: day, today, prediction, cycles: analyzeCycles(history, settings).map((c) => c.record), showEstimate })
         : undefined),
       [prefs.cycleGuidance, history, settings, day, today, prediction, showEstimate],
     );
     ```

  4. Render the card after the `day-estimates` block and before the buttons `View`:

     ```tsx
     {guide ? <GuidanceCard day={guide} supplements={showSupplements(eff.teen)} full /> : null}
     ```

- [ ] **Step 3: Run the unit tests and the type-check.** Run `pnpm vitest related "apps/mobile/src/app/day/[date].tsx" --run && pnpm --filter @sanguine/mobile typecheck`. Expected: PASS.
- [ ] **Step 4: Run `calendar.yaml` on iOS (in the lock).** Expected: PASS.
  - Copy the screenshot into `docs/screenshots/P8-18/`.
  - By hand, open the day screen of a past luteal day. It should read "Luteal phase · estimate", with no supplements and nothing clipped at 150%.
- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/src/app/day/[date].tsx" apps/mobile/.maestro/calendar.yaml docs/screenshots/P8-18
git commit -m "P8-18 Day screen: full card with what changes, reasons, grades, supplements and sources (D-107)"
```

---

# Part B: Energy log, chart and suggestions (P8-19)

## Task 6: `energy` event, projection, migration and export

**Files:**
- Modify: `apps/mobile/src/data/events.ts`, `project.ts`, `store.ts`, `exportImport.ts`
- Create: `apps/mobile/src/data/migrations/004_daily_log_energy.ts`
- Modify: `apps/mobile/src/data/migrations/index.ts`
- Test: `apps/mobile/src/data/store.test.ts`, `exportImport.test.ts` (append and adjust)

**Interfaces:**
- Produces:
  - The event kind `energy`, with payload `{ day: ISODate; level: 0|1|2|3|4|5 }`. Level 0 clears the day.
  - `DailyLogRow.energy: number | null`
  - The column `daily_log.energy INTEGER NULL`
  - A `daily.csv` `energy` column, the last one

- [ ] **Step 1: Write the failing tests.** Append to `store.test.ts`:

```ts
describe('energy (P8-19)', () => {
  const energy = (day: string, level: number) => ({ kind: 'energy', payload: { day, level } });
  const row = (day: string) => db.get<{ energy: number | null }>('SELECT energy FROM daily_log WHERE day = ?', [day]);
  it('projects the latest level for the day; 0 clears it', async () => {
    await store.append(energy('2026-10-10', 2));
    await store.append(energy('2026-10-10', 4));
    expect((await row('2026-10-10'))?.energy).toBe(4);
    await store.append(energy('2026-10-10', 0));
    expect((await row('2026-10-10'))?.energy).toBeNull();
  });
  it('a retract restores the earlier level', async () => {
    await store.append(energy('2026-10-11', 3));
    const later = await store.append(energy('2026-10-11', 5));
    await store.retract(later.id);
    expect((await row('2026-10-11'))?.energy).toBe(3);
  });
  it('rejects levels outside 0-5 and non-integers', async () => {
    for (const level of [6, -1, 2.5, '3']) await expect(store.append(energy('2026-10-12', level as number))).rejects.toThrow(/invalid energy event/);
  });
  it('never reaches the engine history', async () => {
    await store.append(energy('2026-10-13', 1));
    const p = project(await db.all<EventRow>('SELECT * FROM event'));
    expect(JSON.stringify(p.history)).not.toContain('energy');
  });
});
```

  Check how `store.append` returns the new event (`store.ts`). If it does not return the row, read the id back with `SELECT id FROM event ORDER BY lamport DESC LIMIT 1`.

  In `exportImport.test.ts`:
  - Change `expect(daily.find((r) => r[0] === '2026-10-02')?.slice(5)).toEqual(['yes', 'yes']);` to `.slice(5, 7)`.
  - In that test's setup, append `{ kind: 'energy', payload: { day: '2026-10-01', level: 2 } }` to the events it writes. Then add:

```ts
    expect(daily[0]?.at(-1)).toBe('energy');
    expect(daily.find((r) => r[0] === '2026-10-01')?.at(-1)).toBe('2');
```

- [ ] **Step 2: Run the tests and check that they fail.** Run `pnpm vitest run apps/mobile/src/data/store.test.ts apps/mobile/src/data/exportImport.test.ts`. Expected: FAIL with `invalid energy event: unknown kind "energy"`.
- [ ] **Step 3: Implement.**
  1. In `events.ts`, add a case before `case 'note':`:

     ```ts
         case 'energy':
           if (!Number.isInteger(p.level) || (p.level as number) < 0 || (p.level as number) > 5) fail(e.kind, 'level must be 0-5');
           return day();
     ```

  2. In `project.ts`:
     - Add `energy: number | null` to `DailyLogRow`.
     - Add `energy: number | null` to the local `Day` type, and `energy: null` to its default object.
     - Add a case after `'symptom'`:

       ```ts
             case 'energy': { const x = day(e.effective_day, e.id); x.energy = p.level === 0 ? null : (p.level as number); break; }
       ```

     - In the `dailyLog` map, add `energy: x.energy` after `sex: …`.
     - Do **not** add energy to `logs` (the engine `DailyLog`).
  3. Create `migrations/004_daily_log_energy.ts`:

     ```ts
     // P8-19 (D-108): the user's own energy rating, 1-5, per day; null when not logged. Validated at the event boundary, so no CHECK.
     export const sql = `
     ALTER TABLE daily_log ADD COLUMN energy INTEGER;
     `;
     ```

     In `migrations/index.ts`, add `import { sql as m004 } from './004_daily_log_energy';` and the list entry `{ version: 4, name: 'daily_log_energy', sql: m004 },`.
  4. In `store.ts` `rebuildIn`, change the `daily_log` insert to include `energy`:

     ```ts
           await tx.run('INSERT INTO daily_log (day,flow,flow_kind,clots,symptoms,sex,notes_cipher,updated_event,energy) VALUES (?,?,?,?,?,?,?,?,?)',
             [d.day, d.flow, d.flow_kind, d.clots, d.symptoms, d.sex, d.notes_cipher, d.updated_event, d.energy]);
     ```

  5. In `exportImport.ts` `daily.csv`:
     - Append `'energy'` to the header array.
     - Append `d.energy ?? ''` to each row array, after `d.notes_cipher ? 'yes' : 'no'`.
     - If the bundled `README.md` text lists the `daily.csv` columns, add `energy (1-5, your own rating)` there.
- [ ] **Step 4: Run the tests and check that they pass.** Run `pnpm vitest run apps/mobile/src/data && pnpm --filter @sanguine/mobile typecheck`. Expected: PASS, including `migrate.test.ts`, which iterates `MIGRATIONS`.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/data
git commit -m "P8-19 energy event: validation, projection into daily_log.energy (migration 004), daily.csv column; never in engine history (D-108)"
```

---

## Task 7: Logging energy (sheet, day screen)

**Files:**
- Modify: `apps/mobile/src/features/logging/actions.ts`, `describe.ts`, `LogSheet.tsx`
- Modify: `copy/en-AU.json` (`log.energy`, `log.energyLevels`, `day.entry.energy`)
- Test: `apps/mobile/src/features/logging/actions.test.ts`
- Modify: `apps/mobile/.maestro/logging.yaml`

**Interfaces:**
- Produces:
  - `export async function setEnergy(store: EventStore, day: ISODate, level: 0|1|2|3|4|5): Promise<void>`
  - `export async function energyDays(db: Database): Promise<Array<{ day: ISODate; level: number }>>`
  - `DayState.energy: number | null`

- [ ] **Step 1: Write the failing tests.** Add `setEnergy` and `energyDays` to the existing `./actions` import in `actions.test.ts`, then append:

```ts
describe('energy (P8-19)', () => {
  it('one entry per day: a new level replaces the old, 0 clears, and the day screen lists only the current one', async () => {
    await setEnergy(store, '2026-10-10', 2);
    await setEnergy(store, '2026-10-10', 4);
    expect((await dayState(db, '2026-10-10')).energy).toBe(4);
    expect((await dayEvents(store, '2026-10-10')).filter((e) => e.kind === 'energy')).toHaveLength(1);
    await setEnergy(store, '2026-10-10', 0);
    expect((await dayState(db, '2026-10-10')).energy).toBeNull();
    expect((await dayEvents(store, '2026-10-10')).filter((e) => e.kind === 'energy')).toHaveLength(0);
  });
  it('energyDays lists logged days in order and skips cleared ones', async () => {
    await setEnergy(store, '2026-10-12', 3);
    await setEnergy(store, '2026-10-11', 1);
    await setEnergy(store, '2026-10-13', 5);
    await setEnergy(store, '2026-10-13', 0);
    expect(await energyDays(db)).toEqual([{ day: '2026-10-11', level: 1 }, { day: '2026-10-12', level: 3 }]);
  });
});
```

- [ ] **Step 2: Run them and check that they fail.** Run `pnpm vitest run apps/mobile/src/features/logging/actions.test.ts`. Expected: FAIL, because `setEnergy` is not exported.
- [ ] **Step 3: Implement.**
  1. In `actions.ts`:
     - Add `energy: number | null;` to `DayState`.
     - In `dayState`, add `energy: number | null` to the row type, and `energy: r?.energy ?? null` to the returned object.
     - Add `'energy'` to `SHOWN`.
     - Add after `setSymptom`:

       ```ts
       /** The user's own energy rating (P8-19, D-108): one entry per day like a symptom (D-097); 0 clears. */
       export async function setEnergy(store: EventStore, day: ISODate, level: 0 | 1 | 2 | 3 | 4 | 5): Promise<void> {
         for (const e of (await dayEvents(store, day)).filter((x) => x.kind === 'energy')) await store.retract(e.id);
         if (level > 0) await store.append({ kind: 'energy', payload: { day, level } });
       }
       export const energyDays = (db: Database) =>
         db.all<{ day: ISODate; level: number }>('SELECT day, energy AS level FROM daily_log WHERE energy IS NOT NULL ORDER BY day');
       ```

  2. In `describe.ts` `describeEvent`, add before `case 'sex':`:

     ```ts
         case 'energy': return t('day.entry.energy', { level: t(`log.energyLevels.${d.level}`), n: d.level });
     ```

  3. In `LogSheet.tsx`:
     - Add `energy: null` to `EMPTY`.
     - Import `setEnergy`.
     - Add the handler:

       ```ts
         async function onEnergy(v: '1' | '2' | '3' | '4' | '5') {
           if (!store) return;
           const level = Number(v) as 1 | 2 | 3 | 4 | 5;
           await setEnergy(store, day, state.energy === level ? 0 : level); // tapping the chosen level again clears it
           await saved();
         }
       ```

     - Between the `SymptomGrid` line and `{heading('log.more')}`, add:

       ```tsx
               {heading('log.energy')}
               <Chips testIDPrefix="energy" value={state.energy ? (String(state.energy) as '1') : undefined} onChange={(v) => void onEnergy(v)}
                 options={(['1', '2', '3', '4', '5'] as const).map((v) => ({ value: v, label: tr(`log.energyLevels.${v}`) }))} />
       ```

  4. Copy, in `copy/en-AU.json`:
     - In `log`: `"energy": "Energy"` and `"energyLevels": { "1": "Very low", "2": "Low", "3": "OK", "4": "Good", "5": "High" }`.
     - In `day.entry`: `"energy": "Energy: {level} ({n} of 5)"`.
- [ ] **Step 4: Add the Maestro check, then run the tests.** In `logging.yaml`, after the first symptom step, add the steps below. Read the file first to find a stable point inside the open sheet.

```yaml
- scrollUntilVisible:
    element:
      id: energy-2
    centerElement: true
- tapOn:
    id: energy-2
- assertVisible:
    id: energy-2
    checked: true
- tapOn:
    id: energy-2
- assertVisible:
    id: energy-2
    checked: false
- tapOn:
    id: energy-4
- takeScreenshot: energy-logged
```

  Then:
  - Run `pnpm vitest run apps/mobile/src/features/logging && pnpm --filter @sanguine/mobile typecheck`.
  - Run `logging.yaml` on iOS, in the lock.

  Expected: PASS. Check the sheet at 150%: the five chips wrap onto two lines, with nothing clipped.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/logging copy/en-AU.json apps/mobile/.maestro/logging.yaml
git commit -m "P8-19 Log energy 1-5 in the sheet (tap again to clear); day screen line (D-108)"
```

---

## Task 8: `energyModel` (averages per phase, suggestions)

**Files:**
- Create: `apps/mobile/src/features/insights/energyModel.ts`
- Test: `apps/mobile/src/features/insights/energyModel.test.ts`

**Interfaces:**
- Consumes: `GuideDay`, `GuidePhase` (Task 1); `addDays`, `type ISODate` from `@sanguine/engine`.
- Produces:
  - `export interface EnergyPoint { day: ISODate; level: number }`
  - `export interface PhaseEnergy { phase: GuidePhase; mean: number; n: number }`
  - `export type EnergySuggestion = { kind: 'lowOverall'; mean: number; n: number } | { kind: 'lowPhase' | 'highPhase'; phase: GuidePhase; mean: number; overall: number; n: number }`
  - `export function energyInsight(points: EnergyPoint[], today: ISODate, phaseOf: (day: ISODate) => GuideDay | undefined): { window: EnergyPoint[]; byPhase: PhaseEnergy[]; suggestions: EnergySuggestion[] }`
  - `export const lowPhaseOf = (s: EnergySuggestion[]): GuidePhase | undefined`
  - The constants `ENERGY_WINDOW_DAYS = 84`, `MIN_ENERGY_DAYS = 10`, `MIN_PHASE_DAYS = 4`, `PHASE_GAP = 0.5`, `LOW_OVERALL_DAYS = 28`, `LOW_OVERALL_MIN = 10`, `LOW_OVERALL_MEAN = 2`, `MIN_CHART_POINTS = 5`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/mobile/src/features/insights/energyModel.test.ts
import { addDays, type ISODate } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import type { GuideDay, GuidePhase } from '@/features/guidance/guidance';
import { energyInsight, lowPhaseOf } from './energyModel';

const TODAY = '2026-10-14';
// a stub phase map: day i before today -> phase by a fixed pattern, so tests do not depend on phaseOn
const series = (spec: Array<[GuidePhase | 'none', number, number]>) => {
  // [phase, level, count], laid out backwards from today, one day each
  const points: Array<{ day: ISODate; level: number }> = [];
  const phases = new Map<ISODate, GuidePhase>();
  let i = 0;
  for (const [ph, level, count] of spec) for (let k = 0; k < count; k++, i++) {
    const day = addDays(TODAY, -i);
    points.push({ day, level });
    if (ph !== 'none') phases.set(day, ph);
  }
  const phaseOf = (d: ISODate): GuideDay | undefined => (phases.has(d) ? { phase: phases.get(d) as GuidePhase, expected: false } : undefined);
  return { points: points.reverse(), phaseOf };
};

describe('energyInsight', () => {
  it('averages per phase in cycle order, one decimal, and finds the lowest and highest phase', () => {
    const { points, phaseOf } = series([['premenstrual', 2, 5], ['menstrual', 3, 5], ['follicular', 4, 10]]);
    const r = energyInsight(points, TODAY, phaseOf);
    expect(r.byPhase).toEqual([
      { phase: 'menstrual', mean: 3, n: 5 }, { phase: 'follicular', mean: 4, n: 10 }, { phase: 'premenstrual', mean: 2, n: 5 },
    ]);
    // overall (10 + 15 + 40) / 20 = 3.25 -> 3.3 (rounded half up at one decimal)
    expect(r.suggestions).toEqual([
      { kind: 'lowPhase', phase: 'premenstrual', mean: 2, overall: 3.3, n: 5 },
      { kind: 'highPhase', phase: 'follicular', mean: 4, overall: 3.3, n: 10 },
    ]);
    expect(lowPhaseOf(r.suggestions)).toBe('premenstrual');
  });
  it('general and unknown days count in no phase', () => {
    const { points, phaseOf } = series([['general', 1, 6], ['none', 1, 6], ['follicular', 4, 4]]);
    expect(energyInsight(points, TODAY, phaseOf).byPhase).toEqual([{ phase: 'follicular', mean: 4, n: 4 }]);
  });
  it('no phase suggestion below 10 logged days, with a phase under 4 days, or with one qualifying phase', () => {
    expect(energyInsight(...withToday(series([['premenstrual', 1, 4], ['follicular', 5, 5]]))).suggestions).toEqual([]); // 9 days
    expect(energyInsight(...withToday(series([['premenstrual', 1, 3], ['follicular', 5, 10]]))).suggestions).toEqual([]); // premenstrual has 3
  });
  it('no phase suggestion when no phase is half a point away from the overall average', () => {
    expect(energyInsight(...withToday(series([['luteal', 3, 6], ['follicular', 3.4 as number, 6]]))).suggestions).toEqual([]);
  });
  it('lowOverall: 10 or more logs in the last 4 weeks averaging 2 or less; older logs do not count', () => {
    const low = series([['none', 2, 10]]);
    expect(energyInsight(low.points, TODAY, low.phaseOf).suggestions).toEqual([{ kind: 'lowOverall', mean: 2, n: 10 }]);
    const nine = series([['none', 2, 9]]);
    expect(energyInsight(nine.points, TODAY, nine.phaseOf).suggestions).toEqual([]);
    const old = series([['none', 4, 28], ['none', 1, 20]]); // the 20 low days are older than 28 days
    expect(energyInsight(old.points, TODAY, old.phaseOf).suggestions).toEqual([]);
  });
  it('the window holds only the last 84 days', () => {
    const { points, phaseOf } = series([['none', 3, 100]]);
    const w = energyInsight(points, TODAY, phaseOf).window;
    expect(w).toHaveLength(84);
    expect(w[0]?.day).toBe(addDays(TODAY, -83));
  });
});

function withToday(s: { points: Array<{ day: ISODate; level: number }>; phaseOf: (d: ISODate) => GuideDay | undefined }) {
  return [s.points, TODAY, s.phaseOf] as const;
}
```

- [ ] **Step 2: Run them and check that they fail.** Run `pnpm vitest run apps/mobile/src/features/insights/energyModel.test.ts`. Expected: FAIL, because `./energyModel` does not resolve.
- [ ] **Step 3: Implement**

```ts
// apps/mobile/src/features/insights/energyModel.ts
// Energy over time (P8-19, D-108): her own 1-5 ratings, averaged by part of the cycle, turned into look-back suggestions. Pure; never feeds the engine.
import { addDays, type ISODate } from '@sanguine/engine';
import type { GuideDay, GuidePhase } from '@/features/guidance/guidance';

export interface EnergyPoint { day: ISODate; level: number }
export interface PhaseEnergy { phase: GuidePhase; mean: number; n: number }
export type EnergySuggestion =
  | { kind: 'lowOverall'; mean: number; n: number }
  | { kind: 'lowPhase' | 'highPhase'; phase: GuidePhase; mean: number; overall: number; n: number };

export const ENERGY_WINDOW_DAYS = 84; // 12 weeks: about three cycles
export const MIN_ENERGY_DAYS = 10;
export const MIN_PHASE_DAYS = 4;
export const PHASE_GAP = 0.5; // on the 1-5 scale
export const LOW_OVERALL_DAYS = 28;
export const LOW_OVERALL_MIN = 10;
export const LOW_OVERALL_MEAN = 2;
export const MIN_CHART_POINTS = 5;
const ORDER: GuidePhase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal', 'premenstrual'];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (x: number) => Math.round(x * 10) / 10;
const lastDays = (points: EnergyPoint[], today: ISODate, days: number) => points.filter((p) => p.day > addDays(today, -days) && p.day <= today);

export function energyInsight(points: EnergyPoint[], today: ISODate, phaseOf: (day: ISODate) => GuideDay | undefined) {
  const window = lastDays(points, today, ENERGY_WINDOW_DAYS);
  const by = new Map<GuidePhase, number[]>();
  for (const p of window) {
    const ph = phaseOf(p.day)?.phase;
    if (ph && ph !== 'general') by.set(ph, [...(by.get(ph) ?? []), p.level]);
  }
  const byPhase: PhaseEnergy[] = ORDER.flatMap((phase) => {
    const xs = by.get(phase);
    return xs ? [{ phase, mean: round1(mean(xs)), n: xs.length }] : [];
  });

  const suggestions: EnergySuggestion[] = [];
  const recent = lastDays(points, today, LOW_OVERALL_DAYS);
  if (recent.length >= LOW_OVERALL_MIN && mean(recent.map((p) => p.level)) <= LOW_OVERALL_MEAN)
    suggestions.push({ kind: 'lowOverall', mean: round1(mean(recent.map((p) => p.level))), n: recent.length });
  const enough = byPhase.filter((b) => b.n >= MIN_PHASE_DAYS);
  if (window.length >= MIN_ENERGY_DAYS && enough.length >= 2) {
    const overall = round1(mean(window.map((p) => p.level)));
    const low = enough.reduce((a, b) => (b.mean < a.mean ? b : a));
    const high = enough.reduce((a, b) => (b.mean > a.mean ? b : a));
    if (low.mean <= overall - PHASE_GAP) suggestions.push({ kind: 'lowPhase', phase: low.phase, mean: low.mean, overall, n: low.n });
    if (high.mean >= overall + PHASE_GAP) suggestions.push({ kind: 'highPhase', phase: high.phase, mean: high.mean, overall, n: high.n });
  }
  return { window, byPhase, suggestions };
}

export const lowPhaseOf = (s: EnergySuggestion[]): GuidePhase | undefined => s.flatMap((x) => (x.kind === 'lowPhase' ? [x.phase] : []))[0];
```

  If the floating-point rounding of 3.25 gives 3.2, fix the test's expected `overall` to the value `round1` actually returns, and leave the comment honest. The suggestions logic does not depend on it.
- [ ] **Step 4: Run the tests and the type-check, and check that they pass.** Run `pnpm vitest run apps/mobile/src/features/insights/energyModel.test.ts && pnpm --filter @sanguine/mobile typecheck`.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/insights/energyModel.ts apps/mobile/src/features/insights/energyModel.test.ts
git commit -m "P8-19 energyModel: 12-week window, averages by phase, low/high phase and low-overall suggestions with minimum-data gates (D-108)"
```

---

## Task 9: Insights energy card, Today line, dev scenario

**Files:**
- Modify: `apps/mobile/src/features/insights/charts.tsx` (add `EnergyChart`)
- Modify: `apps/mobile/src/app/(tabs)/insights.tsx`, `apps/mobile/src/app/(tabs)/today.tsx`
- Modify: `apps/mobile/src/features/dev/scenarios.ts`
- Modify: `copy/en-AU.json` (`insights.energy.*`)
- Modify: `apps/mobile/.maestro/insights.yaml`

**Interfaces:**
- Consumes:
  - `energyDays` (Task 7)
  - `energyInsight`, `lowPhaseOf`, `MIN_CHART_POINTS` (Task 8)
  - `phaseOn`, `GUIDANCE` (Task 1)
  - the `records` memo in Today (Task 4)
- Produces: `export function EnergyChart(props: { points: EnergyPoint[]; starts: ISODate[]; from: ISODate; to: ISODate; label: string })`

- [ ] **Step 1: Copy.** Add to `copy/en-AU.json` `insights`:

```json
"energy": {
  "title": "Energy",
  "few": "Log your energy on {n} more days to see a chart.",
  "none": "Log your energy in the log sheet to see it here over time.",
  "chartCaption": "Last 12 weeks. Dashed lines mark the start of each period.",
  "chartA11y": "Energy chart: {n} days logged in the last 12 weeks, average {mean} out of 5.",
  "byPhaseTitle": "Average by part of the cycle",
  "meanLine": "{mean} of 5 · {n} days",
  "suggestionsTitle": "What your logs show",
  "lowPhase": "Your energy was lowest {phaseIn}: {mean} out of 5 on average, against {overall} overall, over {n} days you logged.",
  "lowPhaseTip": "Exercise lifts mood and energy for most people, and even one session helps on average. On those days, a walk, yoga or a lighter session still counts.",
  "highPhase": "Your energy was highest {phaseIn}: {mean} out of 5 on average. If you enjoy harder sessions, this is when you have tended to feel up to them.",
  "lowOverall": "Your energy was low on most days you logged in the last 4 weeks: {mean} out of 5 on average over {n} days. Tiredness that lasts for weeks has many possible causes. A doctor can help you check what is going on.",
  "caption": "From your own logs. Energy does not change any estimate."
}
```

- [ ] **Step 2: Add the scenario and the Maestro block.**
  1. In `scenarios.ts`:
     - Add `'energy'` to `ScenarioName` and to `SCENARIOS`.
     - Import `diffDays` from `@sanguine/engine`.
     - Add this before the `typical` fallthrough:

       ```ts
         if (name === 'energy') {
           // P8-19: day 11 today; energy logged daily over three 28-day cycles, lowest in the 5 days before each period, highest mid-follicular
           const starts = startsFrom(addDays(today, -10), [28, 28, 28]);
           const level = (cd: number) => (cd <= 4 ? 3 : cd <= 14 ? 4 : cd <= 23 ? 3 : 2);
           const days: NewEvent[] = [];
           for (let d = starts[0] as ISODate; d <= today; d = addDays(d, 1)) {
             const s = [...starts].reverse().find((x) => x <= d) as ISODate;
             days.push({ kind: 'energy', payload: { day: d, level: level(diffDays(d, s) + 1) } });
           }
           return { profile, events: [...starts.flatMap((s) => period(s, 4)), ...days] };
         }
       ```

     If a scenario test asserts the `SCENARIOS` list, update it.
  2. In `insights.yaml`, append:

```yaml
# P8-19: energy chart, averages by phase, suggestions from her own logs
- runFlow:
    file: _open.yaml
    env:
      LINK: ${LINKBASE}dev/seed?scenario=energy
- extendedWaitUntil:
    visible:
      id: screen-today
    timeout: 90000
- tapOn: Insights
- tapOn:
    id: insights-tab-charts
- scrollUntilVisible:
    element:
      id: card-energy
    centerElement: true
- assertVisible:
    id: chart-energy
- scrollUntilVisible:
    element:
      id: energy-suggestion-lowPhase
    centerElement: true
- assertVisible: "Your energy was lowest in the days before your period.*"
- assertVisible: "Your energy was highest in the follicular phase.*"
- assertVisible: "From your own logs. Energy does not change any estimate."
- takeScreenshot: energy-insights
```

  Check the segment testID against `Segmented` (`testIDPrefix="insights-tab"` with value `charts`). Open `.maestro/typical-charts.yaml` for the exact tap the existing flows use.
- [ ] **Step 3: Add the chart.** Append to `charts.tsx`, adding `diffDays` and `ISODate` from `@sanguine/engine` and `formatDay` from `@/ui/format` to the imports:

```tsx
export function EnergyChart({ points, starts, from, to, label }: { points: Array<{ day: ISODate; level: number }>; starts: ISODate[]; from: ISODate; to: ISODate; label: string }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const w = Math.min(width, 560) - 32 - 32;
  const span = Math.max(1, diffDays(to, from));
  const x = (d: ISODate) => PAD.l + (diffDays(d, from) / span) * (w - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - 1) / 4) * (H - PAD.t - PAD.b);
  // ponytail: one polyline joins across unlogged days; split it into runs if gaps read as data
  return (
    <View testID="chart-energy" accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={w} height={H}>
        {[1, 3, 5].map((v) => (
          <G key={v}>
            <Line x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} stroke={t.c.border} strokeWidth={1} />
            <SvgText x={PAD.l - 6} y={y(v) + 4} fontSize={11} fill={t.c.textSecondary} textAnchor="end">{v}</SvgText>
          </G>
        ))}
        {starts.map((s) => <Line key={s} x1={x(s)} x2={x(s)} y1={PAD.t} y2={H - PAD.b} stroke={t.c.period} strokeWidth={1} strokeDasharray="3 3" />)}
        <Polyline points={points.map((p) => `${x(p.day)},${y(p.level)}`).join(' ')} fill="none" stroke={t.c.accent} strokeWidth={2} />
        {points.map((p) => <Circle key={p.day} cx={x(p.day)} cy={y(p.level)} r={3} fill={t.c.accent} />)}
        <SvgText x={PAD.l} y={H - 8} fontSize={11} fill={t.c.textSecondary}>{formatDay(from)}</SvgText>
        <SvgText x={w - PAD.r} y={H - 8} fontSize={11} fill={t.c.textSecondary} textAnchor="end">{formatDay(to)}</SvgText>
      </Svg>
    </View>
  );
}
```

- [ ] **Step 4: Wire Insights.** In `insights.tsx`:
  1. Add the imports:
     - `addDays` (merged into the engine import)
     - `energyDays` from `@/features/logging/actions` (merged with `fromC`)
     - `EnergyChart` (merged into the charts import)
     - `energyInsight`, `MIN_CHART_POINTS` from `@/features/insights/energyModel`
     - `GUIDANCE`, `phaseOn` from `@/features/guidance/guidance`
     - `SHOW_OVULATION_ESTIMATE` from `@/features/today/todayModel`
  2. Change `const { fertilityTools } = effectivePrefs(...)` to `const eff = effectivePrefs(prefs, profile, today); const { fertilityTools } = eff;`. Then add:

     ```ts
       const [energyPoints, setEnergyPoints] = useState<Array<{ day: string; level: number }>>([]);
       // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads after every write
       useEffect(() => { if (db) void energyDays(db).then(setEnergyPoints); }, [db, version]);
       const showEstimate = SHOW_OVULATION_ESTIMATE && eff.showOvulationEstimate;
       const energy = useMemo(
         () => energyInsight(energyPoints, today, (d) => phaseOn({ date: d, today, prediction, cycles, showEstimate })),
         [energyPoints, today, prediction, cycles, showEstimate],
       );
       const energyFrom = addDays(today, -83);
       const energyMean = energy.window.length ? Math.round((energy.window.reduce((a, p) => a + p.level, 0) / energy.window.length) * 10) / 10 : 0;
     ```

  3. Render the card inside the charts tab. Put it after the closing `</>)` of the `empty ? … : (<>…</>)` block, so it shows even with fewer than two closed cycles:

     ```tsx
       {tab === 'charts' ? (
         <Card testID="card-energy">
           <Text variant="heading" accessibilityRole="header">{tr('insights.energy.title')}</Text>
           {energy.window.length >= MIN_CHART_POINTS ? (<>
             <EnergyChart points={energy.window} starts={cycles.map((c) => c.start).filter((s) => s >= energyFrom)} from={energyFrom} to={today}
               label={tr('insights.energy.chartA11y', { n: energy.window.length, mean: energyMean })} />
             <Text variant="caption" color="textSecondary">{tr('insights.energy.chartCaption')}</Text>
           </>) : <Text testID="chart-energy-few" variant="bodySmall" color="textSecondary">{energy.window.length ? tr('insights.energy.few', { n: MIN_CHART_POINTS - energy.window.length }) : tr('insights.energy.none')}</Text>}
           {energy.byPhase.length ? (<>
             <Text variant="bodySmall" style={{ marginTop: 10, fontWeight: '600' }}>{tr('insights.energy.byPhaseTitle')}</Text>
             {energy.byPhase.map((b) => (
               <View key={b.phase} testID={`energy-phase-${b.phase}`} accessible accessibilityLabel={`${tr(`guidance.phase.${b.phase}`)}: ${tr('insights.energy.meanLine', { mean: b.mean, n: b.n })}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                 <Text variant="caption" color="textSecondary" style={{ width: 110 }}>{tr(`guidance.phase.${b.phase}`)}</Text>
                 <View style={{ flex: 1, height: 10, backgroundColor: t.c.border, borderRadius: 5, overflow: 'hidden' }}><View style={{ width: `${(b.mean / 5) * 100}%`, height: 10, backgroundColor: t.c.accent }} /></View>
                 <Text variant="caption" tabular style={{ width: 92, textAlign: 'right' }}>{tr('insights.energy.meanLine', { mean: b.mean, n: b.n })}</Text>
               </View>
             ))}
           </>) : null}
           {energy.suggestions.length ? (<>
             <Text variant="bodySmall" style={{ marginTop: 10, fontWeight: '600' }}>{tr('insights.energy.suggestionsTitle')}</Text>
             {energy.suggestions.map((s) => (
               <View key={s.kind} testID={`energy-suggestion-${s.kind}`} style={{ gap: 2 }}>
                 <Text variant="bodySmall">{s.kind === 'lowOverall' ? tr('insights.energy.lowOverall', { mean: s.mean, n: s.n }) : tr(`insights.energy.${s.kind}`, { phaseIn: tr(`guidance.phaseIn.${s.phase}`), mean: s.mean, overall: s.overall, n: s.n })}</Text>
                 {s.kind === 'lowPhase' ? (<>
                   <Text variant="bodySmall" color="textSecondary">{tr('insights.energy.lowPhaseTip')}</Text>
                   <Text variant="caption" color="textSecondary">{tr(`guidance.evidence.${GUIDANCE[s.phase].move}`)}</Text>
                 </>) : null}
               </View>
             ))}
           </>) : null}
           <Text variant="caption" color="textSecondary" style={{ marginTop: 6 }}>{tr('insights.energy.caption')}</Text>
         </Card>
       ) : null}
     ```

     The `lowPhase` tip's grade comes from the movement note of that phase. Every phase that can be lowest is graded `strong`, except `ovulatory` (`some`). That is accurate: its movement note is the warm-up note.
- [ ] **Step 5: Add the Today line.** In `today.tsx`:
  - Import `energyDays` and `energyInsight`, `lowPhaseOf`.
  - Add, after the `guide` memo:

    ```ts
      const [energyPoints, setEnergyPoints] = useState<Array<{ day: string; level: number }>>([]);
      // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads after every write
      useEffect(() => { if (db) void energyDays(db).then(setEnergyPoints); }, [db, version]);
      const energyLow = useMemo(() => {
        if (!guide) return false;
        const { suggestions } = energyInsight(energyPoints, today, (d) => phaseOn({ date: d, today, prediction, cycles: records, showEstimate }));
        return lowPhaseOf(suggestions) === guide.phase;
      }, [guide, energyPoints, today, prediction, records, showEstimate]);
    ```

  - Pass `energyLow={energyLow}` to the Today `GuidanceCard`.
- [ ] **Step 6: Run the tests and flows.**
  - Run `pnpm vitest related apps/mobile/src/features/insights/charts.tsx "apps/mobile/src/app/(tabs)/insights.tsx" "apps/mobile/src/app/(tabs)/today.tsx" apps/mobile/src/features/dev/scenarios.ts --run && pnpm --filter @sanguine/mobile typecheck`.
  - Run `insights.yaml` and `today.yaml` on iOS, in the lock.
  - Expected: PASS.
  - Screenshots go to `docs/screenshots/P8-19/`. Check the Energy card at 150%: the `meanLine` column may need `width` raised, or the bar row stacked, if it clips.
- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/features/insights/charts.tsx "apps/mobile/src/app/(tabs)/insights.tsx" "apps/mobile/src/app/(tabs)/today.tsx" apps/mobile/src/features/dev/scenarios.ts copy/en-AU.json apps/mobile/.maestro/insights.yaml docs/screenshots/P8-19
git commit -m "P8-19 Insights energy chart, averages by phase and look-back suggestions; Today notes her low-energy phase (D-108)"
```

---

## Task 10: Records, full suite, final commit

**Files:** `docs/DECISIONS.md`, `docs/BACKLOG.md`, `docs/PLAN.md` (§5.3, §11.1), `docs/regulatory/risk-register.md`, `docs/i18n/strings-for-translation.csv`

- [ ] **Step 1: Append D-107 and D-108 to `docs/DECISIONS.md`**, after the last D-1xx line in the section that holds D-106:

> - D-107 (2026-10-14) Food, movement and supplement notes by cycle phase (P8-18, owner request). Today shows one card for today's estimated phase: a food note, a movement note and, where research exists, supplements, each with its reason and an evidence grade. The day screen shows the full card for any day: what changes in the body, the reasons, the grades and the sources.
>
>   Six guide phases come from `phaseOn()` (`features/guidance/guidance.ts`):
>   - menstrual: logged days, or the default 5 bleed days, or a future day inside the next period's 80% range;
>   - follicular;
>   - ovulatory: the rounded ovulation day ± 1, only with the estimate shown;
>   - luteal;
>   - premenstrual: the 5 days before the most likely next start, after Draper 2018's five phases;
>   - general: an uncertain or missing ovulation estimate, a late period, or a cycle merged by a missed log.
>
>   No card while prediction is suspended, before the first logged period, or past the forecast. Past cycles use their biomarker ovulation, else the luteal prior counted back from the next start (§4.5). The engine is unchanged; two private engine constants are mirrored with a `ponytail:` note.
>
>   Owner decisions:
>   - Movement notes lead with mood and energy (Singh 2023, Noetel 2024, Weinstein 2024, Wender 2022), not exercise performance.
>   - Supplements with research are named with their grade, what the trials used and their safety notes: ginger, omega-3 and zinc for period pain (some evidence); calcium (some), vitamin B6 (early, with the TGA nerve warning) and magnesium (early) before the period. The owner rejected the first draft's "foods only".
>   - Several graded food notes per phase, each with example foods and meals. Period: iron with vitamin C, and omega-3 foods. Follicular: vitamin C, B vitamins and zinc. Around ovulation: fibre and vitamin D/B6 foods. Luteal: protein, magnesium and B12. Days before the period: calcium and slow carbohydrate. Popular claims are graded on their evidence. B12 has no phase link and is shown as general guidance. The fibre note says that the one cohort (BioCycle) found lower hormones and more cycles without ovulation at higher intake.
>
>   Conservative defaults with no clinician:
>   - no calorie, weight, fasting, cleanse, restriction or cure word (guard test);
>   - every note graded, with the caveat that the research is young and this is general information, not medical advice, and a supplement caveat pointing to a pharmacist or doctor;
>   - ovulation named only in the ovulatory notes, which teen mode never reaches;
>   - supplements hidden under 18 (`SUPPLEMENTS_FOR_TEENS = false`, not changed by the teen estimate unlock).
>
>   On by default, with a switch in Settings > Tracking. Research table: `docs/superpowers/plans/2026-10-14-cycle-food-movement-notes.md`.
>
>   Rejected: luteal calorie figures (disordered-eating harm; teens in scope); "cycle syncing" training plans (2023 reviews find no phase effect); showing a phase while the ovulation estimate is uncertain; supplements for teens.
> - D-108 (2026-10-14) Energy log, chart and suggestions (P8-19, owner request).
>   - **Storage.** A new event kind `energy` `{ day, level 1-5 }` (0 clears; one entry per day, earlier ones retracted as with symptoms, D-097). It projects into `daily_log.energy` (migration 004), is exported as the last `daily.csv` column, and never enters the engine's `History`.
>   - **Logging.** The log sheet has an Energy row of five chips (Very low to High); tapping the chosen one again clears it.
>   - **Insights.** The Charts tab shows 12 weeks of energy with period starts marked, the average for each part of the cycle (through `phaseOn`; general and unplaced days count in none), and look-back suggestions in her own numbers:
>     - lowest phase: at least 10 days in 12 weeks, two phases with 4 or more days each, and 0.5 points below her overall average; it carries the movement-for-mood note and its grade;
>     - highest phase;
>     - low on most days: 10 or more logs in 4 weeks averaging 2 or less; it names no condition and points to a doctor.
>   - **Today.** The card adds one line when today is in her lowest-energy phase.
>   - **Old app versions.** A phone still on an older version rejects a backup or sync carrying `energy` events until it takes the over-the-air update; nothing is lost.
>
>   Rejected:
>   - Reusing the `fatigue` and `energetic` symptom codes: on/off with three strengths, not a level, and they would leak into symptom patterns, the doctor report and the look-back note.
>   - A personal adjustment of the guidance by energy: no evidence for a rule, and it would hide the published notes.

- [ ] **Step 2: Add to `docs/BACKLOG.md`**, after P8-17:

> - [x] P8-18 Food, movement and supplement notes by cycle phase on Today and the day screen: research-backed and graded, movement for mood, supplements with their evidence and safety notes (hidden under 18), hidden while suspended, switchable (D-107).
> - [x] P8-19 Energy log (1-5) with an Insights chart, averages by part of the cycle and look-back suggestions; a Today line in her lowest-energy phase (D-108).

- [ ] **Step 3: Update `docs/PLAN.md`.**
  - Add a row to the §5.3 event table, after `symptom`: `| energy | { day, level } | The user's own 1-5 rating; 0 clears; never read by the engine (D-108) |`
  - Add a row to the §11.1 table, after "Symptom list": `| Food, movement and supplement notes | Every note graded with sources; several foods per phase with example meals, popular claims graded on their evidence; movement for mood; supplements named with grade, trial amounts and safety notes, hidden under 18; no calorie or restriction words; general set when the phase is uncertain; none while suspended | Calorie figures, phase-based training plans: disordered-eating harm, no phase effect | features/guidance/guidance.ts, copy guidance.* |`
- [ ] **Step 4: Add RK-25 to RK-28 to `docs/regulatory/risk-register.md`**, after RK-24:

> | RK-25 | A user takes a note as medical treatment and delays seeing a doctor about pain, heavy bleeding or mood | Notes read as treatment | S2 | Information wording with an evidence grade on every note; caveat on every card; health flags keep pointing to a doctor | `guidance.test.ts` copy checks; `copy.test.ts` forbidden words |
> | RK-26 | Harm from a supplement: B6 nerve damage, zinc excess lowering copper, interactions with medicines, use by a teen | Supplements named in the app | S3 | Grades and trial amounts only, never "take X"; B6 tip carries the nerve warning; zinc note gives the 40 mg/day upper limit; supplement caveat points to a pharmacist or doctor; hidden under 18 | `guidance.test.ts` "B6 note carries the nerve warning", "hidden for under-18s"; `teenAudit.test.ts` |
> | RK-27 | A note feeds restrictive eating, particularly in a teen | Calorie, weight or restriction wording | S3 | No calorie, kilojoule, weight, fasting, cleanse or restriction word in `guidance.*`; hunger described as common, never counted | `guidance.test.ts` word guard |
> | RK-28 | Phase notes or energy suggestions shown when the phase is unknown, or built from too little data, read as a pattern | Uncertain or suspended estimate; few logs | S2 | `phaseOn` gives no card while suspended and the general set when ovulation is uncertain, missing or late; energy suggestions need 10 days, 4 per phase, two phases and a 0.5-point gap; persistent-low wording names no condition and points to a doctor | `guidance.test.ts`, `energyModel.test.ts`; `today.yaml` pregnant and irregular scenarios |

- [ ] **Step 5: Refresh the translation sheet.** Run `pnpm i18n:extract`. Expected: `docs/i18n/strings-for-translation.csv` gains the `guidance.*`, `log.energy*`, `day.entry.energy`, `insights.energy.*` and `settings.tracking.guidance*` rows.
- [ ] **Step 6: Run the full checks once.** Run `pnpm test && pnpm typecheck && pnpm lint && pnpm soup`.
  - Expected: all pass, with a higher test count than before.
  - If anything fails, fix it and rerun only that check.
  - Do not run the full Maestro suite. That runs once per batch, and the owner has not asked for one.
- [ ] **Step 7: Commit**

```bash
git add docs/DECISIONS.md docs/BACKLOG.md docs/PLAN.md docs/regulatory/risk-register.md docs/i18n/strings-for-translation.csv
git commit -m "P8-18 P8-19 Records: D-107, D-108, PLAN §5.3 and §11.1 rows, RK-25 to RK-28, translation sheet"
```

  If a peer session has hunks in these files, commit through the temporary index (Task 0 Step 3). Afterwards, check that `git diff HEAD -- <your files>` shows only the peer's lines.
