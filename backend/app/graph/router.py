from __future__ import annotations

from typing import Literal


def integrity_router(state: dict) -> Literal["retry", "end"]:
    report = state.get("integrity_report") or {}
    if report.get("passed"):
        return "end"
    if report.get("retry_recommended") and state.get("retry_count", 0) <= 1:
        return "retry"
    return "end"
