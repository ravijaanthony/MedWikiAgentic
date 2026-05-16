from __future__ import annotations

import httpx

RXNAV_BASE = "https://rxnav.nlm.nih.gov/REST"


async def check_interactions(drug_names: list[str]) -> list[dict]:
    """Return interaction records for a list of drug names (generics preferred)."""
    if len(drug_names) < 2:
        return []

    names = [n.strip() for n in drug_names if n.strip()]
    if len(names) < 2:
        return []

    rxcui_map: dict[str, str] = {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        for name in names:
            try:
                resp = await client.get(
                    f"{RXNAV_BASE}/rxcui.json",
                    params={"name": name, "search": 2},
                )
                resp.raise_for_status()
                ids = resp.json().get("idGroup", {}).get("rxnormId", [])
                if ids:
                    rxcui_map[name] = ids[0]
            except Exception:
                continue

        rxcuis = list(rxcui_map.values())
        if len(rxcuis) < 2:
            return []

        try:
            resp = await client.get(
                f"{RXNAV_BASE}/interaction/list.json",
                params={"rxcuis": "+".join(rxcuis)},
            )
            resp.raise_for_status()
            groups = resp.json().get("fullInteractionTypeGroup", [])
            findings: list[dict] = []
            for group in groups:
                for itype in group.get("fullInteractionType", []):
                    for pair in itype.get("interactionPair", []):
                        desc = pair.get("description", "Drug interaction detected")
                        severity = pair.get("severity", "moderate") or "moderate"
                        findings.append(
                            {
                                "description": desc,
                                "severity": _normalize_severity(severity),
                                "drugs": names,
                            }
                        )
            return findings
        except Exception:
            return []


def _normalize_severity(value: str) -> str:
    v = value.lower()
    if "high" in v or "major" in v or "critical" in v:
        return "critical"
    if "moderate" in v or "medium" in v:
        return "moderate"
    return "low"
