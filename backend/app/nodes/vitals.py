from __future__ import annotations

import re

from app.state.schemas import CitedInsight, PipelineEvent


async def vitals_node(state: dict) -> dict:
    transcript = state.get("ground_truth_transcript", "")
    findings: list[dict] = []

    patterns = [
        (r"(\d{2,3}\s*/\s*\d{2,3})", "Blood pressure reading"),
        (r"(?:heart rate|pulse)\s*(?:is\s*)?(\d{2,3})", "Heart rate"),
        (r"(?:BP|blood pressure)\s*(?:is\s*)?(\d{2,3}\s*(?:over|/)\s*\d{2,3})", "Blood pressure"),
    ]

    for pattern, label in patterns:
        for match in re.finditer(pattern, transcript, re.I):
            span = match.group(0)
            findings.append(
                CitedInsight(
                    claim=f"{label}: {span}",
                    verbatim_citation=span,
                    confidence="high",
                ).model_dump()
            )

    events = [
        PipelineEvent(
            node="vitals",
            status="completed",
            message=f"Extracted {len(findings)} vital findings",
        ).model_dump()
    ]
    return {"vitals_findings": findings, "events": events}
