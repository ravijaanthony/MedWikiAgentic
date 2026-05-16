from __future__ import annotations

import re

from app.state.schemas import DispatchPlan, PipelineEvent, dump_model


async def dispatch_node(state: dict) -> dict:
    transcript = state.get("ground_truth_transcript", "")
    entities = state.get("resolved_entities", [])

    has_meds = bool(entities) or bool(re.search(r"\b(mg|prescribe|tablet|medication|amoxicillin|metformin)\b", transcript, re.I))
    has_vitals = bool(
        re.search(r"\b(bp|blood pressure|heart rate|pulse|spo2|temp|fever)\b", transcript, re.I)
        or re.search(r"\d{2,3}\s*/\s*\d{2,3}", transcript)
    )

    plan = DispatchPlan(
        run_vitals=has_vitals,
        run_safety=has_meds,
        run_advocate=True,
        run_clinical=True,
    )

    events = [
        PipelineEvent(
            node="dispatch",
            status="completed",
            message="Specialists routed",
            payload=dump_model(plan),
        ).model_dump()
    ]
    return {"dispatch_plan": dump_model(plan), "events": events}
