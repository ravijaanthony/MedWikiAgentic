from __future__ import annotations

import re


def _sentences(transcript: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", transcript.strip())
    return [p.strip() for p in parts if p and len(p.strip()) > 8]


def heuristic_advocate_summary(
    transcript: str,
    display_name: str,
    dialect: str,
    allergies: list[str],
) -> tuple[str, list[str]]:
    """Build a patient summary only from transcript text (no invented clinical content)."""
    sents = _sentences(transcript)
    if not sents:
        return (
            f"Hi {display_name}, we could not extract clear instructions from the transcript. "
            "Please ask your doctor to clarify next steps.",
            [],
        )

    # Prefer doctor lines and closing instructions (often at end of consult)
    doctor_sents = [s for s in sents if re.match(r"^(Doctor|Dr\.?)\s*:", s, re.I)]
    plan_sents = doctor_sents[-2:] if len(doctor_sents) >= 2 else doctor_sents or sents[-2:]

    excerpt = " ".join(plan_sents) if plan_sents else sents[-1]
    citations = [plan_sents[-1]] if plan_sents else [sents[-1]]

    uses_lah = any(" lah" in s.lower() or s.lower().endswith("lah") for s in sents)
    greeting = f"Okay {display_name}," if ("singlish" in dialect.lower() or uses_lah) else f"Hi {display_name},"

    summary = f"{greeting} from today's visit: {excerpt}"

    allergy_in_transcript = any(
        a.lower() in transcript.lower() for a in allergies if a
    )
    if allergies and allergy_in_transcript:
        cited = next((s for s in sents if any(a.lower() in s.lower() for a in allergies)), citations[0])
        summary += f" Please remember your allergy ({', '.join(allergies)}) when taking any new medicine."
        if cited not in citations:
            citations.append(cited)

    return summary, citations
