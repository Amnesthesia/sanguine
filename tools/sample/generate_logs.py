import os
import argparse
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel, Field
from google import genai


class LogEntry(BaseModel):
    Date: str = Field(description="Date in YYYY-MM-DD format")
    Temperature: Optional[float] = Field(description="Basal body temperature in Celsius (e.g., 36.14, 36.62). Null if skipped or missed.")
    Menstruation: Optional[str] = Field(description="MENSTRUATION, SPOTTING, MISCARRIAGE_BLEEDING, or null")
    LH_test: Optional[str] = Field(description="NO, YES, or null", alias="LH test")
    Pregnancy_test: Optional[str] = Field(description="NO, YES, or null", alias="Pregnancy test")
    Had_sex: Optional[float] = Field(description="Usually null in this dataset, but could be 1.0 or null", alias="Had sex")
    Notes: Optional[str] = Field(description="Any random notes like 'Migraine', 'Light headed', 'Tiny cramps', or null")
    Skipped: Optional[float] = Field(description="1.0 if the day was skipped, otherwise null")
    Source: Optional[str] = Field(description="Usually null")
    Data_Flag: Optional[str] = Field(description="Comma-separated flags like DEVIATION_REASON_SICK, PAIN_HEADACHE, MOOD_TIRED, etc. or null", alias="Data Flag")
    Menstruation_Quantity: Optional[str] = Field(description="HEAVY, LIGHT, MEDIUM, or null", alias="Menstruation Quantity")
    Cervical_Mucus_Consistency: Optional[str] = Field(description="EGGWHITE, CREAMY, STICKY, or null", alias="Cervical Mucus Consistency")
    Cervical_Mucus_Quantity: Optional[str] = Field(description="HEAVY, LIGHT, MEDIUM, or null", alias="Cervical Mucus Quantity")
    Sex_Type: Optional[str] = Field(description="Usually null", alias="Sex Type")
    Libido: Optional[str] = Field(description="Usually null")
    Covid_Test: Optional[str] = Field(description="Usually null", alias="Covid Test")

class LogEntries(BaseModel):
    entries: List[LogEntry]

def generate_fake_logs(
    start_date: str, 
    num_days: int,
    irregular_cycles: bool = False,
    pregnancy_loss: bool = False,
    missed_periods: bool = False
) -> pd.DataFrame:
    client = genai.Client()
    
    prompt = f"""
    You are a realistic synthetic data generator for female health and menstrual tracking logs.
    Generate a highly realistic sequence of {num_days} daily log entries starting from {start_date}.
    
    Rules for biological realism:
    - Menstruation usually lasts 3-7 days.
    - Menstruation Quantity typically goes from HEAVY -> MEDIUM -> LIGHT over the period.
    - Basal body temperature (Temperature) is slightly lower (e.g. 35.8-36.2) in the follicular phase (before ovulation) and rises by about 0.3-0.5 degrees (e.g. 36.3-36.7) in the luteal phase (after ovulation).
    - Ovulation usually happens around 14 days before the NEXT menstruation.
    - Cervical Mucus Consistency changes to EGGWHITE around ovulation.
    - LH test (luteinizing hormone) may be YES right before ovulation.
    - Missing data is common. 'Skipped' should be 1.0 occasionally. When Skipped=1.0, Temperature might be missing or there might be a Data_Flag like DEVIATION_REASON_SLEEP.
    - Provide occasional notes and data flags as in a real user app.
    """

    if irregular_cycles:
        prompt += "\n    - The user has highly irregular cycles (varying wildly between 20 and 45+ days). Reflect this in the timing of menstruation and temperature shifts."
    else:
        prompt += "\n    - Menstrual cycles are typically 25-32 days long."
        
    if pregnancy_loss:
        prompt += "\n    - Include a pregnancy loss event: The user should experience a pregnancy (positive Pregnancy test, sustained high temperatures beyond 14 days post-ovulation) followed by a pregnancy loss marked as 'MISCARRIAGE_BLEEDING' during this timeframe."
        
    if missed_periods:
        prompt += "\n    - The user should have at least one entirely missed period (an unusually long anovulatory cycle, perhaps 60+ days) during this timeframe, with no temperature shift or bleeding."

    prompt += f"\n\n    Output exactly {num_days} continuous days of data in the requested JSON format."

    print("Requesting data from Gemini...")
    interaction = client.interactions.create(
        model="gemini-3.5-flash-lite",
        input=prompt,
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": LogEntries.model_json_schema()
        },
    )

    try:
        parsed_data = LogEntries.model_validate_json(interaction.output_text)
    except Exception as e:
        print("Failed to parse output:")
        print(interaction.output_text)
        raise e

    # Convert to pandas DataFrame
    data_list = []
    for entry in parsed_data.entries:
        # model_dump(by_alias=True) outputs dict using the aliases (which match Excel column names)
        data_list.append(entry.model_dump(by_alias=True))
        
    df = pd.DataFrame(data_list)
    # Reorder columns to match original
    cols = ['Date', 'Temperature', 'Menstruation', 'LH test', 'Pregnancy test', 'Had sex', 
            'Notes', 'Skipped', 'Source', 'Data Flag', 'Menstruation Quantity', 
            'Cervical Mucus Consistency', 'Cervical Mucus Quantity', 'Sex Type', 'Libido', 'Covid Test']
    
    # Ensure all columns exist
    for c in cols:
        if c not in df.columns:
            df[c] = pd.NA
            
    df = df[cols]
    df['Date'] = pd.to_datetime(df['Date'])
    return df

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic NaturalCycles logs.")
    parser.add_argument("--start", type=str, default="2023-01-01", help="Start date in YYYY-MM-DD")
    parser.add_argument("--days", type=int, default=60, help="Number of days to generate")
    parser.add_argument("--output", type=str, default="fake-logs.xlsx", help="Output Excel filename")
    
    # New options for edge cases
    parser.add_argument("--irregular-cycles", action="store_true", help="Generate highly irregular cycle lengths")
    parser.add_argument("--pregnancy-loss", action="store_true", help="Include a pregnancy and subsequent miscarriage")
    parser.add_argument("--missed-periods", action="store_true", help="Include missed periods (anovulatory cycles)")
    
    args = parser.parse_args()
    
    if not os.environ.get("GEMINI_API_KEY"):
        print("Error: GEMINI_API_KEY environment variable is missing.")
        print("Please set it with: export GEMINI_API_KEY='your_key'")
        exit(1)

    df = generate_fake_logs(
        start_date=args.start,
        num_days=args.days,
        irregular_cycles=args.irregular_cycles,
        pregnancy_loss=args.pregnancy_loss,
        missed_periods=args.missed_periods
    )
    df.to_excel(args.output, index=False)
    print(f"Successfully generated {len(df)} days of data to {args.output}")
