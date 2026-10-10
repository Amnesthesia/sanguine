# Sanguine — Design and Architecture Plan

Oct 9, 2026 · @Victor

## 1. Executive summary

Sanguine is a free, ad-free menstrual-cycle and fertility-awareness tracker for iOS and Android whose prediction engine runs entirely on the phone and whose developer never holds any user data. It keeps the fast logging and clear predictions women like in Flo and Clue, drops the paywalls, ad-tech and false precision, and ships first in Australia as a consumer wellness app that stays outside TGA medical-device regulation.

**Key decisions**

| Area | Decision | Why |
| --- | --- | --- |
| Prediction model | Bayesian Normal-Inverse-Gamma model with a population prior from [Bull et al. 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6710244) (mean 29.3 d, per-person SD 2.6 d), plus robust exclusion of implausibly long cycles | Won the prototype on both accuracy and interval calibration (section 4): MAE 2.5–2.8 d after 8 cycles vs 3.6–3.9 d for a naive calendar; 80% intervals actually covered 83–85% of outcomes, while a fixed ±2-day window covered only 58% |
| Ovulation estimate | Luteal-phase model (12.4 ± 2.4 d) with cycle-length-dependent follicular length; overridden retrospectively by BBT shift, LH surge or mucus peak when logged | Follicular phase carries most of the variability; biomarkers, not calendar days, locate ovulation |
| Symptoms | Cramps, mood, acne, breast tenderness and mittelschmerz never move a prediction; they drive per-person insights only | No retrieved evidence supports population-level predictive weight |
| Regulatory | v1 ships under the TGA general health or wellness exclusion (item 14B); no contraception, conception or screening claims | Contraceptive software is Class IIb in Australia (Natural Cycles, ARTG 349810); a later regulated tier is scoped but not built |
| Privacy | Local-first SQLCipher database, no accounts, no servers, no analytics or crash SDKs; optional backup is client-side encrypted into the user's own iCloud or Google Drive app folder | A subpoena to the developer yields nothing because the developer holds nothing; running cost is effectively zero |
| Platform | Expo SDK 57 (React Native 0.86) with prebuild and a dev client; expo-router, expo-sqlite with SQLCipher, Zustand, expo-notifications, Expo widgets | Current stable SDK as of October 2026; Health libraries need native modules so Expo Go is out |
| Health sync | Two-way HealthKit and Health Connect sync, opt-in per data type, in Phase 4 after the native-build phase; 13 mapped data types | Most of the audience already logs in Apple Health; Health Connect is in the Android framework from Android 14 |
| Open source | Prediction engine open under MIT from day one; app code open after launch | The engine is the trust claim; independent review is worth more than secrecy |

**Regulatory strategy in plain terms.** The app's stated purpose is to help women track and understand their cycle. It shows an estimated next period, an estimated ovulation day and a range of days around it, each with honest uncertainty. It never says a day is safe for unprotected sex, never offers a conception mode, and never names a condition; health flags say only that a logged pattern is outside the published normal range and that a doctor can help check it. Every screen that could be read as a claim carries fixed wording reviewed in section 2. Contraception and conception-support features are reserved for a regulated tier that would need ISO 13485, IEC 62304, ISO 14971, clinical evidence and ARTG inclusion, costing roughly A$250k–600k and 12–24 months, and are not on the v1 roadmap.

**Assumptions changed.** One: Health sync moves from "early phase" to Phase 4, after the Expo Go phases and the first native build, because the work is meant to proceed unattended on a simulator and every feature that needs a native module is deferred behind one build step; the echo-prevention and conflict rules also depend on the event-sourced data model being finished first. Two: a minimum age of 13 is enforced in onboarding with a teen mode that hides fertility language, because the Children's Online Privacy Code lands on 10 December 2026 and the audience explicitly includes teens. All other stated assumptions stand.

**Independent review.** No sub-agent or second-model capability was available in this environment, so the medical and statistical reviews in section 4 are a structured self-audit against the retrieved sources, labelled as such. No clinician or regulatory review is assumed to be available: section 11 records the conservative default applied to every decision that would otherwise need one, so the app complies by construction and can be taken to certification later if that is ever wanted.

## 2. Regulatory and privacy analysis

Sanguine v1 can be supplied in Australia without ARTG inclusion if every feature stays inside the general health or wellness software exclusion, which means no contraception, conception-support or condition-screening claims anywhere, including screenshots and store listings. This reading is applied as a working position without external confirmation; the defaults in 2.3 and section 11 are chosen so that the app stays inside the exclusion even on a strict reading.

### 2.1 How the TGA treats the app

