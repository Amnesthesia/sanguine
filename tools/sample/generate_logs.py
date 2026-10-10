"""Synthetic Natural Cycles "daily entries" exports for testing (P8-12, D-091).

The cycle structure is planned here from a seed, so it is exactly what the options ask for: period days, ovulation, the
temperature shift, LH tests, a missed period, a pregnancy and its loss. Gemini (optional) only adds free-text notes and
symptom flags on top; it never decides when a period or ovulation happens. Next to the .xlsx a <name>.truth.json records
the plan (logged period starts, ovulation days, the loss), which the backtest checks the import against.

  python generate_logs.py --start 2026-01-01 --days 180 --irregular-cycles --output natural-cycles-irregular-1.xlsx
  python generate_logs.py --days 365 --missed-periods --pregnancy-loss --no-llm --seed 3 --output x.xlsx
"""
import argparse
import json
import os
import random
from datetime import date, timedelta
from typing import List, Optional

import pandas as pd
from pydantic import BaseModel, Field

COLS = ['Date', 'Temperature', 'Menstruation', 'LH test', 'Pregnancy test', 'Had sex', 'Notes', 'Skipped', 'Source', 'Data Flag',
        'Menstruation Quantity', 'Cervical Mucus Consistency', 'Cervical Mucus Quantity', 'Sex Type', 'Libido', 'Covid Test']
BLEED = ['HEAVY', 'HEAVY', 'MEDIUM', 'MEDIUM', 'LIGHT', 'LIGHT', 'LIGHT']


def plan(start: date, days: int, rng: random.Random, irregular: bool, missed: bool, loss: bool) -> dict:
    """True timeline. Parameters as in tools/backtest/src/events.ts: luteal 12.4 +/- 1.5 d (Bull 2019); an early loss at
    6-12 weeks, first period 4-6 weeks later (ACOG); a missed period is one anovulatory 55-80 d cycle."""
    mu = rng.uniform(26, 32)
    end = start + timedelta(days=days)
    cycles = []  # (start, length, ovulation or None, kind)
    d = start
    special = [k for k, on in (('missed', missed), ('loss', loss)) if on]
    while d < end:
        i = len(cycles)
        kind = special.pop(0) if special and i >= 2 else 'normal'
        length = round(rng.gauss(mu, 6 if irregular else 1.5))
        length = max(21, min(45, length)) if irregular else max(22, min(36, length))
        luteal = max(9, min(16, round(rng.gauss(12.4, 1.5))))
        ov = d + timedelta(days=length - luteal - 1)
        if kind == 'missed':
            length, ov = rng.randint(55, 80), None
        elif kind == 'loss':
            loss_day = d + timedelta(days=rng.randint(42, 84))
            length = (loss_day - d).days + rng.randint(28, 42)
        cycles.append({'start': d, 'length': length, 'ovulation': ov, 'kind': kind,
                       **({'loss': loss_day, 'positive_test': ov + timedelta(days=rng.randint(14, 18))} if kind == 'loss' else {})})
        d += timedelta(days=length)
    return {'cycles': cycles, 'end': end}


def rows_from(p: dict, rng: random.Random) -> dict:
    """Day -> column values, written the way the app exports them."""
    rows: dict = {}
    put = lambda day, **kv: rows.setdefault(day, {}).update({k.replace('_', ' '): v for k, v in kv.items()})
    end = p['end']
    for c in p['cycles']:
        s, ov = c['start'], c['ovulation']
        nxt = s + timedelta(days=c['length'])
        bleed = rng.randint(4, 6)
        for k in range(bleed):
            if 0 < k < bleed - 1 and rng.random() < 0.15:
                continue  # a bleeding day not logged; one-day gaps stay one period
            put(s + timedelta(days=k), Menstruation='MENSTRUATION', Menstruation_Quantity=BLEED[k])
        if rng.random() < 0.4:
            put(s + timedelta(days=bleed), Menstruation='SPOTTING')
        pregnant_until = c.get('loss')
        day = s
        while day < nxt and day < end:
            high = (ov is not None and day > ov and (pregnant_until is None or day < pregnant_until))
            if rng.random() > 0.1:  # a forgotten morning otherwise
                disturbed = rng.random() < 0.03
                t = (36.55 if high else 36.2) + rng.gauss(0, 0.07) + (0.4 if disturbed else 0)
                put(day, Temperature=round(t, 2), **({'Skipped': 1, 'Data_Flag': rng.choice(['DEVIATION_REASON_SLEEP', 'DEVIATION_REASON_ALCOHOL', 'DEVIATION_REASON_SICK'])} if disturbed else {}))
            day += timedelta(days=1)
        if ov is not None:
            if rng.random() < 0.6:
                for k in range(-4, 2):
                    put(ov + timedelta(days=k), LH_test='YES' if k == -1 else 'NO')
            for k, q in ((-4, 'CREAMY'), (-2, 'EGGWHITE'), (-1, 'EGGWHITE'), (0, 'EGGWHITE'), (2, 'STICKY')):
                if rng.random() < 0.5:
                    put(ov + timedelta(days=k), Cervical_Mucus_Consistency=q, Cervical_Mucus_Quantity=rng.choice(['LIGHT', 'MEDIUM', 'HEAVY']))
        if c['kind'] == 'loss':
            put(c['positive_test'], Pregnancy_test='YES')
            for k in range(rng.randint(4, 6)):
                put(c['loss'] + timedelta(days=k), Menstruation='MISCARRIAGE_BLEEDING', Menstruation_Quantity=BLEED[k])
    return {d: r for d, r in rows.items() if d < end}


