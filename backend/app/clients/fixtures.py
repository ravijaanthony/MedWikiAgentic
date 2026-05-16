"""Demo fixtures when external APIs are unavailable."""

FIXTURE_TRANSCRIPT_SINGLISH = (
    "Doctor: Good morning Mr Tan, how you feeling today? "
    "Patient: Still got fever lah, and the cough quite bad already three days. "
    "Doctor: I see your BP is 145 over 92, heart rate 88. "
    "Patient: I taking Panadol only. Got allergy to penicillin one. "
    "Doctor: I'll prescribe Amoxicillin 500mg twice daily for the infection. "
    "Also continue your Metformin for diabetes. Drink more water ah."
)

FIXTURE_VALSEA_METADATA = {
    "primary_dialect": "Singlish",
    "code_switch_segments": [
        {"text": "how you feeling today", "dialect": "Singlish", "start": 0, "end": 24},
        {"text": "Still got fever lah", "dialect": "Singlish", "start": 25, "end": 44},
        {"text": "Drink more water ah", "dialect": "Singlish", "start": 200, "end": 219},
    ],
    "accent_tags": ["Southeast Asian", "Dialect-English"],
}

FIXTURE_TRANSCRIPT_ENGLISH = (
    "Doctor: Good morning. How are you feeling? "
    "Patient: I have had a fever and cough for three days. "
    "Doctor: Blood pressure is 120 over 80, pulse 72. "
    "Patient: I am allergic to penicillin. I take Metformin daily. "
    "Doctor: I will prescribe Amoxicillin 500mg twice daily."
)
