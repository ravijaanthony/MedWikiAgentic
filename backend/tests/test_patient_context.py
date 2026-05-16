import pytest

from app.services.patient_context import add_medication, create_patient, get_patient


def _postgres_configured() -> bool:
    try:
        from app.config import get_settings

        url = get_settings().database_url
        if not url.startswith(("postgresql://", "postgres://")):
            return False
        if "[" in url or "127.0.0.1" in url:
            return False
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _postgres_configured(),
    reason="DATABASE_URL in backend/.env must be a real Supabase PostgreSQL URL",
)


def test_patient_crud_roundtrip() -> None:
    patient = create_patient(
        display_name="Test Patient",
        allergies=["penicillin"],
        current_meds=["Aspirin"],
        age=40,
        sex="F",
        linguistic_signature="English",
    )
    loaded = get_patient(patient.patient_id)
    assert loaded is not None
    assert loaded.display_name == "Test Patient"
    assert loaded.allergies == ["penicillin"]

    updated = add_medication(patient.patient_id, "Metformin")
    assert updated is not None
    assert "Metformin" in updated.current_meds

    reloaded = get_patient(patient.patient_id)
    assert reloaded is not None
    assert any("Metformin" in m for m in reloaded.current_meds)