class Flavour(BaseModel):
    Date: str = Field(description="YYYY-MM-DD, one of the dates given")
    Notes: Optional[str] = Field(description="Short note like 'Migraine', 'Tiny cramps', or null")
    Data_Flag: Optional[str] = Field(alias="Data Flag", description="Comma-separated symptom flags from: PAIN_CRAMPS, PAIN_HEADACHE, PAIN_BLOATING, PAIN_SORE_BREASTS, PAIN_BACKACHE, SKIN_ACNE, MOOD_TIRED, MOOD_SAD, MOOD_IRRITABLE, MOOD_HAPPY, MOOD_CALM, MOOD_STRESSED; or null")


class Flavours(BaseModel):
    entries: List[Flavour]


def add_flavour(rows: dict, p: dict) -> None:
    """Gemini writes notes and symptom flags for the days given, by cycle phase. Nothing structural is taken from it."""
    from google import genai
    phase = {}
    for c in p['cycles']:
        for k in range(c['length']):
            d = c['start'] + timedelta(days=k)
            ov = c['ovulation']
            phase[d] = 'period' if k < 5 else 'pregnant' if c['kind'] == 'loss' and ov and d > ov and d < c['loss'] else \
                'around ovulation' if ov and abs((d - ov).days) <= 1 else 'luteal' if ov and d > ov else 'follicular'
    days = '\n'.join(f'{d.isoformat()}: {phase.get(d, "follicular")}' for d in sorted(rows))
    prompt = ("Add realistic symptom flags and occasional short notes to a period-tracking log, as a real user would: "
              "cramps and back pain in the period, sore breasts and bloating late in the luteal phase, moods any time, many days with nothing. "
              f"Only use these dates (date: cycle phase):\n{days}")
    print("Requesting notes and symptoms from Gemini...")
    client = genai.Client()  # keep a reference: a temporary client is closed before the request is sent
    out = client.interactions.create(
        model="gemini-3.5-flash-lite", input=prompt,
        response_format={"type": "text", "mime_type": "application/json", "schema": Flavours.model_json_schema()},
    )
    for e in Flavours.model_validate_json(out.output_text).entries:
        d = date.fromisoformat(e.Date)
        if d not in rows:
            continue
        if e.Notes:
            rows[d]['Notes'] = e.Notes
        if e.Data_Flag:  # keep a deviation flag the plan set
            rows[d]['Data Flag'] = ','.join(x for x in [rows[d].get('Data Flag'), e.Data_Flag] if x)


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate a synthetic Natural Cycles export with a known true timeline.")
    ap.add_argument("--start", default="2025-01-01", help="first day, YYYY-MM-DD")
    ap.add_argument("--days", type=int, default=180)
    ap.add_argument("--output", default="fake-logs.xlsx")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--irregular-cycles", action="store_true", help="cycle SD 6 d, 21-45 d (else SD 1.5 d)")
    ap.add_argument("--pregnancy-loss", action="store_true", help="one pregnancy lost at 6-12 weeks")
    ap.add_argument("--missed-periods", action="store_true", help="one anovulatory 55-80 d cycle")
    ap.add_argument("--no-llm", action="store_true", help="skip Gemini notes and symptoms")
    a = ap.parse_args()

    rng = random.Random(a.seed)
    p = plan(date.fromisoformat(a.start), a.days, rng, a.irregular_cycles, a.missed_periods, a.pregnancy_loss)
    rows = rows_from(p, rng)
    if not a.no_llm:
        if not os.environ.get("GEMINI_API_KEY"):
            raise SystemExit("GEMINI_API_KEY is missing (or pass --no-llm)")
        add_flavour(rows, p)

    df = pd.DataFrame([{'Date': pd.Timestamp(d), **r} for d, r in sorted(rows.items())]).reindex(columns=COLS)
    df.to_excel(a.output, index=False)
    logged = [c['start'] for c in p['cycles'] if c['start'] < p['end']]
    truth = {
        'periodStarts': [d.isoformat() for d in logged],
        'ovulations': {c['start'].isoformat(): c['ovulation'].isoformat() for c in p['cycles'] if c['ovulation'] and c['ovulation'] < p['end']},
        'losses': [{'positiveTest': c['positive_test'].isoformat(), 'bleed': c['loss'].isoformat()} for c in p['cycles'] if c['kind'] == 'loss' and c['loss'] < p['end']],
        'lengths': [c['length'] for c in p['cycles']],
    }
    with open(os.path.splitext(a.output)[0] + '.truth.json', 'w') as f:
        json.dump(truth, f, indent=1)
    print(f"{len(df)} days to {a.output}; cycle lengths {truth['lengths']}")


if __name__ == "__main__":
    main()
