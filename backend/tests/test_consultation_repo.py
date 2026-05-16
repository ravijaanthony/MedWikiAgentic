from __future__ import annotations

import uuid

import psycopg
import pytest

from app.config import get_settings
from app.services.consultation_repo import (
    get_consultation,
    init_consultations_db,
    list_consultations_for_user,
    upsert_consultation,
)


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


def _seed_auth_user(user_id: str) -> bool:
    try:
        with psycopg.connect(get_settings().database_url) as conn:
            conn.execute(
                """
                INSERT INTO auth.users (
                    id, instance_id, email, encrypted_password,
                    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                    aud, role
                ) VALUES (
                    %s, '00000000-0000-0000-0000-000000000000',
                    %s, '$2a$10$test', NOW(),
                    '{}'::jsonb, '{}'::jsonb,
                    'authenticated', 'authenticated'
                )
                ON CONFLICT (id) DO NOTHING
                """,
                (user_id, f"test-{user_id[:8]}@medwiki.test"),
            )
            conn.commit()
        return True
    except Exception:
        return False


def _cleanup_auth_user(user_id: str) -> None:
    try:
        with psycopg.connect(get_settings().database_url) as conn:
            conn.execute("DELETE FROM auth.users WHERE id = %s", (user_id,))
            conn.commit()
    except Exception:
        pass


@pytest.fixture
def synthetic_user_id() -> str:
    user_id = str(uuid.uuid4())
    if not _seed_auth_user(user_id):
        pytest.skip(
            "Could not seed auth.users (older Supabase schema?). "
            "Skipping FK-bound consultation tests."
        )
    yield user_id
    _cleanup_auth_user(user_id)


def test_consultation_crud_roundtrip(synthetic_user_id: str) -> None:
    init_consultations_db()
    run_id = str(uuid.uuid4())

    upsert_consultation(
        run_id=run_id,
        user_id=synthetic_user_id,
        status="running",
        state={"raw_transcript": "hello", "warnings": []},
        completed=False,
    )
    started = get_consultation(run_id)
    assert started is not None
    assert started["status"] == "running"
    assert started["completed_at"] is None
    assert started["user_id"] == synthetic_user_id

    upsert_consultation(
        run_id=run_id,
        user_id=synthetic_user_id,
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

    history = list_consultations_for_user(synthetic_user_id, limit=5)
    match = next((h for h in history if h["run_id"] == run_id), None)
    assert match is not None
    assert match["status"] == "completed"
    assert match["warning_count"] >= 1
    assert match["integrity_passed"] is True
    assert "hello" in match["transcript_preview"]


def test_audio_bytes_stripped_before_storage(synthetic_user_id: str) -> None:
    init_consultations_db()
    run_id = str(uuid.uuid4())
    upsert_consultation(
        run_id=run_id,
        user_id=synthetic_user_id,
        status="completed",
        state={"audio_bytes": b"\x00\x01binary", "raw_transcript": "txt"},
        completed=True,
    )
    rec = get_consultation(run_id)
    assert rec is not None
    assert "audio_bytes" not in rec["state"]
    assert rec["state"]["raw_transcript"] == "txt"
