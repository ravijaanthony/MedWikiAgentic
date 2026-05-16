from __future__ import annotations

import re

from app.clients.openai_refine import run_agent_json
from app.state.schemas import ClinicalNote, ClinicalNoteSection, PipelineEvent


CLINICAL_SYSTEM = """You are a Clinical Assistant. Produce a SOAP-style clinical note.
Every section must include citations as exact transcript substrings.
Return JSON:
{
  "sections": [
    {"title": "Subjective", "content": "...", "citations": ["..."]},
    {"title": "Objective", "content": "...", "citations": ["..."]},
    {"title": "Assessment", "content": "...", "citations": ["..."]},
    {"title": "Plan", "content": "...", "citations": ["..."]}
  ]
}"""


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip() and len(p.strip()) > 8]


def _heuristic_clinical_note(
    transcript: str,
    vitals: list[dict],
    safety: list[dict],
) -> ClinicalNote:
    sentences = _split_sentences(transcript)

    patient_sents = [s for s in sentences if re.match(r"^(Patient|Pt\.?)\s*:", s, re.I)]
    doctor_sents = [s for s in sentences if re.match(r"^(Doctor|Dr\.?)\s*:", s, re.I)]

    # Subjective: what the patient reported
    subj_sents = patient_sents or sentences[:2]
    subj_content = " ".join(subj_sents) if subj_sents else transcript[:120]
    subj_citation = subj_sents[-1] if subj_sents else transcript[:60]

    # Objective: pull from actual vitals findings, or opening sentences
    vital_citations = [v.get("verbatim_citation", "") for v in vitals if v.get("verbatim_citation")]
    obj_content = (
        "Vitals recorded: " + "; ".join(v.get("claim", "") for v in vitals[:3])
        if vitals
        else "No vitals extracted from transcript."
    )
    obj_citation = vital_citations[:2] or ([sentences[0]] if sentences else [transcript[:40]])

    # Assessment: safety findings give the richest grounded text; fall back to middle sentences
    if safety:
        assessment_content = "; ".join(
            s.get("claim", "") for s in safety[:2] if s.get("claim")
        )
        assessment_citations = [
            s.get("verbatim_citation", "") for s in safety[:2] if s.get("verbatim_citation")
        ]
    else:
        mid = len(sentences) // 2
        mid_sents = sentences[mid : mid + 2] if len(sentences) > 2 else sentences
        assessment_content = " ".join(mid_sents) if mid_sents else transcript[:80]
        assessment_citations = [mid_sents[-1]] if mid_sents else [transcript[:40]]

    # Plan: closing doctor instructions
    plan_sents = doctor_sents[-2:] if len(doctor_sents) >= 2 else doctor_sents or sentences[-2:]
    plan_content = " ".join(plan_sents) if plan_sents else transcript[-120:]
    plan_citation = plan_sents[-1] if plan_sents else (transcript[-60:] if len(transcript) > 60 else transcript)

    return ClinicalNote(
        source="heuristic",
        sections=[
            ClinicalNoteSection(
                title="Subjective",
                content=subj_content,
                citations=[subj_citation],
            ),
            ClinicalNoteSection(
                title="Objective",
                content=obj_content,
                citations=obj_citation,
            ),
            ClinicalNoteSection(
                title="Assessment",
                content=assessment_content,
                citations=assessment_citations,
            ),
            ClinicalNoteSection(
                title="Plan",
                content=plan_content,
                citations=[plan_citation],
            ),
        ],
    )


async def clinical_node(state: dict) -> dict:
    transcript = state.get("ground_truth_transcript", "")
    vitals = state.get("vitals_findings", [])
    safety = state.get("safety_findings", [])

    data = await run_agent_json(
        CLINICAL_SYSTEM,
        f"Transcript:\n{transcript}\n\nVitals: {vitals}\n\nSafety flags: {safety}",
    )

    if data.get("sections"):
        note = ClinicalNote.model_validate(data)
    else:
        note = _heuristic_clinical_note(transcript, vitals, safety)

    events = [
        PipelineEvent(node="clinical", status="completed", message="Clinical note generated").model_dump()
    ]
    return {"clinical_note": note.model_dump(), "events": events}
