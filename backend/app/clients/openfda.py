from __future__ import annotations

import httpx

OPENFDA_LABEL = "https://api.fda.gov/drug/label.json"


async def search_indications(drug_name: str, limit: int = 1) -> dict | None:
    """Fetch indications_and_usage for a drug from OpenFDA."""
    query = f'openfda.generic_name:"{drug_name}" OR openfda.brand_name:"{drug_name}"'
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                OPENFDA_LABEL,
                params={"search": query, "limit": limit},
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
            if not results:
                return None
            label = results[0]
            indications = label.get("indications_and_usage", [])
            text = indications[0] if indications else ""
            return {"drug": drug_name, "indications_text": text[:2000]}
    except Exception:
        return None


def symptom_matches_indication(symptom: str, indication_text: str) -> bool:
    if not indication_text:
        return False
    tokens = [t.strip().lower() for t in symptom.replace(",", " ").split() if len(t) > 3]
    hay = indication_text.lower()
    return any(t in hay for t in tokens)
