from __future__ import annotations

import logging

from app.clients.heuristic_agents import heuristic_advocate_summary
from app.clients.openai_refine import run_agent_json
from app.state.schemas import AdvocateOutput, PipelineEvent, ValseaMetadata, patient_from_state

logger = logging.getLogger(__name__)

ADVOCATE_SYSTEM = """You are a Patient Advocate. Summarize doctor instructions for the patient.
Use linguistic mirroring: match the patient's dialect style in your summary.
Only include facts present in the transcript. Do not invent symptoms, drugs, or advice.
Include citations as exact transcript substrings in a citations array.
Return JSON: {"summary": "...", "citations": ["..."]}"""


async def advocate_node(state: dict) -> dict:
    patient = patient_from_state(state.get("patient_context"))
    meta = ValseaMetadata.model_validate(state.get("valsea_metadata") or {})
    transcript = state.get("ground_truth_transcript", "") or state.get("raw_transcript", "")
    dialect = meta.primary_dialect or patient.linguistic_signature

    data = await run_agent_json(
        ADVOCATE_SYSTEM,
        f"Dialect: {dialect}\nPatient: {patient.display_name}\n\nTranscript:\n{transcript}",
    )

    if data.get("summary"):
        output = AdvocateOutput(
            summary=data["summary"],
            dialect_label=dialect,
            citations=data.get("citations", []),
            unverified=False,
            source="llm",
        )
    else:
        logger.warning("Advocate LLM unavailable or empty response; using transcript-grounded heuristic")
        summary, citations = heuristic_advocate_summary(
            transcript,
            patient.display_name,
            dialect,
            patient.allergies,
        )
        output = AdvocateOutput(
            summary=summary,
            dialect_label=dialect,
            citations=citations,
            unverified=True,
            source="heuristic",
        )

    events = [
        PipelineEvent(node="advocate", status="completed", message="Patient summary ready").model_dump()
    ]
    return {"advocate_summary": output.model_dump(), "events": events}
