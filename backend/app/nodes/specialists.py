from __future__ import annotations

import asyncio

from app.nodes.advocate import advocate_node
from app.nodes.clinical import clinical_node
from app.state.schemas import DispatchPlan
from app.nodes.safety import safety_node
from app.nodes.vitals import vitals_node
from app.state.schemas import PipelineEvent


async def specialists_parallel_node(state: dict) -> dict:
    plan = DispatchPlan.model_validate(state.get("dispatch_plan") or {})

    tasks = []
    names = []

    if plan.run_vitals:
        tasks.append(vitals_node(state))
        names.append("vitals")
    if plan.run_safety:
        tasks.append(safety_node(state))
        names.append("safety")
    if plan.run_advocate:
        tasks.append(advocate_node(state))
        names.append("advocate")
    if plan.run_clinical:
        tasks.append(clinical_node(state))
        names.append("clinical")

    if not tasks:
        return {"events": [PipelineEvent(node="specialists", status="completed", message="No specialists").model_dump()]}

    results = await asyncio.gather(*tasks)
    merged: dict = {"events": []}
    for name, result in zip(names, results):
        for key, value in result.items():
            if key == "events":
                merged["events"].extend(value)
            elif key == "warnings":
                merged.setdefault("warnings", [])
                merged["warnings"].extend(value)
            else:
                merged[key] = value

    merged["events"].append(
        PipelineEvent(
            node="specialists",
            status="completed",
            message=f"Parallel cluster finished: {', '.join(names)}",
        ).model_dump()
    )
    return merged
