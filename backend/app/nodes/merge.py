from __future__ import annotations

from app.state.schemas import PipelineEvent


async def merge_node(state: dict) -> dict:
    events = [
        PipelineEvent(
            node="merge",
            status="completed",
            message="Specialist outputs merged",
            payload={
                "vitals": len(state.get("vitals_findings", [])),
                "safety": len(state.get("safety_findings", [])),
                "has_advocate": state.get("advocate_summary") is not None,
                "has_clinical": state.get("clinical_note") is not None,
            },
        ).model_dump()
    ]
    return {"events": events}