The TGA regulates all software that meets the medical-device definition in s41BD of the Therapeutic Goods Act 1989 unless it falls into one of the 15 excluded software categories in Schedule 1 of the Therapeutic Goods (Excluded Goods) Determination 2018. Item 14B excludes software intended by its manufacturer for a consumer to promote or facilitate general health or wellness by measuring or monitoring a physical parameter through non-invasive means, provided it is not intended for clinical practice and makes no claims about a serious disease or condition. The TGA republished the guidance for this exclusion on 16 March 2026 ([TGA guidance, item 14B](https://www.tga.gov.au/resources/guidance/understanding-general-health-or-wellness-software-exclusion)). Two points in that guidance govern Sanguine: every feature of a multi-function app must individually meet the exclusion, and all published material about the software, even a line of screen text, counts toward intended purpose.

Two things push a cycle tracker out of the exclusion. The device definition in s41BD(1) expressly includes products intended for control or support of conception, so a contraception or conception-support purpose is a medical-device purpose whatever the risk level. And a claim about a serious condition (one that needs a health professional to evaluate and treat, which covers PCOS, endometriosis, abnormal uterine bleeding and perimenopausal disorders) removes 14B protection. The precedents are consistent: Natural Cycles is listed on the ARTG as a Class IIb device for contraception ([ARTG 349810](https://www.tga.gov.au/node/312026)); Apple's Cycle Tracking carries instructions for use in the US and EU as a software device intended to facilitate conception and not for contraception ([Apple IFU](https://www.apple.com/legal/ifu/cycle-tracking/4-0/ct-ifu-4-0-en_AU.pdf)); the FDA regulates contraceptive fertility software under 21 CFR 884.5370 as Class II with special controls including clinical performance testing ([K202897](https://fda.innolitics.com/device/K202897)).

| Feature | Status under TGA rules | Basis |
| --- | --- | --- |
| Period, flow, symptom and biomarker logging; calendar; history | Excluded (14B): monitoring physical parameters for general wellness | 14B guidance, example "software for tracking health information" |
| Next-period prediction with a range | Excluded | Predicts a physiological event, makes no disease or conception claim |
| Estimated ovulation day and surrounding range, labelled educational | Excluded if worded as cycle understanding, not conception support; border case | s41BD conception limb; Apple's IFU treats a conception-facilitation claim as a device purpose |
| "Trying to conceive" mode, timed-intercourse advice, chance-of-pregnancy per day | Regulated: support of conception; likely Class I or IIa under the 2021 software classification rules (class to be confirmed by consultant) | s41BD(1); Apple precedent |
| Any contraceptive use ("safe days", "not fertile today") | Regulated, Class IIb | ARTG 349810 (Natural Cycles, Class IIb) |
| Health flags worded as "outside the published normal range; a doctor can help check" | Excluded if no condition is named, no risk score, no screening claim; border case | 14B serious-condition limb |
| Flags that name PCOS, endometriosis, AUB, perimenopause, or compute a risk | Regulated (screening for a serious condition) | 14B guidance, "fitness tracker with heart rate warning" example |
| Wearable temperature import used for retrospective ovulation estimate | Excluded, same footing as BBT entry | Non-invasive physical parameter |

### 2.2 What ARTG inclusion would require

A regulated tier is a different product. The sponsor must hold conformity-assessment evidence for a quality management system (ISO 13485), software lifecycle processes (IEC 62304), risk management (ISO 14971) and usability engineering (IEC 62366-1), plus clinical evidence proportionate to the class. For a contraception claim that means a prospective contraceptive-effectiveness study reporting a Pearl Index (Natural Cycles' typical-use evidence came from such studies), which is multi-year. For a conception-support claim the evidence bar is lower (performance of ovulation estimates against a reference such as urinary LH or ultrasound) but still needs a clinical investigation or robust literature plus a performance study on the shipped algorithm. Ongoing obligations include post-market surveillance, adverse-event reporting, change control on every engine update, annual fees, and a sponsor resident in Australia.

| Item | Realistic cost (AUD) | Effort |
| --- | --- | --- |
| QMS set-up and ISO 13485 certification (consultant plus audit) | 60k–120k | 6–9 months, one engineer plus consultant |
| IEC 62304 and ISO 14971 documentation for the engine | 30k–60k | 3–4 months of engineer time |
| Clinical performance study, conception-support claim (ovulation accuracy vs LH, about 200 cycles) | 80k–200k | 9–12 months |
| Clinical study, contraception claim (Pearl Index, thousands of woman-months) | 500k+ | 2–3 years |
| TGA application, conformity assessment, annual charges | 15k–60k | 3–9 months review |
| Total for a conception-support Class I/IIa tier | 250k–600k | 12–24 months |

### 2.3 Strategy and exact wording

Ship v1 inside the exclusion and keep the regulated tier as a funded, separate decision. Fixed wording appears in the store listing, onboarding, the Today screen footer and every prediction surface, and is version-controlled with the engine so a change is a reviewed change.

| Surface | Wording |
| --- | --- |
| Store listing, first paragraph | "Sanguine helps you track and understand your menstrual cycle. It is not a contraceptive and is not a medical device." |
| Onboarding, purpose screen | "Sanguine estimates when your next period and your ovulation are likely, using what you log. Estimates are ranges, not promises." |
| Fertility estimate card | "Estimated ovulation around 14 Nov (range 12–17 Nov). This is for understanding your cycle. Do not use it to prevent pregnancy." |
| Health flag | "Your last three cycles were longer than 38 days. That is outside the range most clinical guidelines call typical. A doctor can help you check what is going on." |
| Settings, about | "Sanguine does not diagnose, screen for or treat any condition. If you are worried about your health, talk to a health professional." |

Words that never appear in v1: safe, unsafe, protected, contraception, birth control, conceive, fertile today, chance of pregnancy, risk, diagnosis, PCOS, endometriosis, perimenopause (as a verdict), abnormal.

**Building without expert review.** Where the plan would normally wait for a clinician or a regulatory consultant, it applies the more conservative of the available options and records it, so nothing blocks the build and every such choice is auditable later. The defaults are: the ovulation estimate ships, labelled an estimate, behind the fixed wording above, with no conception mode and no per-day chance of pregnancy; health flags use only published ranges, name no condition, compute no risk and always point to a doctor; the engine's clinical parameters are the ones in section 3 with the stated sources and the contested ones (luteal prior) carry their caveat in the UI; adolescents and the perimenopause state get the stricter thresholds; anything that could read as advice is phrased as information. The full list is in section 11.

**Certification-ready from day one, at low cost.** A later ARTG application is mostly a documentation exercise if the artefacts exist from the start, so Phase 0 creates and Phase 1 maintains: a requirements file where each engine rule has an id, a source and a test (traceability for IEC 62304); a risk register in ISO 14971 shape (hazard, cause, severity, control, verification) seeded from the engine's known failure modes; a SOUP list of third-party packages with versions; a change log that records every engine-parameter change with its backtest result; and the version-controlled wording table. None of this needs a consultant to write; it needs the discipline of keeping it current, which the backlog enforces.

### 2.4 Privacy Act 1988 and the Australian Privacy Principles

Menstrual, fertility and sexual-activity records are health information and therefore sensitive information under the Privacy Act, which requires consent to collect and limits use to the primary purpose. The small-business exemption should not be relied on: an organisation that provides a health service and holds health information is an APP entity regardless of turnover, and whether a cycle tracker "provides a health service" is unsettled; treat Sanguine as an APP entity. The architecture makes compliance mostly structural: the developer collects no personal information at all because there are no accounts, no server-side storage and no telemetry. The Privacy and Other Legislation Amendment Act 2024 added a statutory tort for serious invasions of privacy (in force 10 June 2025), clarified that reasonable security steps include technical and organisational measures, and requires the OAIC to register a Children's Online Privacy Code by 10 December 2026 ([MinterEllison summary](https://www.minterellison.com/articles/privacy-and-other-legislation-amendment-act-2024-now-in-effect); [Corrs](https://corrs.com.au/insights/australias-ongoing-privacy-reforms-bolstering-australias-privacy-regulatory-framework)). The Code will bind services likely to be accessed by under-18s, so onboarding asks age, enforces a 13-year minimum, and the teen mode defaults to the most private settings.

Concrete obligations retained even with no server: a plain-language privacy policy (APP 1); collection notice at onboarding (APP 5); the user's own export and delete functions satisfy access and correction (APP 12–13); and a Notifiable Data Breach procedure that is short because the developer holds no data.

### 2.5 GDPR and US state health-data laws

For EU and UK release, cycle data is special-category data under GDPR Article 9; explicit consent at onboarding is the lawful basis, and the no-server design means the developer is arguably not a controller of health data at all, though the app store listing, support email and any backup relay still need a controller identity, a DPIA on file and a representative. For the US, Washington's My Health My Data Act (in force 31 March 2024) covers any app collecting consumer health data from Washington residents, with no revenue threshold and a private right of action; Nevada's SB 370 and Connecticut's amendments to the CTDPA impose similar consent and policy duties with attorney-general enforcement ([Fisher Phillips](https://www.fisherphillips.com/en/news-insights/beyond-hipaa-states-join-trend-to-protect-consumer-health-data.html); [Paubox](https://www.paubox.com/blog/the-state-laws-that-regulate-health-data-outside-of-hipaa)). Sanguine satisfies these by construction (no collection, no sharing, no sale, no geofencing) and needs only the published consumer-health-data privacy policy and the in-app consent record.

Two residual exposures remain and are addressed in the architecture: the optional backup blob sits in the user's own iCloud or Google Drive account under the user's platform credentials, so a subpoena goes to Apple or Google and returns ciphertext; and Health sync writes data into the platform health store, which has its own legal regime, so the permission screen says this plainly.

## 3. Medical foundations

The engine rests on nine parameters, every one of which traces to a retrieved primary source below; where the literature disagrees the table shows both values and the choice is justified in the notes. The dominant fact is that cycle-length variation comes from the follicular phase, so ovulation cannot be located from the calendar alone and the app must say so.

### 3.1 Research scope

The engine depends on answers to these questions, in this priority order:

1. Population distribution of cycle length, bleed length, follicular and luteal phase length, and how each shifts with age and BMI.
2. Within-person variability of cycle length, and how much of it sits in the follicular phase.
3. Day-specific probability of conception relative to ovulation (the fertile window).
4. Timing of each biomarker relative to ovulation: LH surge onset and peak, BBT rise, cervical mucus peak.
5. Detection accuracy of each biomarker, and of wearable skin temperature compared with oral BBT.
6. How self-tracking artefacts (missed logs) distort observed cycle lengths and how published models handle them.
7. Clinical normal ranges and flag thresholds: FIGO frequency, regularity, duration; adolescent and PCOS definitions; menopausal-transition criteria.
8. Effect of life states: hormonal contraception, stopping it, postpartum, breastfeeding, perimenopause.
9. Whether non-biomarker symptoms carry any predictive value for ovulation or period onset.

### 3.2 Evidence table

| Parameter | Study | n | Population | Method | Value (95% CI or SD) | Limitations and choice |
| --- | --- | --- | --- | --- | --- | --- |
| Mean cycle length | [Bull 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6710244) | 612,613 cycles, 124,648 users | Natural Cycles users 18–45, Sweden/UK/US, not on hormonal contraception, PCOS excluded | App-logged menses with BBT-confirmed ovulation | 29.3 ± 5.2 d; 13% of cycles are 28 d; 65% are 25–30 d | Ovulatory cycles only, app users; funded by Natural Cycles. Chosen as prior mean because of size and agreement with Fehring |
| Mean cycle length (independent check) | [Fehring 2006](https://pubmed.ncbi.nlm.nih.gov/16700687/) | 1,060 cycles, 141 women | Healthy, regularly cycling, mean age 29 | Clearblue monitor (LH) | 28.9 d (SD 3.4); 95% of cycles 22–36 d | Selected regular cyclers, so narrower SD; used to confirm the prior mean, not its spread |
| Median cycle length (independent check) | [Li 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8714275) | 2M+ cycles, 186,106 users | Clue users, median age 25 | Period self-tracking only | Median 29 d | Includes anovulatory cycles and artefacts; confirms a prior centred near 29 rather than 28 |
| Per-person cycle-length SD | Bull 2019 | as above | as above | SD of each user's cycle lengths | Mean 2.6 d (SD 2.5); 2.9 d at 18–24, 2.3 d at 35–39, rising to 3.1 d at 45 | Right-skewed; the engine uses a log-normal-shaped prior on the variance with mean 2.6² |
| Within-person range | Fehring 2006 | as above | as above | Shortest-to-longest difference | 42.5% of women varied by more than 7 d | Shows that "regular" users still swing a week; motivates interval width floor |
| Age effect on cycle length | Bull 2019 | as above | 25–45 | Linear regression | −0.176 d per year (CI −0.168 to −0.183), R² 0.99; 30.3 d at 18–24, 27.4 d at 40–45 | Flat below 25; engine uses age-band prior means |
| Follicular phase length | Bull 2019 | as above | as above | Menses to estimated ovulation (BBT) | 16.9 ± 5.3 d; 12.4 d in 21–24 d cycles, 15.2 d in 25–30, 19.5 d in 31–35, 26.8 d in 36–50 | Ovulation day = last low temperature; ±1 d resolution. Confirms ovulation on day 14 is the exception |
| Luteal phase length | Bull 2019 | as above | as above | Day after ovulation to day before next menses | 12.4 ± 2.4 d; 11.0 d in 21–24 d cycles, 12.9 d in 31–50 d cycles; 18% under 11 d | Lenton 1984 (n=327) and Vollman report 14 d medians in clinic cohorts; engine uses 12.4 ± 2.4 because of sample size and the Baird reference match reported by Bull |
| Fertile window | [Wilcox 1995](https://carta.anthropogeny.org/node/310410) (NEJM 333:1517) | 625 cycles, 221 women | Healthy women planning pregnancy | Urinary E/P metabolite ovulation day, daily intercourse diaries | Conception only from intercourse in the 6 days ending on ovulation day; probability 0.10 at day −5 rising to 0.33 on day 0 | Single cohort, 1980s US; universally adopted. Engine fertile window = ovulation − 5 to ovulation day |
| Fertile-window timing in the cycle | [Wilcox 2000](https://pubmed.ncbi.nlm.nih.gov/11082086/) (BMJ 321:1259) | 696 cycles, 221 women | Same cohort | Same | Every day 6–21 has ≥10% probability of being in the window; only \~30% of women have the window wholly within days 10–17; 4–6% still potentially fertile in week 5 | Justifies showing a range and never a single fertile day; justifies the "late ovulation cannot be predicted" wording |
| LH surge to ovulation | [Ecochard 2001](https://pubmed.ncbi.nlm.nih.gov/11510707/) | 326 cycles | Normal cycles, ultrasound-dated | Ultrasound vs urinary LH, BBT, mucus | LH peak to follicle rupture +0.46 d on average; premature in \~10% and late in \~23% of cycles; surge onset 28–48 h before rupture (Bull 2019 citing Godbert 2015) | Engine sets ovulation = first positive LH + 1 d with SD 1 d |
| BBT rise as ovulation marker | Ecochard 2001; [Guida 1999 summary](https://www.aafp.org/afp/2001/0901/p858.html) | 326 and 101 cycles | Normal and infertile women | BBT vs ultrasound | Rise observed in 98% of cycles (Ecochard); sensitivity 0.77, specificity 0.33 vs ultrasound (Guida); nadir unreliable | BBT confirms ovulation after the fact; it cannot predict it. Engine uses the rise retrospectively only |
| BBT shift magnitude | Bull 2019 (citing de Mouzon 1984, Su 2017) | — | — | Oral sublingual BBT | 0.2–0.3 °C sustained rise following ovulation; first high point most often 2 d after LH peak | Engine coverline rule requires ≥0.2 °C |
| Cervical mucus peak day | Ecochard 2001; [Prior/Bouchard summary](https://pmc.ncbi.nlm.nih.gov/articles/PMC6081768/) | 326 cycles | as above | Self-observed peak vs ultrasound | Peak within ±1 d of ovulation in nearly 70% of cycles; detected in 76% of cycles; within ±2 d of LH surge in 91% | Engine sets ovulation = peak day with SD 1.5 d |
| Wrist skin temperature vs oral BBT | [Zhu 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8238491/) (JMIR) | 193 cycles, 57 women | Healthy, Ava bracelet | LH tests as reference | Shift detected: sensitivity 0.62 wrist vs 0.23 oral; probability ovulation occurred given a shift 86% vs 85%; wrist rise \~0.50 °C vs 0.20 °C oral | Ava-funded; wrist temperature is larger-amplitude and noisier, needs its own coverline |
| Finger skin temperature (ring) | [Maijala 2019](https://pubmed.ncbi.nlm.nih.gov/31783840/) | 22 women, \~115 d each | Volunteers, Oura ring | LH tests | Luteal−follicular difference 0.30 °C skin vs 0.23 °C oral; ovulation detected with 83% sensitivity within −3 to +2 d | Small pilot; industry authors |
| Watch wrist temperature (Galaxy) | [Kim (SKKU) 2025](https://scholarx.skku.edu/item/c076f260-522c-43cb-a0fd-3d330decb736) | 225 cycles, 85 women | Galaxy Watch 5 | Progesterone-confirmed ovulation | Ovulation within ±2 d in 64%, ±3 d in 78% of cycles | Confirms wearable estimates are ±2–3 d, not ±1; shown as a range |
| Normal bleeding parameters | [FIGO 2018 (Munro)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10952771/), summarised in the [Merck table](https://www.merckmanuals.com/professional/multimedia/table/normal-menstrual-parameters) | consensus | Reproductive-age, non-pregnant | Expert consensus on 5th–95th centiles | Frequency 24–38 d; regularity ≤7–9 d shortest-to-longest (≤9 at 18–25 and 42–45, ≤7 at 26–41); duration ≤8 d; volume by patient report | Thresholds for health flags |
| Adolescent irregularity | [International PCOS Guideline 2023](https://www.aafp.org/afp/2024/1100/practice-guidelines-polycystic-ovary-syndrome); [adolescent table](https://bmcmedicine.biomedcentral.com/articles/10.1186/s12916-020-01516-x/tables/4) | consensus | Post-menarche | Guideline | <1 yr post-menarche: irregularity is normal; 1–3 yr: <21 or >45 d; >3 yr to perimenopause: <21 or >35 d or <8 cycles/yr; any cycle >90 d after 1 yr | Age-aware flag thresholds; avoids flagging normal pubertal transition |
| Menopausal transition markers | [STRAW+10, Harlow 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3232023/) | consensus plus cohorts | 40+ | Menstrual calendar criteria | Early transition: persistent ≥7 d difference between consecutive cycles; late transition: an episode of ≥60 d amenorrhoea | Drives the perimenopause life state and widened intervals |
| Postpartum return of ovulation | [Jackson & Glasier 2011](https://rrmacademy.org/library/return-of-ovulation-and-menses-in-postpartum-nonlactating-women-a-systematic-rev-lrudv46h/) | systematic review | Non-lactating | Pregnanediol, BBT | Mean first ovulation day 45–94 postpartum; most do not ovulate before 6 weeks; 20–71% of first menses preceded by ovulation | Suspend prediction; no breastfeeding figure retrieved (VERIFY) |
| Return of fertility after contraception | [Girum 2018](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6055351/) | 22 studies, 14,884 women | Various methods | Meta-analysis | 83.1% pregnant within 12 months (CI 78–88); no difference hormonal vs IUD; injectable and implant users slowest | Supports a 3-cycle warm-up state after stopping; time to first ovulation not pooled (VERIFY) |
| Self-tracking artefacts | [Li 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7250828/), Li 2022 | 4.9M cycles | Clue users | Generative model with skip indicator | Missed period logs produce artificially long cycles; models that ignore this mis-estimate variability | Engine excludes implausible cycles from the update and keeps them for irregularity flags |
| Symptom predictive value (cramps, mood, acne, breast tenderness, mittelschmerz) | No retrieved study quantifies these as ovulation or onset predictors at population level; Li 2020 finds symptom-tracking patterns associate with variability but does not predict timing | — | — | — | — | VERIFY. Treated as insights only; a per-user learned pattern is shown but never changes a prediction |

### 3.3 What the evidence settles

- The prior is 29.3 d, not 28, and ovulation sits a median 16–17 days after menses, not 14; both change with age.
- Luteal length is the stable quantity (SD 2.4 d), so counting back from a predicted period is a reasonable ovulation estimate only when no biomarker exists, and it must carry the combined uncertainty of both.
- Calendar-only fertile-window predictions miss the window outright in a large minority of cycles ([Wilcox 2000](https://pubmed.ncbi.nlm.nih.gov/11082086/)); the UI therefore shows ranges and a confidence band, never a highlighted "fertile day".
- BBT and skin temperature confirm ovulation retrospectively with sensitivity 0.6–0.8; LH and mucus peak locate it to within a day or two prospectively.
- Wearable temperature is a different signal from oral BBT (larger amplitude, different noise) and gets its own baseline; Natural Cycles likewise refuses to mix oral and Apple Watch readings on one coverline.

### 3.4 Where evidence is weak or contested

- Luteal phase medians of 12.4 d (app data) versus 14 d (older clinic cohorts) disagree; app data probably includes some anovulatory cycles misread as short luteal phases, so the engine treats a luteal phase under 10 d as uncertain rather than as a finding.
- All large wearable validations are industry-authored (Ava, Oura, Samsung, Natural Cycles). Independent accuracy for Apple's wrist temperature was not retrieved (VERIFY).
- Breastfeeding return of fertility, time to first ovulation after stopping specific contraceptives, and any population-level symptom-timing effect were not found in retrieved sources and are marked VERIFY wherever used.

## 4. Prediction engine specification

The engine is one pure TypeScript package, `@sanguine/engine`, with no React, platform or I/O dependency: `predict(history, settings, today)` returns a `Prediction` and nothing else, so the same call runs in unit tests, in a Node backtest and on the phone. It uses a Bayesian Normal-Inverse-Gamma (NIG) cycle-length model with a population prior, a luteal-phase model for ovulation, retrospective biomarker overrides, and explicit data-quality and life-state gates, all chosen on the prototype results in 4.13.

### 4.1 Principles

- Deterministic: same inputs, same output, byte for byte; no `Date.now()` or randomness inside the package.
- Every number is a distribution: point, 80% interval, 95% interval, and a confidence grade.
- Biomarkers can move ovulation estimates; symptoms never can.
- Recalculation is total, not incremental: any change to history re-runs `predict` over the full valid history (sub-millisecond for 12 cycles), which makes corrections and back-dated entries trivially correct.
- Wording is produced by the UI from structured `Prediction` fields, never by the engine, so regulatory text is version-controlled in one place.

### 4.2 Core types

```ts
export type ISODate = string;                    // 'YYYY-MM-DD', local calendar day
export type Provenance = 'manual' | 'imported' | 'sensor';

export interface CycleRecord {
  id: string;
  start: ISODate;                               // first day of bleeding (not spotting)
  end?: ISODate;                                // last bleeding day
  nextStart?: ISODate;                          // derived: start of following cycle
  length?: number;                              // derived: nextStart - start, days
  bleedDays?: number;
  quality: 'valid' | 'suspect_skip' | 'suspect_short' | 'user_excluded' | 'life_state';
  ovulation?: OvulationEstimate;                // retrospective, from biomarkers
}

export interface TemperatureReading {
  date: ISODate; valueC: number; timeOfDay?: string; // 'HH:MM'
  source: 'oral' | 'wrist' | 'finger' | 'vaginal' | 'other';
  provenance: Provenance; disturbed?: boolean; disturbanceReason?: string;
}
export interface LhTest   { date: ISODate; result: 'negative' | 'positive' | 'high' | 'peak' | 'indeterminate'; provenance: Provenance }
export interface MucusObs { date: ISODate; quality: 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite'; provenance: Provenance }
export interface CervixObs{ date: ISODate; position: 'low' | 'mid' | 'high'; firmness: 'firm' | 'medium' | 'soft'; opening: 'closed' | 'partial' | 'open' }

export type LifeState =
  | { kind: 'none' }
  | { kind: 'hormonal_contraception'; method: 'combined_pill' | 'pop' | 'implant' | 'injection' | 'hormonal_iud' | 'ring' | 'patch'; since: ISODate }
  | { kind: 'post_contraception'; stopped: ISODate; method: string }
  | { kind: 'pregnant'; since: ISODate }
  | { kind: 'postpartum'; delivered: ISODate; breastfeeding: boolean }
  | { kind: 'perimenopause'; since: ISODate }
  | { kind: 'known_irregular'; reason: 'pcos' | 'other'; since: ISODate };

export interface EngineSettings {
  birthYear?: number; menarcheYear?: number;
  lifeStates: Array<LifeState & { until?: ISODate }>;
  recencyLambda: number;        // shipped default 1 (D-021); 0.92 was proposed and failed the §4.15 gate
  window: number;               // default 12 cycles
}

export interface Interval { lo: ISODate; hi: ISODate }
export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface Prediction {
  engineVersion: string;
  asOf: ISODate;
  suspended?: { reason: string };                // life state blocks prediction
  nextPeriod?: { point: ISODate; i80: Interval; i95: Interval; confidence: Confidence; daysOfDataUsed: number };
  cycleLength: { mean: number; sd: number; nu: number; scale: number; nCyclesUsed: number };
  ovulation?: { point: ISODate; i80: Interval; sd: number; confidence: Confidence; basis: 'calendar' | 'bbt' | 'lh' | 'mucus' | 'combined' };
  fertileDays?: Array<{ date: ISODate; pInWindow: number }>;  // Wilcox 6-day window, probability-weighted
  currentPhase?: { phase: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'late'; dayOfCycle: number };
  flags: HealthFlag[];
  cycleQuality: Array<{ cycleId: string; quality: CycleRecord['quality']; reason?: string }>;
}
```

### 4.3 Cycle-length model

**Model.** Each person's cycle length L is Normal(μ, σ²) with unknown μ and σ². The conjugate NIG prior is set from the population: m₀ (prior mean), κ₀ (pseudo-cycles backing the mean), α₀ and β₀ (pseudo-cycles and scale backing the variance). After observing weighted cycles the posterior is still NIG and the predictive distribution for the next length is a Student-t.

```latex
\text{Prior: } \mu \mid \sigma^2 \sim N(m_0, \sigma^2/\kappa_0), \quad \sigma^2 \sim \text{Inv-Gamma}(\alpha_0, \beta_0)
```

```latex
W = \sum_i w_i, \quad \bar{x} = \frac{\sum_i w_i x_i}{W}, \quad S = \sum_i w_i (x_i - \bar{x})^2, \quad w_i = \lambda^{\,n - i}
```

```latex
\kappa_n = \kappa_0 + W, \quad m_n = \frac{\kappa_0 m_0 + W \bar{x}}{\kappa_n}, \quad \alpha_n = \alpha_0 + \frac{W}{2}, \quad \beta_n = \beta_0 + \frac{S}{2} + \frac{\kappa_0 W (\bar{x} - m_0)^2}{2 \kappa_n}
```

```latex
L_{\text{next}} \sim t_{2\alpha_n}\!\left(m_n,\; \sqrt{\tfrac{\beta_n(\kappa_n + 1)}{\alpha_n \kappa_n}}\right), \qquad \text{80\% PI} = m_n \pm t_{0.90,\,2\alpha_n}\cdot\text{scale}
```

**Parameters** (all from section 3):

| Parameter | Value | Source |
| --- | --- | --- |
| m₀ | 29.3 d; by age band 30.3 (≤24), 29.9 (25–29), 29.2 (30–34), 28.2 (35–39), 27.4 (40–45); 29.3 if age unknown | Bull 2019 Table 2 |
| κ₀ | 0.5 | Tuned in prototype so the cold-start 80% interval equals the population spread (±6.7 d) |
| α₀ | 2.5 (5 pseudo-cycles of variance information) | Prototype: calibrated 80% coverage at 1–3 cycles |
| β₀ | α₀ · 2.6² = 16.9 | Bull 2019 mean per-user SD 2.6 d |
| λ (recency) | 1, no recency weighting (D-021). 0.92 was proposed; the §4.15 acceptance backtest measured a 4.9% gain against the 15% required, so the plan's own fallback ships. The perimenopause state uses 0.8 (§4.9) | Cycle length drifts about −0.18 d/yr (Bull) and transition onset is marked by abrupt change (STRAW+10); at 0.8 a step change is tracked 12% better, which is why only the perimenopause state uses it |
| window | last 12 valid cycles | Median user has 11 cycles tracked (Li 2022); older cycles are near-weightless under λ |
| hard bounds | lengths 15–90 d accepted, else `suspect` | Bull 2019 acceptance range |

**Cold start.**

| Logged cycles | What is predicted | Prior used | 80% interval (age unknown) |
| --- | --- | --- | --- |
| 0, but a last period date | Next period = last start + 29.3 d | Population prior, age-banded | ±6.6 d (22.7–35.9 d) |
| 0, no last period | Nothing; Today shows phase-free state and asks for last period | — | — |
| 1 | Posterior blends last length with prior (κ₀ = 0.5 so the observed cycle gets two thirds of the weight) | e.g. one 31-day cycle → mean 30.4 | 26.0–34.9 d |
| 2 | As above; no outlier exclusion yet (cannot tell which is odd) | — | about ±4.5 d |
| 3+ | Full model with robust exclusion (4.4) | — | ±3.3 d by 3 cycles for a regular user, narrowing to ±2.5 d by 8 |

If the user enters a "usual cycle length" at onboarding it is treated as one observation with weight 0.5, never as truth.

### 4.4 Data quality and recalculation

`classifyCycles` runs before the model on every call:

1. Length below 15 d: `suspect_short` (likely spotting logged as a period, or a correction gone wrong). Excluded from the update; the UI offers to merge or mark as spotting.
2. Length above 90 d: `suspect_skip`. Excluded.
3. With three or more cycles: median and MAD are computed over all lengths; a cycle longer than median + max(7, 3·1.4826·MAD) is `suspect_skip` and excluded from the mean and variance update, but still counted toward the irregularity and long-cycle flags. The Li 2022 adherence model motivates this split: a skipped log looks like two cycles merged, and treating it as physiology inflates the variance for a year.
4. A cycle marked `user_excluded` or overlapping a life state is removed from the update and from flags.
5. Back-dated and corrected entries simply change `start`/`end` values; the full history is reclassified and `predict` re-runs. Predictions never cache intermediate state.
6. An open cycle beyond the 95% upper bound is not a late period until it exceeds the bound; Today shows "period expected by" with the interval, then "later than usual, nothing to do yet" up to 90 days, then a missed-period flag.

The UI, not the engine, asks the user about a `suspect_skip` ("Did you have a period around 3 Sep that wasn't logged?") and writes the answer back as either a new period or `user_confirmed_long`, which re-admits the cycle.

### 4.5 Phase model and ovulation without biomarkers

Luteal length is modelled with its own NIG (m₀ 12.4, κ₀ 10, α₀ 5, β₀ 5·2.4²) updated by the person's own biomarker-dated luteal phases. Without biomarkers in the current cycle, ovulation day O = (predicted cycle length) − (luteal length), and because both are independent uncertainties:

```latex
\mathbb{E}[O] = m_n - \ell_n \ \text{(cycle day; offset } m_n - \ell_n - 1 \text{ from the start)}, \qquad \mathrm{SD}[O] = \sqrt{\mathrm{Var}[L_{\text{next}}] + \mathrm{Var}[\text{luteal}]}
```

Here O is a cycle day (day 1 = first bleeding day), matching the luteal definition (day after ovulation to the day before the next period); the engine stores ovulation as an offset from the cycle start, m_n − ℓ_n − 1 (D-098: it had used m_n − ℓ_n, one day late). For a regular user with three cycles (fixture A) that gives cycle day 16.6 (offset 15.6) with SD 3.95 d: an 80% range of roughly offsets 11 to 21. That width is the honest answer and is what Wilcox 2000 found empirically, so the UI shows it as a band. Follicular length is never modelled directly; it is the remainder.

### 4.6 Biomarker integration

**BBT shift detection.** Primary rule is the symptothermal three-over-six: find the first day whose temperature, and the two following valid temperatures, all exceed the maximum of the preceding six valid temperatures; the third high temperature must be at least 0.2 °C above that maximum (Sensiplan convention; the 0.2–0.3 °C rise is from de Mouzon via Bull 2019). Coverline = that six-day maximum. Ovulation = the day before the first high temperature (Bull 2019's "last low temperature" convention), SD 1.5 d. A CUSUM over the follicular mean with threshold 0.5 °C-days is run as a secondary detector; if the two disagree by more than 2 days the shift is reported with SD 2.5 d and `confidence: 'low'`. Detection requires valid temperatures on at least 50% of cycle days to date, the same floor Bull 2019 used.

**Disturbed temperatures.** A reading is excluded when the user flags it (illness, alcohol, fewer than 3 h sleep, late wake), when it is outside 35.0–37.5 °C oral, or when its time of day differs from the person's median measurement time by more than 60 minutes. No time-drift correction is applied: the published slope of BBT with wake time is small and inconsistent, so exclusion is safer than adjustment (VERIFY if a correction is wanted later). A single excluded day does not break the three-over-six count; two consecutive do.

**Wearable temperature.** Wrist and finger readings are kept on a separate series with their own coverline and are never mixed with oral readings, following Natural Cycles' Apple Watch practice and the amplitude difference in Zhu 2021 (0.50 °C vs 0.20 °C). Threshold is 0.3 °C over the six-day maximum, nightly value = the device's nightly aggregate (Apple's `appleSleepingWristTemperature` is one value per night; Health Connect `SkinTemperatureRecord` provides deltas from a baseline, which are used directly). Detected shifts carry SD 2.0 d, reflecting the ±2–3 d accuracy reported for watch-based estimates.

**LH.** First positive (or `peak`) test after at least one negative: ovulation = test day + 1, SD 1.0 d. A positive with no prior negative in the previous 2 days: SD 1.5 d (could be day two of the surge). A positive followed by positives for more than 3 days: `indeterminate`, SD 2.5 d, no override. Ecochard 2001 found LH-expected ovulation premature in \~10% and late in \~23% of cycles, which is why SD is 1.0 and not 0.5.

**Cervical mucus.** Peak day = last day of eggwhite or watery mucus before a change to sticky or dry that persists 3 days. Ovulation = peak day, SD 1.5 d (±1 d in \~70% of cycles, Ecochard 2001).

**Cervical position.** High, soft, open for ≥2 days followed by low, firm, closed: ovulation = last high day, SD 2.5 d, weight capped so it never dominates. No retrieved study quantifies its accuracy (VERIFY).

**Conflict resolution.** Each available signal gives (estimate, SD). The combined estimate is the inverse-variance weighted mean, with two gates: a BBT or wearable shift must fall no more than 1 day before and no more than 4 days after the LH or mucus estimate, otherwise the temperature shift is discarded for that cycle (temporally impossible); and if any two kept signals disagree by more than 3 days the engine uses the single most precise one and sets `basis` to that signal and `confidence: 'low'`, and the UI says the signals disagree. Once a cycle closes, the combined estimate becomes that cycle's `ovulation` and its luteal length updates the luteal model.

### 4.7 Provenance weighting

| Provenance | Variance multiplier on the signal's SD | Reason |
| --- | --- | --- |
| `sensor` (wearable via Health, device-attributed) | 1.0 for temperature series; period flow from a sensor does not exist | Device values are consistent night to night |
| `manual` | 1.0 for period dates and LH; 1.0 for oral BBT with a timestamp, 1.3 without | Untimed readings are the main BBT noise source |
| `imported` (another app via Health) | 1.0 for period dates; 1.5 for BBT and LH (unknown protocol); mucus 2.0 | Imported category semantics vary between apps |

A period start that exists only as an import is accepted as a real start but is shown with an "imported" chip until the user confirms it; confirmation sets provenance to `manual`.

### 4.8 Fertile window and confidence

The biological window is the five days before ovulation and ovulation day (Wilcox 1995). Because ovulation day is itself uncertain, each calendar day d gets a probability of lying inside the window:

```latex
p(d) = P(d \le O \le d + 5) = \Phi\!\left(\tfrac{d + 5.5 - \mathbb{E}[O]}{\mathrm{SD}[O]}\right) - \Phi\!\left(\tfrac{d - 0.5 - \mathbb{E}[O]}{\mathrm{SD}[O]}\right)
```

For fixture A this peaks at 0.55 on day 14 and stays above 0.2 from day 8 to day 20, which the calendar renders as a graded band, not a boxed six days. Confidence grade: `high` when SD\[O\] ≤ 1.5 (LH or mucus confirmed this cycle), `medium` when 1.5 < SD ≤ 3 (wearable or BBT shift, or a well-established user), `low` when SD > 3 (calendar only), `none` when suspended. The card always carries the 2.3 wording.

### 4.9 Life states

| State | Effect on prediction | Rule |
| --- | --- | --- |
| Hormonal contraception (combined pill, ring, patch) | Suspended. Bleeds are logged as `withdrawal_bleed`, shown on the calendar, never used as cycle starts | Withdrawal bleeds are not menses; no ovulation estimate, no fertile band, no cycle flags |
| Progestogen-only methods, implant, injection, hormonal IUD | Suspended; bleeding logged as `bleeding_on_contraception` | Patterns are method effects |
| Post-contraception (first 3 cycles after stopping) | Predictions run with the population prior only (κ₀ = 0.5, no history), labelled `low`; cycles are kept but weighted 0.5 until three post-stop cycles exist | Return of ovulation varies by method (Girum 2018; progestin review) |
| Pregnant | Suspended; cycle history frozen; optional pregnancy week shown | — |
| Postpartum, not breastfeeding | Suspended until first logged period; then as post-contraception | Most do not ovulate before 6 weeks; first menses often anovulatory (Jackson & Glasier 2011) |
| Postpartum, breastfeeding | Suspended until first period, then low-confidence mode for three cycles; no fertile band until an ovulation is biomarker-confirmed | No breastfeeding timing figure retrieved (VERIFY) |
| Pregnancy loss | As postpartum, not breastfeeding: suspended until the first logged period, then the 3-cycle warm-up. Ending a pregnancy records the outcome (birth or loss); bleeding within 14 days of a loss (42 after a birth) is logged as post-pregnancy bleeding and does not start a cycle unless the user chooses "My period". A past pregnancy can be marked on an unusually long cycle in Insights ("I was pregnant"), which pauses that cycle and the one its ending bleed starts | No retrieved figure for the return of ovulation after an early loss (VERIFY); conservative default D-053 |
| Perimenopause (self-reported, or auto-suggested when STRAW+10 early-transition criterion is met at age ≥40) | Predictions continue with λ = 0.8 and the variance prior doubled; fertile band shown only with biomarkers; the 60-day amenorrhoea flag replaces the 38-day one | Harlow 2012 |
| PCOS or known irregular | Predictions continue; robust exclusion threshold raised to median + max(14, 3·MAD); confidence capped at `medium`; adolescent thresholds apply if within 3 years of menarche | 2023 PCOS guideline |

### 4.10 Health flags

Flags are computed from valid cycles only, are age-aware, and never name a condition. Each fires at most once per 90 days and can be muted.

| Flag | Threshold | Source | In-app wording |
| --- | --- | --- | --- |
| Short cycles | 2 of the last 3 valid cycles < 24 d (adults ≥3 yr post-menarche); < 21 d within 1–3 yr of menarche | FIGO 2018; PCOS 2023 | "Your recent cycles have been shorter than the 24-day lower end of the range most guidelines call typical. A doctor can help you check." |
| Long cycles | 2 of the last 3 valid cycles > 38 d (adults); > 45 d within 1–3 yr of menarche; any single cycle > 90 d after 1 yr post-menarche | FIGO 2018; PCOS 2023 | "Two of your last three cycles were longer than 38 days…" |
| High variability | Shortest-to-longest difference over the last 6 valid cycles > 9 d (18–25 and 42–45) or > 7 d (26–41), excluding post-contraception and postpartum cycles; not shown in the first year after menarche | FIGO 2018; PCOS 2023 | "Your cycle lengths have varied by more than 9 days over the last six cycles. That is more variation than most guidelines call typical." |
| Heavy bleeding | User logs `heavy` on ≥3 days of a period, or logs `flooding`/clots ≥2 periods in a row | FIGO volume is patient-reported | "You've logged heavy bleeding on several days for two periods running. Heavy periods are common and treatable; a doctor can help." |
| Prolonged bleeding | Bleed length > 8 d in 2 consecutive periods | FIGO 2018 | — |
| Intermenstrual bleeding | Bleeding logged outside menses in 2 of the last 3 cycles | FIGO 2018 lists IMB as abnormal | Always offered the doctor prompt; no threshold tuning |
| Missed period | Open cycle > max(90 d, 95% upper bound + 14 d) with no life state; or > 60 d at age ≥ 40 (perimenopause suggestion) | PCOS 2023; STRAW+10 | "It's been more than 90 days since your last period…" plus a pregnancy-test suggestion when sexual activity was logged |
| Short luteal phase | Biomarker-dated luteal ≤ 9 d in 2 of 3 cycles | Lenton via Bull 2019 (contested) | Shown as insight only, low prominence, with the 10-day uncertainty note |

### 4.11 Main function signatures

```ts
export function predict(history: History, settings: EngineSettings, today: ISODate): Prediction;
export function classifyCycles(cycles: CycleRecord[], settings: EngineSettings): CycleRecord[];
export function fitCycleLength(lengths: number[], prior: NigPrior, lambda: number): NigPosterior;
export function predictiveInterval(p: NigPosterior, level: 0.8 | 0.95): [number, number];
export function detectBbtShift(series: TemperatureReading[], cycleStart: ISODate): ShiftResult | null;
export function detectLhSurge(tests: LhTest[], cycleStart: ISODate): OvulationEstimate | null;
export function detectMucusPeak(obs: MucusObs[], cycleStart: ISODate): OvulationEstimate | null;
export function combineOvulation(estimates: OvulationEstimate[]): OvulationEstimate;
export function fertileDayProbabilities(ov: OvulationEstimate, cycleStart: ISODate, horizonDays: number): Array<{ date: ISODate; pInWindow: number }>;
export function evaluateFlags(cycles: CycleRecord[], logs: DailyLog[], settings: EngineSettings, today: ISODate): HealthFlag[];
export function studentTQuantile(p: number, nu: number): number;   // own implementation, no deps
```

### 4.12 Worked fixtures (test cases)

Ovulation days in this table are offsets from the last period start (offset 0 = 1 Oct), as `fixtures.test.ts` reads them; they were shifted one day earlier by D-098. All values below were computed with the equations in 4.3 and are the expected outputs for the engine's golden tests (tolerance 0.05 d). Dates assume the last logged period started 1 Oct 2026 and `today` is 10 Oct 2026. All fixtures use λ = 1, the shipped default (D-021); `fixtures.test.ts` pins the fixture settings to `RECENCY_LAMBDA`, so a change to one without the other fails the golden tests.

| Fixture | Input lengths (oldest first) | Classification | Posterior mean | ν | scale | 80% PI (days) | Next period (point, 80%) | Ovulation (calendar) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A regular, 3 cycles | 28, 30, 29 | all valid | 29.04 | 8 | 2.40 | 25.7–32.4 | 30 Oct, 27 Oct–2 Nov | day 15.6, SD 3.95, 80% day 11–21 |
| B one skipped log, 6 cycles | 27, 29, 56, 28, 30, 28 | 56 → `suspect_skip` (threshold 35.5) | 28.48 | 10 | 2.16 | 25.5–31.4 | 29 Oct, 27 Oct–1 Nov | day 15.1, SD 3.9 |
| C cold start, age 37 | none | — | 28.2 | 5 | 4.50 | 21.6–34.8 | 29 Oct, 23 Oct–5 Nov | day 14.8, SD 5.4, `low` |
| D irregular, 6 cycles | 24, 38, 31, 45, 27, 36 | all valid (threshold 58) | 33.18 | 11 | 5.97 | 25.0–41.3 | 3 Nov, 26 Oct–11 Nov; high-variability flag fires (range 21 d) | day 19.8, SD 7.0, `low` |
| E single cycle | 31 | valid | 30.43 | 6 | 3.11 | 26.0–34.9 | 1 Nov, 27 Oct–5 Nov | — |
| F luteal update | fixture A plus biomarker-dated luteal phases 11, 12, 12 | — | luteal mean 12.23, ν 13, scale 2.22, 80% 9.2–15.2 |  |  |  |  | ovulation day 15.8, SD 3.6 |
| G LH override | fixture A, negative LH day 13, positive day 14 | — | — | — | — | — | — | ovulation day 15, SD 1.0, `high`, basis `lh`; fertile band p ≥ 0.8 on days 10–15 |
| H conflicting signals | fixture A, positive LH day 14, BBT shift first high day 23 | — | — | — | — | — | — | shift falls 8 d after LH: discarded; ovulation day 15 SD 1.0; `conflict: true` in cycleQuality |
| I contraception | fixture A, then life state combined pill from 1 Oct | — | — | — | — | — | suspended | none; bleeds logged as withdrawal |

Fertile probabilities for fixture A by offset (for the calendar band test, D-098): day 7 0.20, 9 0.35, 11 0.49, 13 0.55, 15 0.50, 17 0.37, 19 0.22, 21 0.11.

### 4.13 Prototype results

Four models were run on 4,000 synthetic users × 14 cycles drawn from the Bull 2019 distributions, in two populations (wide: between-user SD 4.5 d, 4% sporadic late ovulations; tight: 3.6 d, 3%) and with 0% or 8% of periods not logged. The target was always a real cycle. Code is in the research log.

| Model | Prior cycles | MAE (d), clean | 80% coverage, clean | MAE, 8% skipped | 80% coverage, 8% skipped | 80% width (d) |
| --- | --- | --- | --- | --- | --- | --- |
| A naive calendar (last cycle, fixed ±2 d) | 3 / 8 | 3.6 / 3.6 | 0.60 / 0.59 | 6.0 / 5.9 | 0.55 / 0.55 | 4.0 |
| B recency-weighted average, ±1.28·SD | 3 / 8 | 3.1 / 2.9 | 0.77 / 0.81 | 5.0 / 4.6 | 0.78 / 0.86 | 7.9–17 |
| C Bayesian NIG, population prior | 3 / 8 | 3.0 / 2.7 | 0.85 / 0.86 | 4.6 / 4.2 | 0.85 / 0.91 | 9.3–18 |
| D = C + robust skip exclusion (chosen) | 3 / 8 | 2.8 / 2.6 | 0.84 / 0.84 | 3.5 / 2.8 | 0.82 / 0.85 | 8.5–8.8 |

Readings: the naive window is overconfident in every condition (it claims 80% and delivers 55–60%); the weighted average is competitive on accuracy but its interval is unstable with few cycles; the Bayesian model is calibrated from the first cycle; adding robust exclusion halves the error under missed logs without widening the interval. Model D was selected on that basis. The remaining 3–5 point over-coverage at 80% is acceptable and errs toward honesty.

### 4.14 Review findings

Independent reviewers could not be run (no sub-agent or second-model access), so the engine was audited against the retrieved sources with a fixed checklist. Findings and what changed:

| # | Review | Finding | Resolution |
| --- | --- | --- | --- |
| M1 | Medical | Luteal prior of 14 d (textbook) would bias ovulation 1.6 d early relative to app-population data | Prior set to 12.4 ± 2.4 with the 10-day uncertainty note; flagged as contested in 3.4 |
| M2 | Medical | Treating any positive LH as ovulation day ignores the 28–48 h onset-to-rupture delay | Ovulation = positive + 1 d, SD 1.0 |
| M3 | Medical | Withdrawal bleeds on combined methods were initially counted as cycle starts in the fixture generator | Life-state gate added; fixture I added |
| M4 | Medical | Adolescent flags used adult 24–38 thresholds, which would flag normal pubertal variation | Age-since-menarche thresholds from the 2023 PCOS guideline; no variability flag in year 1 |
| M5 | Medical | Mixing oral and wrist temperatures on one coverline | Separate series and thresholds (4.6) |
| S1 | Statistical | Cold-start 80% interval (κ₀ = 1) covered only 68–76% of outcomes in the prototype | κ₀ lowered to 0.5; coverage 75–83% |
| S2 | Statistical | Excluding long cycles also from the flag computation would hide exactly the pattern flags exist for | Exclusion applies to the mean/variance update only |
| S3 | Statistical | Evaluating on targets that could themselves be merged cycles penalised the robust model unfairly | Target drawn from the clean process; results above |
| S4 | Statistical | Recency weighting λ = 0.92 is untested in the prototype | Tested in 4.15 and failed (D-021); λ = 1 ships |
| S5 | Statistical | Inverse-variance combination assumes independent signals; BBT and wearable temperature are not independent | Only one temperature series (the user's primary) enters the combination |

### 4.15 Ongoing validation plan

- Offline: a backtest harness in the engine repo replays every public or donated history (CSV import) as a rolling-origin forecast and reports MAE, 80%/95% coverage, interval width, PIT histogram and, for ovulation, error against LH-dated days. Release gate: coverage within ±5 points of nominal and MAE no worse than the previous version on the fixed synthetic suite.
- Acceptance for λ: on the synthetic suite with a step change in μ at cycle 8 (perimenopause scenario), λ = 0.92 must cut MAE over cycles 9–14 by ≥15% versus λ = 1 without raising clean-history MAE by more than 2%.
- On-device, no data leaves the phone: each closed cycle produces a local scoring record (predicted point, intervals, actual, confidence grade, basis). The Insights screen shows the person their own calibration ("your 80% ranges have been right 7 of 9 times"). Aggregate accuracy is learned only through an opt-in, user-initiated export of those scoring records (never raw logs) that the user can read before sending; v1 ships without any upload path at all.
- Property tests (fast-check): intervals contain the point; 95% contains 80%; adding an identical cycle never widens the interval; shifting all dates by k days shifts all outputs by k; any permutation of symptom logs leaves `nextPeriod` and `ovulation` unchanged.
- Clinical review: fixtures A–I and the flag table are the sign-off package for the clinician (section 11).

## 5. Data model

The store is append-only: every fact the user, a Health import or a sensor contributes is an immutable `event` row, and the queryable tables (`cycle`, `daily_log`, `biomarker`, `life_state`) are projections rebuilt from the event log. This is warranted because corrections, back-dated entries, Health imports that later get deleted, and "undo" are the common path in cycle tracking, not the exception, and an event log makes each of them a new row rather than a destructive update, keeps Health echo-prevention and conflict rules tractable, and gives the engine a complete, replayable history for backtests. The projections keep reads simple and fast.

### 5.1 Decision: event-sourced core with materialised projections

| Option | Corrections and back-dating | Health sync provenance | Export and audit | Complexity | Verdict |
| --- | --- | --- | --- | --- | --- |
| Plain mutable tables | In-place updates; history lost; sync echo needs extra tables | Hard: a changed row loses its origin | Only current state | Low | Rejected |
| Append-only event log + projections | Each correction is an event; replay rebuilds state | Every event carries source, external id, device | Full history; deterministic replay | Medium | Chosen |
| CRDT document store | Same as above plus automatic merge | Good | Good | High; no multi-device need in v1 | Deferred: the event log is CRDT-ready (append-only, UUID ids, Lamport clocks) if multi-device sync is added later |

### 5.2 Schema (SQLite via expo-sqlite with SQLCipher)

```sql
-- Immutable fact log. Never UPDATE or DELETE rows; retract with a 'retract' event.
CREATE TABLE event (
  id            TEXT PRIMARY KEY,            -- UUIDv7 (time-ordered)
  lamport       INTEGER NOT NULL,            -- monotonic per device
  device_id     TEXT NOT NULL,
  recorded_at   TEXT NOT NULL,               -- ISO-8601 with offset, when the user acted
  effective_day TEXT NOT NULL,               -- 'YYYY-MM-DD' local calendar day the fact is about
  tz            TEXT NOT NULL,               -- IANA zone at recording time
  kind          TEXT NOT NULL,               -- see event kinds below
  payload       TEXT NOT NULL,               -- JSON, schema-versioned by kind
  provenance    TEXT NOT NULL CHECK (provenance IN ('manual','imported','sensor')),
  source_app    TEXT,                        -- bundle id / package of origin app (Health imports)
  external_id   TEXT,                        -- HealthKit UUID or Health Connect record id
  retracts      TEXT REFERENCES event(id),   -- set when kind = 'retract'
  schema_v      INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX event_day ON event(effective_day);
CREATE INDEX event_ext ON event(external_id);

-- Projections (rebuildable; a 'rebuild' command drops and replays)
CREATE TABLE cycle (
  id            TEXT PRIMARY KEY,
  start_day     TEXT NOT NULL UNIQUE,
  end_day       TEXT,                        -- last bleeding day
  next_start    TEXT,
  length_days   INTEGER,
  bleed_days    INTEGER,
  quality       TEXT NOT NULL,               -- valid | suspect_skip | suspect_short | user_excluded | life_state
  ov_day        TEXT, ov_sd REAL, ov_basis TEXT,
  luteal_days   INTEGER
);
CREATE TABLE daily_log (
  day           TEXT PRIMARY KEY,
  flow          TEXT,                        -- none | spotting | light | medium | heavy
  flow_kind     TEXT,                        -- period | withdrawal_bleed | intermenstrual | on_contraception
  symptoms      TEXT NOT NULL DEFAULT '[]',  -- JSON array of {code, intensity 1-3}
  sex           TEXT,                        -- JSON {protected: bool} | null
  notes_cipher  BLOB,                        -- notes encrypted a second time with the app-lock key
  updated_event TEXT NOT NULL REFERENCES event(id)
);
CREATE TABLE biomarker (
  id            TEXT PRIMARY KEY,
  day           TEXT NOT NULL,
  type          TEXT NOT NULL,               -- bbt | skin_temp | lh | mucus | cervix | preg_test | progesterone
  value         TEXT NOT NULL,               -- JSON per type
  measured_at   TEXT,                        -- ISO-8601, for BBT time-of-day rule
  source        TEXT NOT NULL,               -- oral | wrist | finger | vaginal | strip | app
  provenance    TEXT NOT NULL,
  disturbed     INTEGER NOT NULL DEFAULT 0,
  event_id      TEXT NOT NULL REFERENCES event(id)
);
CREATE INDEX biomarker_day ON biomarker(day, type);
CREATE TABLE life_state (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, detail TEXT NOT NULL, from_day TEXT NOT NULL, until_day TEXT,
  event_id TEXT NOT NULL REFERENCES event(id)
);
CREATE TABLE prediction_score (                -- on-device calibration ledger (4.15)
  cycle_id TEXT PRIMARY KEY, engine_version TEXT, predicted_day TEXT, lo80 TEXT, hi80 TEXT,
  actual_day TEXT, basis TEXT, confidence TEXT, abs_error INTEGER, in80 INTEGER, in95 INTEGER
);
CREATE TABLE setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);   -- JSON values

-- Health sync state
CREATE TABLE health_sync (
  platform      TEXT NOT NULL,               -- healthkit | health_connect
  data_type     TEXT NOT NULL,               -- Sanguine type key
  direction     TEXT NOT NULL,               -- read | write | both | off
  anchor        TEXT,                        -- HK anchor (base64) or HC changes token
  last_sync_at  TEXT,
  PRIMARY KEY (platform, data_type)
);
CREATE TABLE health_link (                     -- maps our events to platform records for echo prevention and deletes
  event_id      TEXT NOT NULL REFERENCES event(id),
  platform      TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  direction     TEXT NOT NULL,               -- 'wrote' (we created it) | 'read' (we imported it)
  content_hash  TEXT NOT NULL,               -- sha256 of canonical (day, type, value)
  PRIMARY KEY (platform, external_id)
);
CREATE TABLE schema_migration (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
```

### 5.3 Event kinds

| kind | payload | Notes |
| --- | --- | --- |
| `period.start` | `{ day }` | Creates or moves a cycle start |
| `period.end` | `{ day }` | — |
| `flow` | `{ day, level, flow_kind }` | Logging a flow on a day with no open period implies `period.start` for that day unless `flow_kind` is non-period |
| `symptom` | `{ day, code, intensity }` | One event per symptom; intensity 0 retracts |
| `biomarker` | `{ day, type, value, source, measured_at, disturbed }` | — |
| `sex` | `{ day, protected }` | — |
| `life_state.set` / `life_state.end` | `{ kind, detail, day }` | — |
| `cycle.exclude` / `cycle.confirm_long` | `{ cycle_start, reason }` | User answers to data-quality prompts |
| `retract` | `{ }` with `retracts = <event id>` | Undo and deletion; also how a Health deletion is recorded |
| `import.batch` | \`{ source: 'flo' | 'clue' |
| `note` | `{ day, cipher }` | Encrypted separately so notes stay unreadable to a device-level attacker with the DB key but not the lock key |

### 5.4 Projection rules

- `cycle.start_day` is the earliest day of a run of `period` flow days; days up to 7 apart belong to one run while the run stays shorter than 15 days, unless two or more days inside the gap were cleared to no flow (D-052); continuous bleeding is never cut; a `period.end` marks every day from the period's last day up to it as a period day; a run shorter than one day of `light` or more is spotting, not a period.
- A `period.start` with `merge: false` begins a new period on its day even inside that window. When a logged day would join another period across a gap of 3 to 7 days, the logging sheet asks "Is it the same period?" and writes `merge: false` on the later day for "A new period" and `merge: true` for "Same period", with `asked_on` set to the day that asked; the latest answer for a day wins, and clearing either day retracts the answer.
- Retracting the only flow event of a period removes the cycle and re-links the neighbours; the engine then re-runs.
- Projections carry `updated_event`, so a rebuild from the log is idempotent and testable (property test: `project(events) == project(shuffle(events))` for commuting events).
- Migrations are numbered SQL files applied in order at launch inside a transaction; a projection-only migration is a rebuild; an event-schema migration bumps `schema_v` and includes an up-converter per kind. Events are never rewritten in place.

### 5.5 Day boundaries and time zones

Every event stores the local calendar day and the IANA zone it was recorded in; the engine works in calendar days only. Health records arrive as instants and are mapped to a day using the zone recorded on the sample where the platform supplies one (HealthKit metadata `HKMetadataKeyTimeZone`, Health Connect `startZoneOffset`), otherwise the device zone at import. A BBT taken at 05:30 is attributed to that day; a wrist temperature covering a night maps to the morning day of the sleep session's end.

## 6. Technical architecture

Sanguine is an Expo SDK 57 app built with prebuild (Continuous Native Generation) and a development client, because the Health libraries, SQLCipher and widgets all need native modules that Expo Go cannot load. Everything runs on the phone; the only network calls are app-store updates and the optional, client-side-encrypted backup to the user's own cloud account.

### 6.1 Stack (versions verified October 2026)

| Concern | Choice | Status and notes |
| --- | --- | --- |
| SDK | [Expo SDK 57](https://expo.dev/changelog/sdk-57) (React Native 0.86, React 19.2), New Architecture only | Released 30 June 2026, a no-breaking-change release; SDK 58 is in beta on RN 0.88 for iOS 27 and should be adopted at its stable release during Phase 1 ([SDK 58 beta](https://expo.dev/changelog/sdk-58-beta)) |
| Workflow | `npx expo prebuild` with config plugins; EAS Build or local builds; `expo-dev-client` | Native dirs are generated, never hand-edited |
| Routing | expo-router (file-based, typed routes, native tabs) | Decoupled from React Navigation since SDK 56 |
| State | Zustand store fed by projection queries; engine output memoised per history hash | No Redux; the event log is the source of truth, Zustand is a view cache |
| Database | `expo-sqlite` with the config plugin option `useSQLCipher: true` ([docs](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)) | Database key: 256-bit random, generated on first launch, stored in `expo-secure-store` (Keychain / Android Keystore, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Opening the DB runs `PRAGMA key` before any query |
| Migrations | Numbered SQL files bundled as assets; `schema_migration` table; projection rebuild on demand | — |
| Engine | `@sanguine/engine`, pure TS, published separately, pinned by the app | — |
| Background tasks | `expo-background-task` (WorkManager / BGTaskScheduler) for Health incremental sync and nightly prediction refresh; `expo-task-manager` | iOS runs background fetch at its discretion; nothing user-facing depends on it |
| Notifications | `expo-notifications`, local only, no push token ever requested | Scheduled from the prediction interval; rescheduled on every `predict` |
| Widgets | Expo widgets (`@expo/ui`-based, stable on iOS since SDK 56); Android Glance widget via the same module | Widget reads a small JSON snapshot written by the app, never the DB |
| App lock | `expo-local-authentication` (Face ID / fingerprint / passcode) gating the UI; notes are additionally encrypted with a key released only after unlock | — |
| UI toolkit | React Native primitives for content; `@expo/ui/swift-ui` and `@expo/ui/jetpack-compose` for native chrome (SwiftUI lists, form sheets, `MaterialExpressiveTheme`); `expo-glass-effect` for Liquid Glass surfaces on iOS 26+ with `expo-blur` fallback; expo-router native tabs; `react-native-reanimated` 4 for motion; `react-native-svg` for the ring and calendar bands | — |
| Localisation | `i18next` + `react-i18next`, ICU message format, `expo-localization` | Strings extracted to JSON; dates via `Intl` |
| Crash and analytics SDKs | None. Crashes are captured by the OS (Xcode Organizer, Play Console vitals) which contain no health data | Hard rule enforced by a dependency allow-list in CI |

### 6.2 Module layout

```text
apps/mobile/              Expo app (expo-router)
  app/                    routes: (tabs)/today, calendar, insights, settings/*
  features/logging, predictions, health-sync, backup, onboarding
  data/                   sqlite open/migrate, event writer, projections, repositories
  services/               notifications, widgets snapshot, app lock, export/import
packages/engine/          @sanguine/engine (pure TS; vitest + fast-check; golden fixtures)
packages/health-adapter/  platform-neutral sync core; HealthKit and Health Connect drivers
packages/crypto/          libsodium (react-native-libsodium) wrappers for backup
tools/backtest/           Node CLI replaying CSV histories through the engine
```

### 6.3 Optional end-to-end encrypted backup and sync

| Option | How | Developer can read data? | Cost | Multi-device | Verdict |
| --- | --- | --- | --- | --- | --- |
| Encrypted blob in the user's platform cloud (iCloud Drive app container / CloudKit private DB on iOS; Google Drive `appDataFolder` on Android) | App serialises the event log, encrypts with a key derived from a user passphrase (Argon2id) and a device-generated secret, uploads as one versioned file | No; Apple or Google hold ciphertext under the user's credentials | A$0 | Restore to a new device of the same platform; cross-platform via export file | Chosen |
| Minimal self-hosted relay (e.g. a Cloudflare Worker + R2) | Same ciphertext, developer-run bucket keyed by random id | No, but the developer now holds ciphertext and metadata (timestamps, sizes, IPs) and must run and defend it | \~A$5–20/month plus ops time; becomes a subpoena target | Any platform | Rejected for v1 |
| CRDT sync (Automerge / Yjs over a relay) | Per-event merge, true multi-device | Relay sees ciphertext | Relay cost plus engineering weeks | Yes | Deferred; event log is already CRDT-shaped |

Backup design: a `backup.v1` file = header (version, salt, nonce, kdf params) + XChaCha20-Poly1305 ciphertext of the gzipped event log + HMAC. Key = Argon2id(passphrase, salt, 64 MiB, 3 iterations) XOR a 256-bit device secret kept in Secure Store; both are needed, so a stolen cloud file plus a guessed passphrase is still insufficient unless the device secret was exported through the recovery-code screen. The user is shown the recovery code once and told that losing both means the backup is unrecoverable, by design. Upload runs only on Wi-Fi, after a change, at most once per hour.

### 6.4 Localisation

Australian English is the source locale; strings are ICU messages with plural and gender-neutral forms. Launch languages: en-AU, en-GB, en-US. Phase 4 adds de, fr, es, pt-BR using professional translators with a clinician check on health-flag and prediction copy; machine translation is not used for any sentence the regulatory wording table covers. Dates, first weekday and temperature units (°C default; °F only for en-US) follow `expo-localization`.

### 6.5 Testing strategy

| Layer | Tool | What it covers |
| --- | --- | --- |
| Engine unit | vitest, golden fixtures A–I | Every function in 4.11; interval maths against SciPy-generated expectations |
| Engine property | fast-check | Invariants in 4.15; permutation and translation invariance; monotone narrowing |
| Engine backtest | `tools/backtest` on synthetic suite and donated CSVs | Release gate metrics |
| Data layer | vitest with better-sqlite3 against the same SQL files | Migrations, projections, replay idempotence, retract semantics |
| Components | React Native Testing Library | Logging sheet taps, Today card states, accessibility labels |
| Health sync | Adapter core tested with a fake platform driver that records reads/writes; iOS driver exercised on simulator with seeded HealthKit data via a debug screen; Android driver exercised on an emulator using the Health Connect Toolbox to inject records | Echo prevention, deletion propagation, anchor resumption, time-zone mapping |
| E2E | Maestro flows on iOS simulator and Android emulator in CI | Onboarding, 2-tap period log, correction, backup round-trip, app lock |
| Accessibility | Axe for RN plus manual VoiceOver/TalkBack scripts per screen | WCAG 2.2 AA items in 8.9 |

### 6.6 CI/CD and store release

GitHub Actions: lint, type-check, engine and data tests on every PR; Maestro E2E nightly; EAS Build on tags; EAS Submit to TestFlight and Play internal track; manual promotion to production. OTA updates (EAS Update) are used only for JS-level fixes and never for engine parameter changes, which ship as versioned builds with a changelog entry. The dependency allow-list job fails the build if any package in a deny-list of analytics and ad SDKs appears.

Store requirements: Apple requires a `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription` that name each data type, a privacy manifest, App Privacy labels (health data: collected? No, because it never leaves the device; the labels must still be answered accurately), and a HealthKit entitlement; HealthKit data cannot be used for advertising or sold, and apps must have a privacy policy (App Store Review Guideline 5.1.3). Google requires the Health Connect data-type declaration in Play Console and a Health apps policy declaration before the permissions work ([Play declaration](https://developer.android.com/health-and-fitness/guides/health-connect/publish/declare-access)); `READ_HEALTH_DATA_IN_BACKGROUND` and `READ_HEALTH_DATA_HISTORY` are separate declared permissions. Both stores need the privacy policy URL, the Data safety / App Privacy forms, and age rating that reflects sexual-health content.

### 6.7 Open-sourcing

Open the engine (MIT) in Phase 1 and the whole app (AGPL-3.0) at launch. Trust is the product's only differentiator against funded competitors, and the engine's claims (calibrated intervals, no symptom leakage, on-device only) are checkable only if the code is public. Trade-offs: forks could ship the engine behind ads or with altered flags (AGPL plus trademark policy on the name limits this); security issues are visible to attackers as well as reviewers (mitigated by the absence of any server); and the regulated tier, if ever built, would need a controlled fork with change control. Reproducible builds are not attempted in v1, but the published engine package hash is printed in Settings → About so anyone can check it against the repo.

## 7. Apple Health and Health Connect integration

Sync is two-way, opt-in per data type, and ships in Phase 4 with period flow, intermenstrual bleeding, BBT, wrist temperature (read), ovulation tests, cervical mucus and sexual activity; pregnancy and contraception factors follow in Phase 5. Echo prevention relies on the platform record identifiers that each platform lets an app attach: HealthKit custom metadata plus `sourceRevision`, and Health Connect `clientRecordId` plus `dataOrigin`.

### 7.1 Data-type mapping

Health Connect types are from the current index (updated 23 September 2026, [data-types index](https://developer.android.com/health-and-fitness/health-connect/data-types)); HealthKit identifiers from the [HKCategoryTypeIdentifier](https://developer.apple.com/documentation/healthkit/hkcategorytypeidentifier.md) reference. Items marked VERIFY need confirmation against the current platform docs before coding.

| Sanguine type | HealthKit | iOS | Health Connect | Android |
| --- | --- | --- | --- | --- |
| Period flow (none/spotting/light/medium/heavy) | `HKCategoryTypeIdentifier.menstrualFlow` with `HKMetadataKeyMenstrualCycleStart` on the first day | both | `MenstruationFlowRecord` (spotting/light/medium/heavy) | both |
| Period as an interval | derived from flow samples with cycle-start metadata | both | `MenstruationPeriodRecord` (start, end) | both |
| Intermenstrual bleeding | `intermenstrualBleeding` | both | `IntermenstrualBleedingRecord` | both |
| Basal body temperature | `HKQuantityTypeIdentifier.basalBodyTemperature` (°C) | both | `BasalBodyTemperatureRecord` (temperature, measurementLocation) | both |
| Wrist / skin temperature | `appleSleepingWristTemperature` (nightly, read-only) | read | `SkinTemperatureRecord` (deltas from baseline, series; device-dependent, `FEATURE_SKIN_TEMPERATURE`) | read |
| Ovulation (LH) test | `ovulationTestResult` (negative, positive LH surge, indeterminate, estrogen surge) | both | `OvulationTestRecord` (negative, positive, high, inconclusive) | both |
| Pregnancy test | `pregnancyTestResult` | both | none | unsupported |
| Progesterone test | `progesteroneTestResult` | both | none | unsupported |
| Cervical mucus | `cervicalMucusQuality` (dry, sticky, creamy, watery, egg white) | both | `CervicalMucusRecord` (appearance + sensation) | both |
| Cervical position | none | unsupported | none | unsupported |
| Sexual activity | `sexualActivity` with `HKMetadataKeySexualActivityProtectionUsed` | both | `SexualActivityRecord` (protectionUsed) | both |
| Contraceptive factor | `contraceptive` (category, iOS 14.3+) | both (VERIFY third-party write) | none | unsupported |
| Pregnancy factor | `pregnancy` | both (VERIFY third-party write) | none | unsupported |
| Lactation factor | `lactation` | both (VERIFY third-party write) | none | unsupported |
| Cycle deviation notices | `irregularMenstrualCycles`, `infrequentMenstrualCycles`, `prolongedMenstrualPeriods`, `persistentIntermenstrualBleeding` (Apple-computed, read-only) | read | none | unsupported |
| Symptoms (cramps, mood, acne, breast tenderness, headache, bloating…) | HealthKit symptom category types (`abdominalCramps`, `moodChanges`, `acne`, `breastPain`, `headache`, `bloating`…) | both (Phase 3) | none | unsupported |

Sanguine never writes predictions or health flags to either platform; only logged observations are written.

### 7.2 Sync design

**Initial import.** On enabling a type the app reads from a user-chosen start (default 2 years; Health Connect needs `READ_HEALTH_DATA_HISTORY` to read beyond the last 30 days, otherwise only 30 days are offered), writes each record as an `event` with `provenance = 'imported'`, `source_app` and `external_id`, and records a `health_link` row with `direction = 'read'`. Imported periods appear in the calendar with an "imported" chip; the engine uses them at the provenance weights in 4.7.

**Incremental sync.** iOS: an `HKAnchoredObjectQuery` per type with the anchor persisted in `health_sync.anchor`; each run returns new samples and `deletedObjects` since the anchor. Background: `enableBackgroundDelivery` with `.immediate` for category types and `.hourly` for quantity types, delivered to a background observer query that triggers the anchored fetch; iOS may coalesce or delay deliveries, so the app also syncs on foreground. Android: the Changes API, `getChanges(token)` per registered type with the token persisted; tokens are single-use and expire, so an expired token triggers a bounded re-read of the last 30 days (VERIFY current expiry period). There is no push delivery on Android; a WorkManager periodic task (minimum 15 min; Sanguine uses 60 min) runs the change fetch with `READ_HEALTH_DATA_IN_BACKGROUND`, plus a foreground sync. Both platforms rate-limit reads; the adapter batches by type and backs off on throttling errors.

**Writes.** Every write carries Sanguine's event id: HealthKit metadata key `com.sanguine.eventId` and Health Connect `Metadata.clientRecordId = eventId` with `clientRecordVersion = lamport`. Health Connect upserts on `clientRecordId`, so a corrected day is a new version, not a duplicate; HealthKit has no upsert, so a correction deletes the old sample by UUID (from `health_link`) and writes a new one.

### 7.3 Correctness rules

| Problem | Rule |
| --- | --- |
| Echo prevention (never re-import what we wrote) | On read, drop any record whose source bundle/package is Sanguine, or whose metadata/clientRecordId matches a `health_link` row with `direction = 'wrote'`. Belt and braces: also drop if `content_hash` of (day, type, value) matches a row we wrote in the last 48 h |
| Duplicate detection across apps | Same day, same type, same value from a different source → keep ours, link theirs as `read` without creating an event; same day, different value → conflict rule |
| Conflict (another app logs the same day differently) | Manual entry in Sanguine wins over imports; among imports, the record with the latest platform modification time wins; the losing value is kept as a retracted event so the user can see it in day detail and switch. For period start days, a conflict within ±1 day is treated as agreement and Sanguine's day is kept |
| Deletions, platform → Sanguine | HealthKit `deletedObjects` and Health Connect `DeletionChange` map through `health_link` to the originating event; the app writes a `retract` event (`provenance = 'imported'`) and re-runs `predict`. If the deleted record was one the user confirmed manually, the app asks before retracting |
| Deletions, Sanguine → platform | A `retract` of an event with a `wrote` link deletes the platform record by id; deletion failures are queued and retried |
| Units | BBT written in °C to HealthKit (`HKUnit.degreeCelsius`) and as `Temperature.celsius` to Health Connect; read values converted at the boundary; wrist temperature deltas stored as deltas, never converted to absolute |
| Time zones and day boundaries | Day attribution per 5.5; writes use local midnight with the user's current zone offset (Health Connect) or the local start of day with `HKMetadataKeyTimeZone` set (HealthKit); a flow sample is a 1-day interval, BBT an instant at `measured_at` |
| Partial permissions | HealthKit does not reveal read-denied types (reads just return nothing); the UI treats empty reads as "nothing or no permission" and offers the Settings deep link; Health Connect reports permissions explicitly |

### 7.4 Library choice for Expo

| Platform | Library | Why |
| --- | --- | --- |
| iOS | [`@kingstinct/react-native-healthkit`](https://github.com/kingstinct/react-native-healthkit) (Nitro modules, anchored queries, background delivery, config plugin for entitlement and usage strings) | Actively maintained, typed, covers the cycle-tracking category and quantity types; needs `react-native-nitro-modules` and a dev client |
| Android | [`react-native-health-connect`](https://github.com/matinzd/react-native-health-connect) v4 (4.1.3, 6 Aug 2026; the Expo plugin is now bundled, `expo-health-connect` is deprecated) | Covers all cycle-tracking records, changes API, background read permission; config plugin adds the manifest permissions and the permission-rationale activity; needs `expo-build-properties` for minSdk 26 and the Health Connect client version |

Both require `npx expo prebuild`; neither works in Expo Go.

### 7.5 Permission UX

Permissions are requested per type from the Health settings screen, never during onboarding (onboarding only offers the screen). Each row explains the type, the direction, and what Sanguine does with it: "Period flow — read and write. Sanguine will import periods you logged in Apple Health and write the ones you log here, so both stay in step." A second line says who else can see it: "Anything written to Apple Health is governed by Apple's privacy rules and is visible to other apps you have allowed." Wrist temperature is read-only and says that nightly values are used to estimate ovulation after the fact and are never written back. Android shows the Health Connect permission rationale screen the platform requires before its own dialog.

### 7.6 Platform policy constraints

Apple: HealthKit data may not be used for advertising, data mining or sold, must not be stored in iCloud by the app (the backup therefore stores Sanguine's own event log, which it may do, but excludes samples that were only imported from HealthKit and never confirmed by the user, to stay inside the rule), and the app must have a privacy policy and declare each type in usage strings (App Store Review Guideline 5.1.3). Google: apps using Health Connect must complete the Play Console health-apps declaration and the data-type access declaration, show an in-app privacy policy and permission rationale, request only types they use, and may not use the data for advertising or sell it; background and history permissions are separately justified ([Play declaration](https://developer.android.com/health-and-fitness/guides/health-connect/publish/declare-access)).

### 7.7 Phase and first cut

Phase 4 ships: period flow, intermenstrual bleeding, BBT, ovulation test, cervical mucus and sexual activity in both directions; wrist temperature read on both platforms; initial import with a 2-year default; foreground and background incremental sync; echo prevention, conflicts and deletions as above. Phase 5 adds pregnancy and progesterone tests, contraception/pregnancy/lactation factors (iOS), Apple cycle-deviation reads, and symptom types.

## 8. UI/UX specification

Sanguine has four tabs (Today, Calendar, Insights, Settings) and one logging sheet reachable from anywhere in one tap; a period start is two taps from launch and a common symptom is two taps. Predictions are drawn as ranges with a confidence label, never as a single highlighted day.

### 8.1 Design principles

1. Calm by default: one primary fact per screen, generous whitespace, no streaks, badges, articles or prompts to "engage".
2. Ranges, not points: every predicted date is shown with its 80% range and a confidence word; the point date is secondary.
3. Evidence-based, neutral tone: short sentences, no emoji in copy, no "your body is telling you"; the Clue register.
4. Audience wording: the app addresses women (client decision, D-050), alongside "period" and "bleeding"; no "ladies", "girls", "feminine" or "womanhood" (§8.7); the brand (splash, icon, About band) is soft and feminine by the client's direction (blush splash field, the single-line uterus emblem) while the interface inside the app stays neutral (§9.2, D-051); sexual activity logging is optional and off by default.
5. Nothing hidden: no feature gates, no upsell surfaces; Settings contains everything.
6. Discretion is a setting the user controls, defaulting to the most private option.

### 8.2 Information architecture

```text
Onboarding (first launch only)
Tabs
  Today ─── logging sheet (modal) ─── day detail
  Calendar ─── day detail ─── logging sheet
  Insights ─── cycle history list ─── cycle detail
           └── charts (cycle length, temperature, symptoms by phase)
           └── your accuracy (calibration ledger)
  Settings
    ├── Life state (contraception, pregnancy, postpartum, perimenopause, irregular cycles)
    ├── Health sync (per-type permissions)
    ├── Privacy and data (export, import, backup, delete everything, app lock, discreet icon)
    ├── Notifications and widgets
    ├── Appearance (theme, dynamic type note, reduced motion follows system)
    ├── Tracking options (which symptoms appear in the sheet, temperature source, units)
    └── About (engine version and hash, sources, wording, licences)
```

### 8.3 Launch screens

| Screen | Contents | Rationale |
| --- | --- | --- |
| Onboarding (5 steps) | 1 purpose and non-medical statement; 2 age and (optional) year of menarche; 3 last period start and usual length (optional, "I don't know" is fine); 4 life state picker; 5 privacy statement with Health import offer and backup offer, both skippable | Collects only what the engine's prior needs; works with zero data (step 3 skippable → Today shows "log your next period to start") |
| Today | Phase ring with day of cycle; one headline ("Period likely in 3–8 days", or "Day 2 of your period"); the fertility estimate card (collapsed by default outside days with p ≥ 0.2); one Log today button that opens the logging sheet (D-097); any active health flag as a quiet card; a look-back symptom note when the user's own past cycles show one (D-087) | One glance answers "where am I"; logging never more than two taps |
| Logging sheet | Bottom sheet, opens on the current day: flow selector (spotting/light/medium/heavy) first, then a symptom grid of the user's chosen symptoms (default 8), then temperature and tests under "More"; save is implicit on dismiss | Period start = tap Period, tap flow level; symptom = tap Symptoms, tap symptom |
| Day detail | Everything logged that day, provenance chips, edit and delete, "not a period" and "mark as spotting" actions | Corrections live where the data is |
| Calendar | Month grid; period days solid, predicted period range hatched; fertile band drawn as a graded underline whose opacity follows p(d); ovulation estimate as a small marker with ± arms; tap a day for detail | Uncertainty is visible in the drawing, not in a footnote |
| Insights | Cycle history list (length, bleed days, quality chip, ovulation basis); cycle length chart with the 80% band; temperature chart with coverline; symptom-by-phase bars; your accuracy section | Shows the user the engine's own track record |
| Cycle detail | One cycle's timeline: bleeding, biomarkers, the ovulation estimate with its signals and whether they agreed | Explains where an estimate came from |
| Settings: Life state | Single-select current state with start date; history of states | Drives the engine gates in 4.9 |
| Settings: Health sync | Per-type rows with direction toggles and explanations (7.5); last-sync time; "import history" action | — |
| Settings: Privacy and data | Plain statements of what is stored where; export (JSON + CSV); import (Sanguine, Flo, Clue); backup set-up with recovery code; app lock; discreet icon; delete everything | Portability and control in one place |
| Notifications and widgets | Per-notification toggles with preview text; widget content choice | Discreet defaults (8.8) |
| Lock-screen widget / notification | Small widget shows the ring and day count only; medium widget adds "period likely in 3–8 days"; notification default text is "Sanguine: a reminder" until opened | No health details on the lock screen unless opted in |

### 8.4 Logging flows

- Period start from launch: Today → tap Log today (1) → tap flow level (2) → Done. Today's headline updates immediately because `predict` re-runs on the write. (The lock-screen widget path below closes the sheet itself after the flow tap.)
- Period start from the lock screen: the medium widget has a Period button that deep-links straight to the flow picker (one tap plus Face ID if lock is on).
- Common symptom from launch: Today → tap Log today (1) → tap symptom tile (2); each tap steps the strength mild, moderate, strong, off, and press and hold clears it (D-097).
- Temperature: Today → Log today (1) → Temperature row (2) → numeric pad prefilled with the last value, enter (3–4); the home-screen quick action opens the row directly; wearable users never type.
- Back-dating: Calendar → day → Log this day → sheet; all rules identical.

### 8.5 Visualising prediction and uncertainty

- Next period: a range chip ("27 Oct – 2 Nov") with the point date in smaller text and a confidence word; the Calendar draws the 80% range as hatched days and the 95% range as a faint outline.
- Ovulation: marker at the point estimate with horizontal arms spanning the 80% interval; arms longer than 6 days (each arm is half the 80% range, so a range over 12 days; owner, D-098) switch the label to "estimate uncertain", remove the marker and hide the fertile band on every surface (ring, calendar, reminders, calendar export).
- Fertile band: per-day opacity = p(d) from 4.8 (clamped 0.1–1; days under 0.1 are not drawn, D-098); legend reads "darker = more likely to be in the fertile window".
- Confidence words map to the engine grades: high → "confident", medium → "fair estimate", low → "rough estimate", none → no card.
- Insights shows the calibration ledger as plain text ("your 80% ranges have contained the actual date 7 of 9 times").

### 8.6 Onboarding details

Each step is one screen with one question and a skip; nothing is required except age. The privacy step uses three sentences: "Everything you log stays on this phone, encrypted. Sanguine has no account and no server; we cannot see your data and cannot hand it to anyone. Backups, if you turn them on, are encrypted before they reach your iCloud or Google Drive." The Health import offer opens the Health sync screen with nothing pre-selected. Teen mode (age 13–17) hides the fertility estimate card and sexual-activity logging by default, with an unlock in Settings, and uses the adolescent flag thresholds.

### 8.7 Language

A glossary file (`copy/glossary.en-AU.json`) fixes terms: period, bleeding, spotting, cycle, estimate, range, ovulation, fertile window, biomarker. Forbidden list from 2.3 plus "ladies", "girls", "feminine", "womanhood", "should" (as advice), "normal" (as a verdict; "typical range" is used). The audience word in general copy is "women" (client decision, D-050); "people who menstruate" is no longer used. Copy is reviewed by the clinician before each release.

### 8.8 Discretion

- Notifications default to "Sanguine: a reminder"; a Settings toggle enables descriptive text ("Period likely in 3–8 days").
- Widgets default to the ring and day count; health words appear only if the user opts in.
- App lock: Face ID / fingerprint / device passcode, on by default after onboarding with an explanation; auto-lock after 1 minute in background; notes are double-encrypted (6.1).
- Discreet icon: alternate app icons (iOS `CFBundleAlternateIcons`, Android activity-alias) with a neutral name and glyph ("Notes", a leaf); switching is one tap and the notification title follows the chosen name.
- Screenshots and recent-apps thumbnail blurred by default (`FLAG_SECURE` on Android; a privacy overlay on iOS when backgrounded).

### 8.9 Accessibility (WCAG 2.2 AA)

- Contrast ≥ 4.5:1 for text and 3:1 for the fertile band against the day cell in both themes; all tokens checked in CI.
- Dynamic Type / font scaling up to 200% without clipping; the ring collapses to a text header above 150%.
- Every interactive element has an accessibility label and role; the calendar announces "Wednesday 14 October, predicted period, 80% range" style strings; the fertile band is announced as a probability word, not an opacity.
- Reduced motion: all transitions degrade to cross-fades; the ring does not animate.
- Target size ≥ 44×44 pt; focus order follows reading order; no colour-only meaning (period days also carry a solid-fill pattern).
- Haptics are optional and never the only feedback.

### 8.10 Data portability

Export produces a zip with `events.jsonl` (the full log, schema-versioned), `cycles.csv`, `daily.csv`, `biomarkers.csv`, and a `README.md` describing the columns, so the file is useful without Sanguine. Import accepts the same format, Natural Cycles' daily-entries export (D-056), plus Flo's and Clue's data-export files where their current formats are documented (both let users request a data export under GDPR; the Clue export is JSON and the Flo export is a zip of JSON, formats to be re-verified against current exports at Phase 3, VERIFY) a Natural Cycles export (its `Daily Entries.csv`: flow, temperatures, tests and notes, not only period dates; parser pending a sample export, D-056), and a generic CSV of period start dates. Every daily importer writes through one shared writer (`data/importDaily.ts`), so flow, temperature, tests, sex and notes survive the move. Imported records carry `provenance = 'imported'` and `source_app`.

## 9. Design system and screen mockups

Sanguine has one content language and two native chrome languages: on iOS the navigation layer is Liquid Glass (iOS 26 and 27), on Android it is Material 3 Expressive (Android 16 and 17), and the content underneath (ring, calendar, cards, data colours, copy) is identical on both. Rendered HTML mockups of the five core screens, in both platform treatments, are published at [Sanguine — core screen mockups](docs/mockups.html); every mockup and every Claude Design prompt below references these tokens by name.

### 9.1 Platform direction

**iOS: Liquid Glass in the navigation layer, never in the content layer.** Apple's guidance since iOS 26 puts glass on tab bars, toolbars, floating controls and sheets, and keeps content on opaque surfaces so it stays legible; iOS 27 improved background diffusion and Xcode 27 removes the deferral flag, so adoption is not optional for an app built on the iOS 27 SDK ([Apple, adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass.md)). Sanguine uses: the system tab bar via expo-router native tabs (minimises on scroll, glass by default); a floating glass quick-log pill (`expo-glass-effect` GlassView, regular variant) over the Today ring holding one Log today action as a tinted glass capsule in `accent` (D-097); glass toolbars on Calendar and Insights; the logging sheet as a native form sheet with a glass header. Content cards stay on `surface`. Every custom glass surface checks `accessibilityReduceTransparency` and falls back to `surface` at 94% opacity; on iOS 25 and earlier the same components render with `expo-blur` system materials. Corner radii are concentric with the device corners (sheet 20 pt inside a 44 pt screen corner), SF Symbols replace the Lucide set, and the numeral uses SF Pro with tabular figures.

**Android: Material 3 Expressive.** The app is wrapped in `MaterialExpressiveTheme` through `@expo/ui/jetpack-compose` with `MotionScheme.expressive()`, which means spring physics rather than tweens, shape morphing on press and selection, emphasised typography and a tonal colour scheme. Sanguine uses: the M3 navigation bar with pill indicators; one filled primary Log today button (D-097); the expressive loading indicator (morphing polygon) in place of a spinner; large-radius containers (28 dp for cards, 24 dp for the sheet); Roboto Flex with an emphasised Display for the cycle-day numeral; 8 dp spacing grid and 48 × 48 dp targets. Colour comes from a seed-derived tonal palette (seed `#BC4560`), with Material You dynamic colour available as a Settings toggle (off by default so period, fertile and ovulation colours stay stable and meaningful). Reduced motion follows the system animation scale: at 0 the springs become instant transitions.

**Shared rule for both.** Spend the expressiveness in one place: the PhaseRing. On iOS the glass quick-log pill floats above the tab bar, within thumb reach (D-099); on Android the ring's phase change is a shape morph with a single expressive spring. Everything else is quiet.

### 9.2 Colour tokens

| Token | Light | Dark | Use | Contrast check |
| --- | --- | --- | --- | --- |
| `bg` | #FFFFFF | #000000 | Screen background (content layer) | — |
| `surface` | #FFFFFF | #1C1C1E | Cards, sheet body | — |
| `surface2` | #F3F3F4 | #2C2C2E | Grouped rows, chips | — |
| `textPrimary` | #1F1A1C | #F4EEEF | Body text | 15.8:1 / 15.2:1 on bg |
| `textSecondary` | #6B6165 | #B3A8AC | Captions, secondary | 5.2:1 / 8.9:1 |
| `border` | #E4E4E6 | #3A3A3C | Hairlines | — |
| `accent` | #BC4560 | #D4607A | Primary actions, period glyph; M3 seed colour | 5.1:1 / 5.6:1 |
| `accentSoft` | #F4DCE0 | #3A1F27 | Accent backgrounds; M3 primaryContainer | — |
| `period` | #B8324A | #D9607A | Logged bleeding days (solid + white drop, D-088) | 3.4:1 vs bg (non-text, with pattern) |
| `periodPredicted` | #D9A0AB | #7A4654 | Hatched predicted range | — |
| `fertile` | #5C8A6E | #7FAF93 | Fertile band at opacity = p(d) | 3.2:1 / 3.6:1 at full opacity |
| `ovulation` | #3F6F88 | #7FA7C2 | Ovulation marker and arms | 5.1:1 / 6.4:1 |
| `flag` | #B9741E | #D9A054 | Health flag card edge | 3.6:1 / 7.0:1 |
| `success` | #3E7D5A | #6FB68C | Saved state | — |
| `focus` | #2E5C8A | #8FBDE6 | Focus ring (2 px) | — |
| `glassTint` (iOS only) | rgba(255,255,255,0.55) | rgba(0,0,0,0.55) | Tint over system glass on tab bar, toolbars, quick-log pill | Text on glass re-checked per state; falls back to `surface` at 94% under Reduce Transparency |
| `glassAccent` (iOS only) | rgba(188,69,96,0.96) | rgba(212,96,122,0.72) | Tinted glass for the Period capsule | White text ≥ 4.5:1 on the composited result |
| M3 roles (Android only) | primary #BC4560, onPrimary #FFFFFF, primaryContainer #F4DCE0, surfaceContainerLow #FFFFFF, surfaceContainer #FFFFFF, surfaceContainerHigh #F3F3F4, tertiary #5C8A6E, outlineVariant #E4E4E6 | primary #D4607A, onPrimary #3A0A14, primaryContainer #3A1F27, surfaceContainerLow #000000, surfaceContainer #1C1C1E, surfaceContainerHigh #2C2C2E, tertiary #7FAF93, outlineVariant #3A3A3C | Tonal palette generated from the seed; `period`, `fertile`, `ovulation` and `flag` are fixed custom colours outside the dynamic scheme | — |

### 9.3 Type scale, spacing, radii, elevation

| Style | Size / line | Weight | Font |
| --- | --- | --- | --- |
| Display (cycle day numeral) | 40 / 44, tabular figures | 600 | System (SF Pro / Roboto) |
| Title | 24 / 30 | 600 | System |
| Heading | 18 / 24 | 600 | System |
| Body | 16 / 24 | 400 | System |
| Body small | 14 / 20 | 400 | System |
| Caption | 12 / 16 | 500, letter-spacing 0.2 | System |
| Tagline (splash and About band only) | 13–14 / 20–22, capitals | 500, letter-spacing 0.2 em | Cormorant Garamond |

Spacing uses a 4-pt base on iOS (4, 8, 12, 16, 24, 32, 48; gutters 16) and the M3 8-dp grid on Android (8, 16, 24, 32, 48; gutters 16). Radii, iOS: chips 8, cards 16, sheet 20 (concentric with the device corner), buttons and the quick-log pill fully rounded capsules. Radii, Android: chips 8, cards 28, sheet 24, buttons and toolbar fully rounded, with M3 shape morphing between rounded and the expressive Cookie-9 polygon on press for the Period action. Elevation, iOS: content cards have no shadow; depth comes from the glass layer (system material, highlight rim, specular) and from one shadow under the sheet (0 8 24 rgba(31,26,28,0.12)). Elevation, Android: tonal surface containers (low → high) carry hierarchy; no drop shadows except the M3 level-3 on the floating toolbar. Hairlines 1 px `border` on iOS; `outlineVariant` on Android. Type: iOS uses SF Pro with Large Title 34/41 on scrollable screens; Android uses Roboto Flex with the M3 Expressive emphasised Display for the numeral (40/44, weight 600, width 110).

### 9.4 Iconography and motion

Icons: SF Symbols on iOS (`drop`, `thermometer.medium`, `calendar`, `chart.line.uptrend.xyaxis`, `gearshape`; custom symbols for test strip and mucus drawn in the SF template at 2 px stroke) and Material Symbols Rounded on Android with the matching set; both at 24 pt/dp. Inside the app no pink, floral or gendered imagery on either platform; the client's single-line emblem appears only on the splash, the icon and the About band (§9.9). Motion, iOS: system glass transitions for navigation; ring fill animates once on Today appearance (600 ms ease-out) and never loops; sheet 320 ms with a 0.8-damping spring; Reduce Motion collapses everything to 120 ms cross-fades. Motion, Android: `MotionScheme.expressive()` for the ring morph, toolbar press and sheet, `MotionScheme.standard()` for everything else; animation scale 0 means instant. Haptic: light impact on save on both.

### 9.5 Core components

| Component | Props and states | iOS rendering | Android rendering |
| --- | --- | --- | --- |
| `PhaseRing` | dayOfCycle, cycleLengthEstimate, phase, periodDays\[\], predictedRange, fertileProbabilities\[\]; states: no-data (dashed), menstrual, follicular, ovulatory, luteal, late, suspended | SVG on `bg`; glass quick-log pill floats over its lower edge | SVG with an expressive shape morph on phase change; sits on `surfaceContainerLow` |
| `HeadlineCard` | title, subtitle (range), confidence; states: period in progress, predicted, late, suspended, empty | `surface` card, radius 16 | `surfaceContainer`, radius 28 |
| `EstimateCard` | kind, point, i80, confidence, basis; collapsed/expanded; fixed wording line | Same as HeadlineCard with a disclosure chevron | Same, with M3 expressive expand (spring) |
| `QuickLogRow` | One Log today action that opens the logging sheet (D-097) | Floating glass pill (regular glass, `glassTint`) holding a tinted-glass capsule | One filled primary button |
| `LogSheet` | sections: FlowSelector, SymptomGrid, More; day header | Native form sheet, glass header, grabber, detents 0.7 and 1.0 | M3 modal bottom sheet, radius 24, drag handle, `surfaceContainerLow` |
| `FlowSelector` | spotting/light/medium/heavy; `flow_kind` switch | Segmented tiles, radius 12 | Connected button group (M3 expressive), selected item morphs to a fuller shape |
| `SymptomTile` | code, intensity 0–3, selected; tap steps intensity, press and hold clears (D-097) | Tiles radius 12 | Filter-chip-like tiles, radius 16, spring on select |
| `CalendarDayCell` | today, period (solid + drop, D-088), predicted (hatch), fertile p (band opacity), ovulation marker, has-log dot, imported chip, selected; 44 pt / 48 dp target | Radius 10 | Radius 12; today ring in `primary` |
| `RangeChip` | lo–hi text, point secondary | `surface2` capsule | Assist chip |
| `ConfidenceBadge` | confident / fair estimate / rough estimate | `surface2` capsule | Suggestion chip |
| `FlagCard` | wording, Learn more, Mute; left edge in `flag` | Card with 4 pt flag edge | Card on `surfaceContainerHigh` with 4 dp flag edge |
| `ProvenanceChip` | manual / imported (Apple Health, Health Connect, Flo, Clue) / sensor | Small capsule | Small assist chip |
| `SettingsRow` | title, description, control | Inset grouped list (SwiftUI `List` via @expo/ui) | M3 list items with switches, `surfaceContainer` groups |
| Tab bar | Today, Calendar, Insights, Settings | expo-router native tabs: system Liquid Glass, minimises on scroll | M3 navigation bar with pill indicator |

### 9.6 Sample content for all mockups

Typical user: periods started 4 Aug, 1 Sep, 30 Sep 2026 (cycles 28, 29 d); today 10 Oct 2026, cycle day 11; next period 29 Oct (27 Oct – 1 Nov, fair estimate); ovulation estimate 15 Oct (12–19 Oct, rough estimate, calendar basis); logs: cramps 2/3 and headache on 1 Oct, cramps 1/3 on 2 Oct, bloating on 9 Oct, BBT 36.42 °C on 10 Oct. Irregular user: cycles 24, 38, 31, 45, 27, 36 d; next period 3 Nov (26 Oct – 11 Nov, rough estimate); high-variability flag (range 21 days). Period in progress: 1 Oct cycle day 2, medium flow. Health flag: "Two of your last three cycles were longer than 38 days."

### 9.7 Per-screen mockup specification

| Screen | Purpose and layout | Components | States to mock | iOS (Liquid Glass) | Android (M3 Expressive) |
| --- | --- | --- | --- | --- | --- |
| Onboarding | 5 full-screen steps, progress dots top, one question centred, primary button bottom, "Skip" text button | Title, Body, segmented picker, date picker, primary button | Step 1 purpose; step 3 with "I don't know"; step 5 privacy with Health offer; light and dark | Native SwiftUI date picker; capsule buttons; no glass (no navigation chrome yet) | M3 date picker dialog; full-width filled button, radius 28; connected button group for life state |
| Today | Ring top third, headline card, estimate card collapsed, quick-log, flag card, footer wording | PhaseRing, HeadlineCard, EstimateCard, QuickLogRow, FlagCard | First launch no data; typical day 11; period in progress day 2; irregular low confidence; flag shown; light and dark | System glass tab bar; floating glass quick-log pill pinned above the tab bar holding one Log today tinted glass capsule (D-099) | M3 navigation bar; one filled Log today button floating above it (D-099); ring morphs on phase change |
| Logging sheet | 70% sheet, day header, FlowSelector, SymptomGrid, More | LogSheet, FlowSelector, SymptomTile | Empty; period start selected; symptoms selected; contraception user; dark | Native form sheet with grabber, glass header, detents 0.7/1.0 | M3 modal bottom sheet, drag handle, connected button group for flow |
| Calendar | Month grid, legend, selected-day summary, Log this day pinned above the tab bar like Today's pill and absent for a future day (D-099) | CalendarDayCell, RangeChip, legend | Typical; irregular; period in progress; flag month; dark | Glass toolbar with month title and chevrons that minimises on scroll | M3 top app bar (expressive search-style compact bar) with month title; swipe between months |
| Insights | Segmented control, history rows, chart with 80% band, accuracy text | List rows, chart, ConfidenceBadge | Typical 3 cycles; irregular 6 with excluded cycle; no data; dark | Native segmented control; inset grouped list | M3 segmented buttons; list on `surfaceContainer` |
| Health sync settings | Per-type rows with direction toggles and explanation; last sync; import | SettingsRow, ProvenanceChip | Nothing connected; 3 types on; permission denied; dark | SwiftUI inset grouped list via @expo/ui; Open Settings link | M3 list with switches; Health Connect rationale screen |
| Privacy and data | Statements, export/import/backup/lock/icon/delete rows | SettingsRow | Backup off; backup on; recovery code; dark | Grouped list; destructive row in red | M3 list; destructive text button in error colour |
| Lock-screen widget and notification | Small/medium widgets; default and descriptive notifications | Widget, notification | Default discreet; opted-in descriptive; discreet icon variant | Lock-screen circular and rectangular widgets; home small/medium with glass-compatible tint | Glance 2×2 and 4×2 with dynamic-colour surface |

### 9.8 Claude Design prompts

Design system set-up:

```text
Create a mobile design system called "Sanguine" for a calm, evidence-based menstrual-cycle tracker, with one shared content layer and two platform chrome layers. Frames: iOS 393×852 using iOS 26/27 Liquid Glass for navigation chrome only (tab bar, toolbars, floating controls, sheet headers); Android 412×915 using Material 3 Expressive (Android 16/17). Shared content tokens (hex light/dark): bg #FFFFFF/#000000; surface #FFFFFF/#1C1C1E; surface2 #F3F3F4/#2C2C2E; textPrimary #1F1A1C/#F4EEEF; textSecondary #6B6165/#B3A8AC; border #E4E4E6/#3A3A3C; accent #BC4560/#D4607A; accentSoft #F4DCE0/#3A1F27; period #B8324A/#D9607A; periodPredicted #D9A0AB/#7A4654; fertile #5C8A6E/#7FAF93; ovulation #3F6F88/#7FA7C2; flag #B9741E/#D9A054; success #3E7D5A/#6FB68C; focus #2E5C8A/#8FBDE6. iOS-only: glassTint rgba(255,255,255,0.55)/rgba(0,0,0,0.55) over system regular glass; glassAccent rgba(188,69,96,0.96)/rgba(212,96,122,0.72) for a tinted glass capsule; Reduce Transparency fallback = surface at 94%. Android-only: M3 tonal scheme from seed #BC4560 (primary, primaryContainer #F4DCE0, surfaceContainerLow #FFFFFF, surfaceContainer #FFFFFF, surfaceContainerHigh #F3F3F4 (the iOS bg/surface/surface2, D-066), tertiary #5C8A6E, outlineVariant #E4E4E6; dark equivalents), with period, fertile, ovulation and flag as fixed custom colours. Type: iOS SF Pro (Large Title 34/41, Title 24/30, Heading 18/24, Body 16/24, Body small 14/20, Caption 12/16; Display numeral 40/44 semibold tabular); Android Roboto Flex (same sizes; Display numeral emphasised weight 600 width 110). Spacing: iOS 4-pt scale, Android 8-dp grid; gutters 16. Radii: iOS chips 8, cards 16, sheet 20 concentric with the device corner, buttons and pill capsules; Android chips 8, cards 28, sheet 24, buttons full, shape morphing (rounded → Cookie-9 polygon) on the Period button press. Elevation: iOS none on content, depth only from glass and one sheet shadow (0 8 24 rgba(31,26,28,0.12)); Android white cards with M3 level-1 elevation on the off-white screen, plus the floating toolbar (D-066). Icons: SF Symbols on iOS, Material Symbols Rounded on Android, 24 pt. Motion: iOS system glass transitions, ring fills once (600 ms), sheet spring 320 ms damping 0.8, Reduce Motion → 120 ms cross-fades; Android MotionScheme.expressive() for ring morph, toolbar press and sheet, standard elsewhere, animation scale 0 → instant. Build these components with iOS and Android variants: PhaseRing (no-data dashed, menstrual, follicular, ovulatory, luteal, late, suspended), HeadlineCard, EstimateCard (collapsed/expanded; badges confident / fair estimate / rough estimate), QuickLogRow (one Log today action; iOS: floating glass pill holding it as a tinted glass capsule; Android: filled primary button), LogSheet (iOS form sheet with glass header; Android M3 modal bottom sheet), FlowSelector (iOS segmented tiles; Android connected button group), SymptomTile (intensity 0–3; a selected tile names it Mild, Moderate or Strong, D-088), CalendarDayCell (today, period solid with a white drop, predicted hatched, fertile band opacity 0.1–1.0, ovulation marker with ± arms, has-log dot, imported chip, selected; 44 pt / 48 dp), RangeChip, ConfidenceBadge, FlagCard (left edge in flag colour), ProvenanceChip, SettingsRow (iOS inset grouped list; Android M3 list), Tab bar (iOS system Liquid Glass tab bar; Android M3 navigation bar with a solid primary pill indicator and the icon in onPrimary). Tone: calm, neutral, no pink, no florals, no emoji, no gendered imagery. Glass never sits under content text; expressiveness is spent on the PhaseRing only. Never render a single highlighted "fertile day"; always ranges. Include the fixed footer style for "Estimates are ranges, not promises. Not for contraception."
```

Onboarding:

```text
Using the Sanguine design system (tokens above), design a 5-step onboarding flow on a 393×852 frame, light and dark. Each step: progress dots (top, 5), one Title question, optional Body explanation, controls centred, primary button "Continue" bottom (accent), text button "Skip" beneath it. Step 1 Title "Track and understand your cycle", Body "Sanguine estimates when your next period and ovulation are likely, using what you log. Estimates are ranges, not promises. Sanguine is not a contraceptive and not a medical device." Step 2 Title "How old are you?" with a year picker (minimum 13) and optional "Year of first period" field. Step 3 Title "When did your last period start?" with a date picker and a secondary option "I don't know"; second field "Usual cycle length (optional)" with helper "Leave blank if unsure". Step 4 Title "Anything that affects your cycle right now?" single-select list: None; Hormonal contraception; Recently stopped contraception; Pregnant; Recently gave birth; Perimenopause; Irregular cycles (e.g. PCOS). Step 5 Title "Your data stays with you", Body "Everything you log stays on this phone, encrypted. Sanguine has no account and no server; we cannot see your data and cannot hand it to anyone. Backups, if you turn them on, are encrypted before they reach your iCloud or Google Drive." Two secondary buttons: "Import from Apple Health" (iOS) / "Import from Health Connect" (Android) and "Set up encrypted backup"; primary "Finish". Show step 1, step 3 with "I don't know" selected, and step 5, in both themes.
```

Today:

```text
Using the Sanguine design system, design the Today tab in two platform treatments. iOS (393×852, Liquid Glass): system glass tab bar (Today, Calendar, Insights, Settings, SF Symbols) that minimises on scroll; content on bg; PhaseRing 220 pt at the top with Display numeral "11" and Caption "day of cycle"; a floating glass quick-log pill (regular glass, glassTint, capsule, 56 pt tall) pinned above the tab bar (D-099) holding one action, Log today, rendered as a tinted glass capsule (glassAccent, white label); HeadlineCard (surface, radius 16) Heading "Period likely in 17–22 days", Body small "Most likely 29 Oct · fair estimate"; EstimateCard collapsed "Ovulation estimated around 15 Oct (12–19 Oct) · rough estimate", expanded state adds "This is for understanding your cycle. Do not use it to prevent pregnancy."; footer Caption "Estimates are ranges, not promises." Android (412×915, Material 3 Expressive): M3 navigation bar with pill indicator and Material Symbols Rounded; content on surfaceContainerLow; the same ring, which morphs shape with one expressive spring when the phase changes; one filled primary Log today button (radius full); HeadlineCard and EstimateCard on surfaceContainer, radius 28, Roboto Flex. Ring segments on both: period days 1–4 in period colour, fertile band days 8–22 in fertile colour with opacity (8:0.2, 10:0.35, 12:0.49, 14:0.55, 16:0.5, 18:0.37, 20:0.22), predicted period days 28–32 hatched, today tick in accent/primary. Produce six states per platform: (1) first launch no data: dashed ring, "Log your period to start", "Sanguine needs one period date to begin; two or three cycles make estimates useful"; (2) typical as above; (3) period in progress: numeral "2", "Day 2 of your period", "Logged: medium flow"; (4) irregular low confidence: "Period likely in 16–32 days", "Most likely 3 Nov · rough estimate", EstimateCard "Ovulation estimate uncertain (range 13–28 Oct)", no fertile band; (5) health flag card under the headline: "Two of your last three cycles were longer than 38 days. That is outside the range most clinical guidelines call typical. A doctor can help you check." with "Learn more" and "Mute"; (6) dark theme of state 2. Also show the iOS Reduce Transparency variant of state 2 (glass replaced by surface at 94%).
```

Calendar:

```text
Using the Sanguine design system, design the Calendar tab, October 2026, on a 393×852 frame. Month header "October 2026" with chevrons; weekday row starting Monday; 6-row grid of 44pt CalendarDayCells; legend row beneath (Period, Predicted period, Fertile window likelihood, Ovulation estimate, Logged); selected-day summary card at bottom. Typical state: period solid with a white drop on 30 Sep–3 Oct; fertile band drawn as a bottom underline on 8–22 Oct with opacity equal to these probabilities (8:0.2, 9:0.27, 10:0.35, 11:0.43, 12:0.49, 13:0.53, 14:0.55, 15:0.54, 16:0.5, 17:0.45, 18:0.37, 19:0.3, 20:0.22, 21:0.16, 22:0.11); ovulation marker on 15 Oct with thin arms spanning 12–19; predicted period hatched 27 Oct–1 Nov with a faint outline on 26 Oct and 2 Nov (95% range); today 10 Oct outlined in accent; log dots on 1, 2, 9, 10 Oct; summary card for 10 Oct: "Day 11 · Bloating · BBT 36.42 °C" with an Edit button. Irregular state: hatch spans 26 Oct–11 Nov, no fertile band, marker replaced by Caption "Ovulation estimate uncertain". Period-in-progress state: 1–2 Oct solid, selected 2 Oct "Day 2 · Medium flow · Cramps 1/3". Flag state: a thin FlagCard above the legend. Provide light and dark. Every cell must remain readable at 150% font scaling.
```

Logging sheet:

```text
Using the Sanguine design system, design the LogSheet in two platform treatments over a dimmed Today screen. iOS (393×852): native form sheet at the 0.7 detent, radius 20, grabber, glass header with "Saturday 10 October" Heading, day chevrons left, "Done" right in accent; body on surface. Android (412×915): M3 modal bottom sheet on surfaceContainerLow, radius 24, drag handle, header row with the same content, Roboto Flex. Section "Flow": iOS four 72 pt tiles Spotting, Light, Medium, Heavy with drop glyphs of increasing fill, radius 12; Android an M3 Expressive connected button group where the selected segment morphs to a fuller shape. Selecting any flow on a day without an open period shows Caption "This will start a new period on 10 Oct". Section "Symptoms": 2 rows × 4 SymptomTiles (Cramps, Headache, Bloating, Breast tenderness, Mood low, Acne, Fatigue, Mid-cycle spotting); selected tiles show intensity dots 1–3 and the word Mild, Moderate or Strong; each tap steps the strength; Android tiles spring on select. Section "More" collapsed rows: Temperature ("36.42 °C · 06:40 · oral"), Ovulation test, Cervical mucus, Sex, Note. States per platform: (1) empty; (2) Medium selected with the new-period caption; (3) Cramps intensity 2 and Bloating selected; (4) hormonal-contraception user: Flow header reads "Bleeding" with a segmented switch "Withdrawal bleed / Other" and no new-period caption; (5) dark theme of state 3; plus the iOS Reduce Transparency variant of state 2.
```

Insights:

```text
Using the Sanguine design system, design the Insights tab, 393×852, with a segmented control History / Charts / Accuracy. History: rows "30 Sep · 29 days · 4 bleed days · ovulation: calendar", "1 Sep · 28 days · 4 bleed days · ovulation: calendar", "4 Aug · 28 days · 5 bleed days", each with a ConfidenceBadge-style quality chip; irregular variant adds a row "3 Jun · 56 days" with chip "unusually long" and three text buttons "Was there a period in between?", "I was pregnant" and "No, this cycle was this long". Charts: cycle-length line chart over 6 cycles with an 80% band in periodPredicted at 25–32 days, y-axis 20–50; temperature chart for the current cycle with a dashed coverline at 36.38 °C; symptom-by-phase bars (menstrual, follicular, luteal) for cramps and headache. Accuracy: Body "Your 80% ranges have contained the actual date 7 of 9 times" and "Average miss: 2.1 days", plus Caption explaining the ranges. States: typical 3 cycles; irregular 6 cycles; empty ("Insights appear after two complete cycles"); dark.
```

Health sync settings:

```text
Using the Sanguine design system, design Settings → Health sync, 393×852, iOS (Apple Health) and Android (Health Connect) variants. Header with platform logo-free title "Apple Health" / "Health Connect", Body "Choose what Sanguine reads from and writes to your health store. Anything written there is governed by that platform's privacy rules and visible to apps you have allowed." Rows (SettingsRow with a three-way control Off / Read / Read & write): Period flow; Intermenstrual bleeding; Basal body temperature; Wrist temperature (read only, control shows Off / Read); Ovulation tests; Cervical mucus; Sexual activity. Each row has one explanatory Body small line, e.g. "Period flow: import periods logged elsewhere and write the ones you log here, so both stay in step." Footer rows: "Import history" (picker 1 year / 2 years / all) and "Last synced 10 Oct, 08:12". States: nothing connected; three types on; permission denied with a "Open Settings" link (iOS) and the Health Connect rationale screen (Android); dark.
```

Privacy and data settings:

```text
Using the Sanguine design system, design Settings → Privacy and data, 393×852. Top card Body: "Your data is stored only on this phone, in an encrypted database. Sanguine has no account and no server." Rows: Export my data (zip: JSON + CSV); Import (Sanguine, Flo, Clue, CSV); Encrypted backup (toggle; when on shows "Backed up to iCloud Drive, 9 Oct" / "Google Drive"); App lock (toggle, Face ID / fingerprint); Discreet app icon (toggle with icon preview "Notes"); Delete everything (destructive row). Recovery-code state: a full-screen card showing a 24-word code with Caption "Write this down. Without it and this phone, your backup cannot be opened, by design." and a single "I've saved it" button. States: backup off; backup on; recovery code; dark.
```

Lock-screen widget and notifications:

```text
Using the Sanguine design system, design: (1) iOS lock-screen circular widget: PhaseRing miniature with numeral "11"; (2) iOS small home widget: ring + "Day 11"; (3) iOS medium widget: ring, Heading "Period likely in 17–22 days", Caption "29 Oct · fair estimate", and a "Log period" button; (4) Android Glance 2×2 and 4×2 equivalents; (5) a discreet variant of each where the app name is "Notes", the glyph is a leaf, and the text is "Day 11" only; (6) two notification cards: default "Sanguine · A reminder" and opted-in "Sanguine · Period likely in 3–8 days". Light and dark.
```

### 9.9 Brand: splash, icon and wordmark

The brand (v2, client-supplied) is one blush field, the client's single-line emblem, the client's script logotype and letter-spaced serif capitals for taglines. It appears on the splash screen, the app icon and the About screen; inside the app the accent stays garnet and the interface stays neutral, so the brand reads as a signature rather than a theme.

| Element | Spec |
| --- | --- |
| Reference | Client-supplied artwork (`docs/brand-v2/client-logo.jpeg`): emblem, logotype and tagline on blush. Elements extracted as white-on-transparent PNGs (`emblem.png`, `logotype.png`) and tinted at render time |
| Field colours | Blush #F5E8E2 (light), plum #2A1518 (dark); ink #73393B on blush, blush on plum. Splash, icon and About band only; never in the UI tokens (D-051) |
| Emblem | The client's single-line uterus with crescent moon and dot; never redrawn, recoloured only; used on the icon, the splash lock-up, the About band |
| Logotype | The client's script "Sanguine" as an image asset, never re-typeset. Closest open font for any in-app script need (About only): Mrs Saint Delafield (OFL) |
| Source files | `docs/brand-v2/emblem.png` and `logotype.png`, white on transparent. Until the client's originals (`client-logo.jpeg`, the two PNGs) arrive they are cut from the client's reference renders by `tools/brand/extract-from-reference.py` (D-049) |
| Tagline face (splash and About band only) | Cormorant Garamond 500 capitals, letter-spacing 0.2em (OFL, `@expo-google-fonts/cormorant-garamond`) |
| Taglines | Six, rotated deterministically by launch count: "Blood demands blood." · "The River of Blood never empties; it only crests." · "By blood bound, by brass crowned." · "Offerings of bone, rivers of red." · "The earth drinks deep, yet the Blood God thirsts." · "An ocean of red for the Lord of Rage." Hidden in teen mode |
| Splash | `expo-splash-screen`: `backgroundColor` #F5E8E2 (dark #2A1518), `image` = lock-up PNG (emblem over logotype) at 3×, `resizeMode: contain`, `imageWidth: 260`; the app draws the tagline beneath once JS is ready and keeps the splash visible until then. Reference renders: `docs/brand-v2/splash/01-blush-light.png`, `02-plum-dark.png` |
| iOS icon | Icon Composer layers: background blush, foreground emblem in ink at 62% of the canvas; tinted and clear appearances derive automatically; dark variant blush emblem on plum |
| Android icon | Adaptive icon: background blush, foreground emblem with 20% safe zone, monochrome layer = emblem |
| Discreet icon | Unchanged: neutral grey #6B6165 field, white leaf, name "Notes" |
| About screen | Blush band with the lock-up and a 200 px rule in ink at 60%; engine version and hash beneath; the current tagline |

Assets are generated in Phase 0 by a script (`tools/brand/build.ts`) that tints the extracted emblem and logotype PNGs and composes the lock-up, splash and icon files, so a field-colour change rebuilds every asset; the full redesign brief is `docs/REDESIGN_PROMPT.md`. A rendered preview is published at [Sanguine — brand preview](docs/brand.html).

## 10. Phased delivery plan

Phases are ordered for autonomous work: everything that runs in Expo Go on the simulator comes first (engine, data layer on plain expo-sqlite, every screen, settings, export, local notifications, app lock, backup encryption), and everything that needs a native build (SQLCipher, Liquid Glass surfaces, widgets, alternate icons, cloud backup containers, HealthKit and Health Connect) comes after a single dev-client build step, with Health sync last. One senior engineer, or an agent working unattended with a simulator, reaches an Australian launch in about 9 months; a regulated tier is a separately funded final phase. Effort is in engineer-weeks at full time.

| Phase | Runs in | Goal | Features | Technical deliverables | Acceptance criteria (all machine-checkable) | Risks | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 Foundations | Expo Go + Node | Settle engine, tokens, brand and the decision log before screens | Design tokens; brand assets (wordmark, icon, splash); copy and glossary; symptom catalogue; section 11 defaults recorded; regulatory artefacts started | Monorepo; CI with dependency allow-list; `@sanguine/engine` types, `studentTQuantile`, fixtures A–I as failing tests; backtest CLI skeleton; `docs/DECISIONS.md`, `docs/regulatory/*` | CI green; fixture files present and failing for the right reason; contrast test passes on all tokens; brand assets render in the simulator splash | Agent drifts from the plan (mitigation: CLAUDE.md rules and per-item PLAN.md references) | 3 weeks |
| 1 Engine | Node | Calibrated, tested, published prediction engine | — | All functions in §4.11; property tests §4.15; backtest reproducing §4.13; λ acceptance test; engine published with hash | Fixtures A–I pass at 0.05 d; property suite passes 1,000 runs; backtest coverage within ±5 points of nominal; MAE on the synthetic suite ≤ 2.8 d at 8 cycles | None material | 3 weeks |
| 2 Core app in Expo Go | Expo Go on iOS simulator and Android emulator | A complete, usable tracker with no native modules | Onboarding; Today; Calendar; logging sheet; day detail; Insights; life states; health flags; settings (life state, privacy and data, notifications, appearance, tracking options, about); export/import (Sanguine, CSV); local notifications; app lock (expo-local-authentication); backup file encryption (@noble/ciphers XChaCha20-Poly1305 + @noble/hashes Argon2id, saved via the share sheet); light/dark; en-AU; iOS and Android chrome using @expo/ui and expo-blur where Expo Go allows | Plain expo-sqlite store behind a `Database` interface that accepts a key (encryption wired in Phase 3); event log and projections; Zustand view layer; expo-router with native tabs; component tests; Maestro flows run on the simulator | All Maestro flows pass on both simulators (onboarding, 2-tap period log, correction, back-date, export round-trip, app lock); accessibility script passes; no package outside the Expo Go allow-list in `apps/mobile` | Expo Go gaps discovered mid-phase (mitigation: a feature that needs a native module is moved to Phase 3 and stubbed behind the same interface, never blocked on) | 10 weeks |
| 3 Native build | Dev client (prebuild) | Everything that needs a config plugin, in one build step | SQLCipher encryption at rest; Liquid Glass tab bar and quick-log pill (expo-glass-effect, Reduce Transparency fallback); M3 Expressive theme; widgets (iOS lock screen/home, Android Glance); discreet alternate icons; screenshot protection; iCloud Drive and Google Drive appDataFolder upload of the encrypted backup; splash and icon finalised natively | EAS or local dev-client builds for both platforms; config plugins; `packages/crypto` moved to native-backed random where available; backup restore E2E across two simulators | Dev-client builds succeed in CI; database opens only with the Secure Store key; glass surfaces fall back correctly under Reduce Transparency; backup round-trip passes; all Phase 2 Maestro flows still pass on the dev client | SQLCipher on Android build variants; glass API changes in SDK 58 | 5 weeks |
| 4 Health sync | Dev client | Two-way HealthKit and Health Connect | Health sync settings; initial import; incremental and background sync; echo prevention; conflicts; deletions; wrist temperature read; imported chips | `packages/health-adapter` with fake-driver tests first; iOS and Android drivers; background tasks; Play health declaration; Apple usage strings | Round-trip scenario in §7 passes with zero duplicates after 3 simulated cycles; simulator tests with seeded HealthKit data and the Health Connect Toolbox pass | Store review of health usage; library breaking changes | 7 weeks |
| 5 Launch (Australia) | Store builds | Public release | Flo and Clue import; Phase-3 Health types; teen-mode polish; policies published; app open-sourced | Store listings; privacy manifests; release pipeline with OTA restricted to JS fixes | Store approval; crash-free sessions ≥ 99.5% in the first 2 weeks from OS vitals; no P1 bugs | Store rejection on age rating or health content | 4 weeks |
| 6 International | Store builds | EU/UK and US | GDPR consent and DPIA; US state policy; de, fr, es, pt-BR; °F for en-US | i18n extraction; locale snapshot tests | Translated prediction and flag copy reviewed; GDPR representative in place | Translation lead time | 6 weeks plus translation |
| 7 Regulated tier (optional) | — | Conception-support mode under ARTG | TTC mode, LH scheduling, clinician report | QMS, IEC 62304 and ISO 14971 files from the Phase-0 artefacts; controlled engine fork; clinical performance study; TGA application | ARTG inclusion | A$250k–600k; 12–24 months; needs a second person | not estimated |

Sequencing notes: the engine and its tests are written before any screen because screens are thin over `Prediction`; the data layer is built on plain expo-sqlite behind an interface that takes an encryption key, so SQLCipher is a Phase 3 config-plugin switch and not a rewrite (interim risk: Phase 2 simulator data is unencrypted, which is acceptable because no real user data exists before Phase 3); Health sync waits for the event log because every sync rule is expressed as events; the first dev-client build is a single, isolated step at the start of Phase 3 so that nothing in Phases 0–2 ever needs one.

**Expo Go allow-list for Phases 0–2.** Allowed: expo-router (including native tabs), expo-sqlite (without SQLCipher), expo-secure-store, expo-local-authentication, expo-notifications (local only), expo-file-system, expo-sharing, expo-document-picker, expo-font and @expo-google-fonts, expo-blur, expo-haptics, expo-localization, expo-crypto, expo-auth-session, @expo/ui (in Expo Go since SDK 56), react-native-reanimated, react-native-gesture-handler, react-native-svg, react-native-screens, zustand, i18next, @noble/ciphers, @noble/hashes. Deferred to Phase 3 or later: expo-sqlite `useSQLCipher`, expo-glass-effect, Expo widgets, alternate app icons, @kingstinct/react-native-healthkit, react-native-health-connect, any iCloud container entitlement, react-native-libsodium. A CI job diffs `apps/mobile/package.json` against this list until Phase 3 opens.

**Autonomous operating loop.** For every backlog item the agent: reads the referenced PLAN.md section; writes or updates tests (vitest for engine and data, React Native Testing Library for components, Maestro for flows); implements; runs the full suite plus the relevant Maestro flow on the iOS simulator and the Android emulator through Expo Go; fixes until green; commits with the item id; appends to `docs/DECISIONS.md` if anything was decided. Nothing waits on a person except store credentials at Phase 5.

## 11. Risks and open questions

No external clinician or regulatory review is assumed. Every decision that would normally wait for one is taken now with the conservative option, recorded here with the alternative it rejected, and isolated in code (one constant, one string or one flag) so a future reviewer can change it in a single commit. The three decisions with the most consequence are the ovulation estimate card, the luteal prior, and the health-flag wording.

### 11.1 Clinical defaults applied without review

| Decision | Default applied | Alternative rejected and why | Where it lives |
| --- | --- | --- | --- |
| Luteal prior | 12.4 ± 2.4 d (Bull 2019, n = 612k) | 14 d textbook median: smaller, older cohorts; would bias ovulation early | `engine/params.ts: LUTEAL_PRIOR` |
| Short luteal insight | Shown only as low-prominence insight at ≤ 9 d in 2 of 3 biomarker-dated cycles, with the uncertainty note | Flagging as a health flag: evidence contested (3.4) | `engine/flags.ts: SHORT_LUTEAL` |
| LH to ovulation | Positive + 1 d, SD 1.0 | Positive = ovulation day: ignores the 28–48 h onset-to-rupture delay | `engine/params.ts: LH_OFFSET` |
| Mucus peak | Peak day, SD 1.5 | Peak + 1: Ecochard found peak within ±1 d in \~70% | `engine/params.ts: MUCUS_SD` |
| BBT rule | Three-over-six, ≥ 0.2 °C, 60-minute time exclusion; wearable 0.3 °C on its own series | Mixing oral and wearable series: amplitude differs 2.5× | `engine/bbt.ts` |
| Temperature-shift gate | Shift accepted only −1 to +4 d from LH/mucus | No gate: lets a late shift override a precise LH estimate | `engine/combine.ts` |
| Flag thresholds | FIGO 2018 adult ranges; PCOS 2023 adolescent ranges; STRAW+10 at ≥ 40; no variability flag in year 1 post-menarche | Adult thresholds for everyone: flags normal pubertal variation | `engine/flags.ts` |
| Post-contraception | 3-cycle warm-up at prior-only, weight 0.5 | Immediate full weighting: early cycles unrepresentative (Girum 2018) | `engine/lifestate.ts` |
| Post-pregnancy bleeding window | 42 d after a birth, 14 d after a loss: bleeding defaults to post-pregnancy, the user can choose "My period" | Treating every bleed as a period: counts lochia and loss bleeding as menses and starts false cycles | `features/logging/actions.ts: POST_PREGNANCY_BLEED_DAYS` |
| Breastfeeding | Suspended until first period, then low confidence for 3 cycles, fertile band only with a biomarker | Any calendar-based band: no retrieved timing evidence | `engine/lifestate.ts` |
| Symptom weight | Zero in predictions; per-user patterns in Insights, and one look-back note on Today (D-087) | Low-weight learned adjustment: no population evidence, and it would make predictions harder to explain | by construction |
| Symptom list | 40 codes (24, plus 16 for imports, D-056), 8 visible by default (cramps, headache, bloating, breast tenderness, mood low, acne, fatigue, mid-cycle spotting) | — | `copy/symptoms.json` |
| Recency weighting | λ = 1 (0.92 failed the §4.15 gate, D-021); λ = 0.8 inside the perimenopause state | Shipping 0.92 on the plan's say-so: a third of the required gain | `engine/params.ts: RECENCY_LAMBDA` |

### 11.2 Regulatory and legal defaults applied without review

| Decision | Default applied | Alternative rejected and why | Where it lives |
| --- | --- | --- | --- |
| Ovulation estimate card | Ships in all regions, labelled an estimate, with the fixed 2.3 wording, no conception mode, no per-day chance figure, hidden in teen mode | Hiding it: every major tracker shows an estimate under consumer-wellness treatment and omitting it makes the app worse without a demonstrated need | `features/predictions/EstimateCard`, flag `SHOW_OVULATION_ESTIMATE = true` |
| Health flags | Published ranges only; no condition named; no risk score; always "a doctor can help you check" | Naming PCOS/AUB/perimenopause: screening claim about a serious condition | `copy/flags.en-AU.json` |
| Intended-purpose statement | "Track and understand your menstrual cycle"; "not a contraceptive, not a medical device" on the listing, onboarding and About | Any wellness-plus-fertility phrasing: risks the s41BD conception limb | `copy/legal.en-AU.json` |
| Privacy Act status | Treated as an APP entity; privacy policy, collection notice, NDB procedure written | Relying on the small-business exemption: unsettled for health apps | `docs/privacy-policy.md` |
| Children's Online Privacy Code | Age gate at 13, teen mode defaults, no profiling, no notifications with health words under 18 by default | Waiting for the Code's final text (registered by 10 Dec 2026): defaults are stricter than any likely requirement | onboarding + settings |
| GDPR / US state laws | Explicit consent at onboarding, consumer-health-data policy published, no sale, no sharing, no geofencing; DPIA drafted from the plan | — | `docs/` |
| Store listings | Age rating answers reflect sexual-health content; Health usage strings per type; privacy labels say no data collected (true: nothing leaves the device) | — | app config |
| Future certification | Requirements trace, risk register, SOUP list and change log maintained from Phase 0 (2.3) | Starting them at certification time: retrofitting is the expensive part | `docs/regulatory/` |

### 11.3 Technical risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| HealthKit third-party write to contraceptive, pregnancy, lactation types not permitted | Medium | Low | Marked VERIFY; types are read-only fallbacks in Phase 3 |
| Health Connect changes-token expiry and background read limits differ from assumptions | Medium | Medium | Bounded 30-day re-read on token failure; foreground sync always |
| Apple wrist temperature availability and semantics change by iOS version | Medium | Medium | Feature-detect at runtime; wearable series is optional input |
| SQLCipher via expo-sqlite on Android build variants | Low | High | Phase 1 spike in week 1; fallback is op-sqlite with SQLCipher |
| Recency weighting λ = 0.92 hurts stable users | Closed | — | Gate failed; λ = 1 ships (D-021) |
| Backup key loss locks users out | Medium | Medium (by design) | Recovery code shown once; restore tested in E2E; clear wording |
| Flo/Clue export formats change | High | Low | Import is best-effort with CSV fallback |
| Single-engineer bus factor | High | High | Engine and app open-sourced; documentation in repo; this plan |

### 11.4 Open questions

- Should the ovulation estimate card be hidden entirely in Australia until the consultant's written opinion is in hand? Decided: no. It ships behind the fixed wording (11.2); the flag exists so one commit can hide it if a reviewer ever asks.
- Is a donated-data programme (user-initiated upload of scoring records, never raw logs) worth the policy complexity in Phase 4, or should accuracy stay purely on-device?
- Multi-device sync: wait for demand or build CRDT sync on the event log in a Phase 4b?
- Apple cycle-deviation notices (read-only) duplicate Sanguine's flags; show both, or suppress Sanguine's when Apple's exist?

## 12. Research log

All research ran on 9 October 2026 in a single session with web search, page fetch and Python code execution; no sub-agents, second models, deep-research mode or dataset downloads were available, and PMC blocked two full-text fetches with a CAPTCHA.

### 12.1 Queries run

| # | Query | Result used |
| --- | --- | --- |
| 1 | Bull 2019 npj Digital Medicine real-world menstrual cycle characteristics | PMC6710244, full text fetched |
| 2 | Wilcox 2000 BMJ timing of the fertile window day-specific estimates | PubMed abstract, AAFP summary (PMC fetch blocked) |
| 3 | Wilcox Weinberg Baird 1995 NEJM timing of intercourse six-day window | Abstract via Ovid/CARTA |
| 4 | FIGO 2018 Munro normal menstrual parameters frequency regularity duration | Merck table, Jain/Munro/Critchley 2023 review |
| 5 | Ecochard 2001 BJOG chronological aspects of indices of ovulation | PubMed abstract; USCCB review; Guida 1999 via AAFP |
| 6 | Wrist skin temperature wearable ovulation accuracy Apple Watch Oura Natural Cycles | Zhu 2021 JMIR; Maijala 2019; SKKU Galaxy Watch study; Natural Cycles research pages |
| 7 | Fehring 2006 variability in the phases of the menstrual cycle | PubMed abstract; Marquette repository |
| 8 | TGA software-based medical devices excluded goods consumer wellness fertility | TGA 14B guidance (16 Mar 2026) fetched; Clayton Utz 2026 note |
| 9 | Natural Cycles ARTG classification contraceptive software | ARTG 349810 (Class IIb); FDA K202897 |
| 10 | Privacy and Other Legislation Amendment Act 2024 statutory tort children's code | MinterEllison, Corrs, Digital Rights Watch |
| 11 | Health Connect data types MenstruationFlowRecord CervicalMucusRecord … | Android data-types index fetched (updated 23 Sep 2026) |
| 12 | HKCategoryTypeIdentifier pregnancyTestResult contraceptive lactation appleSleepingWristTemperature | Apple reference pages; Apple Cycle Tracking IFU |
| 13 | Expo SDK latest version 2026; Expo SDK 57; Expo SDK 58 | expo.dev changelogs (57 stable 30 Jun 2026; 58 beta) |
| 14 | expo-sqlite SQLCipher useSQLCipher | Expo docs v57 |
| 15 | @kingstinct/react-native-healthkit; react-native-health-connect maintained | GitHub releases (RNHC 4.1.3, Aug 2026) and package pages |
| 16 | 2023 international PCOS guideline irregular cycles adolescents | AAFP 2024 summary; BMC Medicine adolescent table |
| 17 | STRAW+10 early and late menopausal transition criteria | Harlow & Paramsothy (PMC3232023); CDC stacks |
| 18 | Return of fertility after stopping contraception; postpartum return of ovulation | Girum 2018 meta-analysis; Jackson & Glasier 2011 |
| 19 | Washington My Health My Data Act Nevada Connecticut | Fisher Phillips; Paubox |
| 20 | Li Urteaga Elhadad Clue self-tracked cycle characterisation and prediction | PMC7250828; PMC8714275; repo README (data not public) |
| 21 | GitHub search for public cycle datasets (FedCycleData, menstrual, period-tracker) | No legally clear dataset reachable; rate-limited API |

### 12.2 Sources rejected and why

- Kaggle "FedCycleData" (Marquette) could not be reached from the sandbox and its licence is unclear; not used.
- Natural Cycles marketing pages on Apple Watch and Oura effectiveness: used only for the "never mix oral and wrist" practice, not for effectiveness figures (industry claims, no peer review in the page).
- Wareable article on Oura's fertile-window study: secondary press; figures not used.
- StatPearls and slide-share summaries of FIGO: replaced by the Merck table and the Munro-authored review.
- Clinical-manual flashcards and forum posts: ignored.

### 12.3 Prototype code

```python
# Normal-Inverse-Gamma update and Student-t predictive interval (model D core; see 4.3)
import numpy as np
from scipy import stats

def nig_posterior(hist, m0=29.3, k0=0.5, a0=2.5, s0=2.6, lam=1.0):
    hist = np.asarray(hist, float); n = len(hist); b0 = a0 * s0**2
    if n == 0:
        return m0, k0, a0, b0
    w = lam ** np.arange(n)[::-1]; W = w.sum()
    xbar = (w * hist).sum() / W; S = (w * (hist - xbar)**2).sum()
    kn = k0 + W; mn = (k0*m0 + W*xbar) / kn; an = a0 + W/2
    bn = b0 + S/2 + (k0*W*(xbar - m0)**2) / (2*kn)
    return mn, kn, an, bn

def predictive_interval(hist, level=0.8, **kw):
    mn, kn, an, bn = nig_posterior(hist, **kw)
    nu = 2*an; scale = np.sqrt(bn*(kn+1)/(an*kn))
    t = stats.t.ppf(0.5 + level/2, nu)
    return mn, (mn - t*scale, mn + t*scale)

def robust_core(hist):
    hist = np.asarray(hist, float)
    if len(hist) < 3: return hist
    med = np.median(hist); mad = 1.4826*np.median(np.abs(hist - med))
    core = hist[hist <= med + max(7.0, 3*mad)]
    return core if len(core) >= 2 else hist
```

The full comparison harness (4,000 synthetic users, four models, two populations, clean and 8%-skipped histories) is reproduced in `tools/backtest/proto.py` in the repo and its output is the table in 4.13.

### 12.4 Unresolved questions

- Independent validation of Apple's wrist-temperature ovulation estimates.
- Breastfeeding return-of-fertility timing for the postpartum life state.
- Population-level predictive value, if any, of mittelschmerz and breast tenderness for ovulation timing.
- Current Health Connect changes-token lifetime and HealthKit background-delivery minimum frequency per cycle-tracking type.
- Whether third-party apps may write HealthKit contraceptive, pregnancy and lactation samples.
- Current Flo and Clue export file formats.

## 13. References

Every source below was opened during the research session on 9 October 2026; entries marked (abstract) were read from the abstract or a secondary summary because the full text was not reachable.

**Cycle physiology and prediction**

1. Bull JR, Rowland SP, Berglund Scherwitzl E, Scherwitzl R, Gemzell Danielsson K, Harper J. Real-world menstrual cycle characteristics of more than 600,000 menstrual cycles. npj Digital Medicine 2019;2:83. [PMC6710244](https://pmc.ncbi.nlm.nih.gov/articles/PMC6710244). Funded by Natural Cycles Nordic AB; two authors employees, two founders.
2. Wilcox AJ, Weinberg CR, Baird DD. Timing of sexual intercourse in relation to ovulation. N Engl J Med 1995;333:1517–21. [abstract](https://carta.anthropogeny.org/node/310410).
3. Wilcox AJ, Dunson D, Baird DD. The timing of the "fertile window" in the menstrual cycle: day specific estimates from a prospective study. BMJ 2000;321:1259–62. [PubMed 11082086](https://pubmed.ncbi.nlm.nih.gov/11082086/) (abstract).
4. Fehring RJ, Schneider M, Raviele K. Variability in the phases of the menstrual cycle. JOGNN 2006;35:376–84. [PubMed 16700687](https://pubmed.ncbi.nlm.nih.gov/16700687/) (abstract).
5. Ecochard R, Boehringer H, Rabilloud M, Marret H. Chronological aspects of ultrasonic, hormonal, and other indirect indices of ovulation. BJOG 2001;108:822–9. [PubMed 11510707](https://pubmed.ncbi.nlm.nih.gov/11510707/) (abstract).
6. Guida M et al. Reliability of ovulation tests in infertile women (1999/2001), summarised in Am Fam Physician 2001;64:858. [AAFP](https://www.aafp.org/afp/2001/0901/p858.html).
7. Zhu TY et al. The accuracy of wrist skin temperature in detecting ovulation compared to basal body temperature. J Med Internet Res 2021;23:e20710. [PMC8238491](https://pmc.ncbi.nlm.nih.gov/articles/PMC8238491/). Ava AG authors.
8. Maijala A et al. Nocturnal finger skin temperature in menstrual cycle tracking: ambulatory pilot study using a wearable Oura ring. BMC Women's Health 2019;19:150. [PubMed 31783840](https://pubmed.ncbi.nlm.nih.gov/31783840/).
9. Kim SE et al. Evaluation of the accuracy of wrist skin temperature measured using an infrared sensor for prediction of ovulation date (Galaxy Watch 5). [SKKU repository](https://scholarx.skku.edu/item/c076f260-522c-43cb-a0fd-3d330decb736) (abstract).
10. Li K, Urteaga I, Wiggins CH, Druet A, Shea A, Vitzthum VJ, Elhadad N. Characterizing physiological and symptomatic variation in menstrual cycles using self-tracked mobile-health data. npj Digital Medicine 2020;3:79. [PMC7250828](https://pmc.ncbi.nlm.nih.gov/articles/PMC7250828/).
11. Li K, Urteaga I, Shea A, Vitzthum VJ, Wiggins CH, Elhadad N. A predictive model for next cycle start date that accounts for adherence in menstrual self-tracking. JAMIA 2022;29:3–11. [PMC8714275](https://pmc.ncbi.nlm.nih.gov/articles/PMC8714275).
12. Bouchard T, Fehring R, Schneider M. Pilot evaluation of a new urine progesterone test (review of ovulation markers). [PMC6081768](https://pmc.ncbi.nlm.nih.gov/articles/PMC6081768/).
13. Natural Cycles. How effective is Natural Cycles when used with Apple Watch. [naturalcycles.com](https://www.naturalcycles.com/research-library/how-effective-is-natural-cycles-when-used-with-apple-watch) (industry page; used for the separate-coverline practice only).

**Clinical guidelines and thresholds**

14. Munro MG, Critchley HOD, Fraser IS; FIGO Menstrual Disorders Committee. The two FIGO systems for normal and abnormal uterine bleeding symptoms and classification of causes of abnormal uterine bleeding in the reproductive years: 2018 revisions. Int J Gynaecol Obstet 2018;143:393–408; summarised in Jain V, Munro MG, Critchley HOD 2023, [PMC10952771](https://pmc.ncbi.nlm.nih.gov/articles/PMC10952771/), and the [Merck normal parameters table](https://www.merckmanuals.com/professional/multimedia/table/normal-menstrual-parameters).
15. International Evidence-based Guideline for the Assessment and Management of PCOS 2023; adolescent criteria summarised in Peña AS et al. BMC Medicine 2020 ([table](https://bmcmedicine.biomedcentral.com/articles/10.1186/s12916-020-01516-x/tables/4)) and [AAFP 2024](https://www.aafp.org/afp/2024/1100/practice-guidelines-polycystic-ovary-syndrome).
16. Harlow SD, Paramsothy P. Menstruation and the menopause transition (STRAW+10 bleeding criteria). Obstet Gynecol Clin North Am 2011. [PMC3232023](https://pmc.ncbi.nlm.nih.gov/articles/PMC3232023/).
17. Jackson E, Glasier A. Return of ovulation and menses in postpartum nonlactating women: a systematic review. Obstet Gynecol 2011;117:657–62. [summary](https://rrmacademy.org/library/return-of-ovulation-and-menses-in-postpartum-nonlactating-women-a-systematic-rev-lrudv46h/).
18. Girum T, Wasie A. Return of fertility after discontinuation of contraception: a systematic review and meta-analysis. Contracept Reprod Med 2018;3:9. [PMC6055351](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6055351/).

**Regulatory and privacy**

19. Therapeutic Goods Administration. Understanding the general health or wellness software exclusion (item 14B), 16 March 2026. [tga.gov.au](https://www.tga.gov.au/resources/guidance/understanding-general-health-or-wellness-software-exclusion).
20. Therapeutic Goods Administration. ARTG 349810, AA-Med Pty Ltd / Natural Cycles self-care monitoring software, Class IIb. [tga.gov.au](https://www.tga.gov.au/node/312026).
21. Apple Inc. Instructions for Use: Cycle Tracking 4.x (EN-AU). [apple.com](https://www.apple.com/legal/ifu/cycle-tracking/4-0/ct-ifu-4-0-en_AU.pdf).
22. FDA 510(k) K202897, Natural Cycles, 21 CFR 884.5370. [innolitics summary](https://fda.innolitics.com/device/K202897).
23. Clayton Utz. Healthcare software: TGA clarifies when AI will be regulated as a medical device, July 2026. [claytonutz.com](https://www.claytonutz.com/insights/2026/july/healthcare-software-tga-clarifies-when-ai-will-be-regulated-as-a-medical-device).
24. MinterEllison. Privacy and Other Legislation Amendment Act 2024 now in effect. [minterellison.com](https://www.minterellison.com/articles/privacy-and-other-legislation-amendment-act-2024-now-in-effect).
25. Corrs Chambers Westgarth. Australia's ongoing privacy reforms (statutory tort commenced 10 June 2025; Children's Online Privacy Code by 10 December 2026). [corrs.com.au](https://corrs.com.au/insights/australias-ongoing-privacy-reforms-bolstering-australias-privacy-regulatory-framework).
26. Fisher Phillips. Beyond HIPAA: states join trend to protect consumer health data (Washington, Nevada, Connecticut). [fisherphillips.com](https://www.fisherphillips.com/en/news-insights/beyond-hipaa-states-join-trend-to-protect-consumer-health-data.html).
27. Paubox. The state laws that regulate health data outside of HIPAA. [paubox.com](https://www.paubox.com/blog/the-state-laws-that-regulate-health-data-outside-of-hipaa).

**Platform and tooling documentation**

28. Android Developers. Health Connect data types (updated 23 September 2026). [developer.android.com](https://developer.android.com/health-and-fitness/health-connect/data-types).
29. Android Developers. Complete the health apps declaration in the Play Console. [developer.android.com](https://developer.android.com/health-and-fitness/guides/health-connect/publish/declare-access).
30. Apple Developer. HKCategoryTypeIdentifier and cycle-tracking identifiers. [developer.apple.com](https://developer.apple.com/documentation/healthkit/hkcategorytypeidentifier.md).
31. Expo. SDK 57 release notes (30 June 2026) and SDK 58 beta. [expo.dev/changelog/sdk-57](https://expo.dev/changelog/sdk-57); [sdk-58-beta](https://expo.dev/changelog/sdk-58-beta).
32. Expo. expo-sqlite documentation (SQLCipher option), SDK 57. [docs.expo.dev](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/).
33. kingstinct/react-native-healthkit. [GitHub](https://github.com/kingstinct/react-native-healthkit).
34. matinzd/react-native-health-connect, releases to 4.1.3 (6 August 2026). [GitHub releases](https://github.com/matinzd/react-native-health-connect/releases).
35. iurteaga/menstrual\_cycle\_analysis repository README (data not public). [GitHub](https://github.com/iurteaga/menstrual_cycle_analysis).
