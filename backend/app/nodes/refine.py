from __future__ import annotations

from app.clients.openai_refine import refine_transcript
from app.state.schemas import PipelineEvent, ValseaMetadata


async def refine_node(state: dict) -> dict:
    events = [PipelineEvent(node="refine", status="started", message="Refinement gate").model_dump()]
    meta = ValseaMetadata.model_validate(state.get("valsea_metadata") or {})
    result = await refine_transcript(state.get("raw_transcript", ""), meta.primary_dialect)

    events.append(
        PipelineEvent(
            node="refine",
            status="completed",
            message="Ground-truth transcript ready",
            payload={"entities": len(result.get("resolved_entities", []))},
        ).model_dump()
    )
    return {
        "ground_truth_transcript": result.get("ground_truth_transcript", state.get("raw_transcript", "")),
        "resolved_entities": result.get("resolved_entities", []),
        "symptoms": result.get("symptoms", []),
        "events": events,
    }
