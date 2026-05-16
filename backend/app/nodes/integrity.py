from __future__ import annotations

from app.clients.openai_refine import citation_in_transcript, run_agent_json
from app.state.schemas import IntegrityIssue, IntegrityReport, PipelineEvent


def _collect_citations(state: dict) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    transcript = state.get("ground_truth_transcript", "")

    for item in state.get("symptoms", []):
        pairs.append(("symptoms", item.get("verbatim_citation", "")))
    for item in state.get("vitals_findings", []):
        pairs.append(("vitals", item.get("verbatim_citation", "")))
    for item in state.get("safety_findings", []):
        pairs.append(("safety", item.get("verbatim_citation", "")))

    advocate = state.get("advocate_summary") or {}
    for c in advocate.get("citations", []):
        pairs.append(("advocate", c))

    note = state.get("clinical_note") or {}
    for section in note.get("sections", []):
        for c in section.get("citations", []):
            pairs.append(("clinical", c))

    return pairs, transcript


async def integrity_node(state: dict) -> dict:
    pairs, transcript = _collect_citations(state)
    issues: list[IntegrityIssue] = []

    for field, citation in pairs:
        if not citation:
            issues.append(IntegrityIssue(field=field, message="Missing citation", citation=None))
        elif not citation_in_transcript(citation, transcript):
            issues.append(
                IntegrityIssue(
                    field=field,
                    message="Citation not found in ground-truth transcript",
                    citation=citation,
                )
            )

    passed = len(issues) == 0
    retry_count = state.get("retry_count", 0)

    if not passed:
        audit = await run_agent_json(
            "Audit medical agent outputs for hallucinations. Return JSON: {\"passed\": bool, \"issues\": [{\"field\": \"\", \"message\": \"\"}]}",
            f"Transcript:\n{transcript}\n\nState excerpt: symptoms={state.get('symptoms')}, safety={state.get('safety_findings')}",
        )
        if audit.get("issues"):
            for item in audit["issues"]:
                issues.append(IntegrityIssue(field=item.get("field", "audit"), message=item.get("message", "")))
            passed = audit.get("passed", False)

    retry_recommended = not passed and retry_count < 1
    report = IntegrityReport(passed=passed or retry_count >= 1, issues=issues, retry_recommended=retry_recommended)

    events = [
        PipelineEvent(
            node="integrity",
            status="completed",
            message="Integrity passed" if report.passed else "Integrity issues found",
            payload={"passed": report.passed, "issue_count": len(issues)},
        ).model_dump()
    ]

    update: dict = {
        "integrity_report": report.model_dump(),
        "events": events,
    }
    if retry_recommended:
        update["retry_count"] = retry_count + 1
    return update
