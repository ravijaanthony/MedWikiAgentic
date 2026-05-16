import pytest

from app.nodes.safety import _allergy_hit


def test_penicillin_allergy_matches_amoxicillin():
    assert _allergy_hit("amoxicillin", ["penicillin"]) == "penicillin"


def test_no_allergy_returns_none():
    assert _allergy_hit("metformin", ["penicillin"]) is None


@pytest.mark.asyncio
async def test_safety_node_allergy_warn():
    from app.nodes.safety import safety_node

    state = {
        "patient_context": {
            "patient_id": "test",
            "display_name": "Test",
            "allergies": ["penicillin"],
            "current_meds": ["Metformin"],
            "demographics": {},
            "linguistic_signature": "English",
        },
        "ground_truth_transcript": "Doctor will prescribe Amoxicillin 500mg for infection.",
        "resolved_entities": [
            {
                "brand": "Amoxicillin",
                "generic": "amoxicillin",
                "confidence": "high",
                "verbatim_citation": "Amoxicillin",
            }
        ],
        "symptoms": [{"claim": "infection", "verbatim_citation": "infection", "confidence": "medium"}],
    }
    result = await safety_node(state)
    assert result["safety_findings"]
    assert any("allergy" in f["claim"].lower() for f in result["safety_findings"])
    assert result["warnings"]
    assert all(w.get("code") for w in result["warnings"])
