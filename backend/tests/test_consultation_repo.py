from uuid import uuid4

import pytest

from app.config import get_settings
from app.services.consultation_repo import (
    get_consultation,
    init_consultations_db,
    list_consultations_for_patient,
    upsert_consultation,
)
from app.services.patient_context import create_patient


def _postgres_configured() -> bool:
    try:
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


def test_consultation_crud_roundtrip() -> None:
    init_consultations_db()
    patient = create_patient(
        display_name="History Test",
        allergies=[],
        current_meds=[],
        age=33,
        sex="M",
        linguistic_signature="English",
    )
    run_id = str(uuid4())

    upsert_consultation(
        run_id=run_id,
        patient_id=patient.patient_id,
        status="running",
        state={"raw_transcript": "hello", "warnings": []},
        completed=False,
    )
    started = get_consultation(run_id)
    assert started is not None
    assert started["status"] == "running"
    assert started["completed_at"] is None

    upsert_consultation(
        run_id=run_id,
        patient_id=patient.patient_id,
        status="completed",
        state={
            "raw_transcript": "hello",
            "ground_truth_transcript": "hello, doctor",
            "warnings": [{"code": "DDI", "message": "x", "severity": "moderate"}],
            "integrity_report": {"passed": True, "issues": []},
        },
        completed=True,
    )
    finished = get_consultation(run_id)
    assert finished is not None
    assert finished["status"] == "completed"
    assert finished["completed_at"] is not None
    assert finished["state"]["integrity_report"]["passed"] is True

    history = list_consultations_for_patient(patient.patient_id, limit=5)
    match = next((h for h in history if h["run_id"] == run_id), None)
    assert match is not None
    assert match["status"] == "completed"
    assert match["warning_count"] >= 1
    assert match["integrity_passed"] is True
    assert "hello" in match["transcript_preview"]


def test_audio_bytes_stripped_before_storage() -> None:
    init_consultations_db()
    patient = create_patient(
        display_name="Bytes Strip Test",
        allergies=[],
        current_meds=[],
        age=40,
        sex="F",
        linguistic_signature="English",
    )
    run_id = str(uuid4())
    upsert_consultation(
        run_id=run_id,
        patient_id=patient.patient_id,
        status="completed",
        state={"audio_bytes": b"\x00\x01binary", "raw_transcript": "txt"},
        completed=True,
    )
    rec = get_consultation(run_id)
    assert rec is not None
    assert "audio_bytes" not in rec["state"]
    assert rec["state"]["raw_transcript"] == "txt"
