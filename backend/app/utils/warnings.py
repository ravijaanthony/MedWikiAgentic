from __future__ import annotations


def dedupe_warnings(warnings: list[dict]) -> list[dict]:
    """Collapse duplicate warnings (e.g. after integrity retry re-runs specialists)."""
    seen: set[tuple[str, str]] = set()
    out: list[dict] = []
    for w in warnings:
        key = (w.get("code", ""), w.get("message", ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(w)
    return out
