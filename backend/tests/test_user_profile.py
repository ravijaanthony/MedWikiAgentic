"""Profile CRUD tests against a real Supabase Postgres.

These tests skip unless DATABASE_URL points at a real Supabase database (i.e.
not the placeholder template and not localhost). The canonical schema in
`supabase/migrations/003_user_profiles.sql` puts a foreign key from
`profiles.user_id` to `auth.users(id)`, so we seed a minimal `auth.users` row
for the duration of each test; if the seed fails (e.g. on older Supabase
schemas) we skip rather than fail.
"""

from __future__ import annotations

import uuid

import psycopg
import pytest

from app.config import get_settings
from app.services.user_profile import (
    add_medication,
    create_or_update_profile,
    get_profile,
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
    """Insert a minimal `auth.users` row so the FK in `profiles` can resolve."""
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
            "Skipping FK-bound profile tests."
        )
    yield user_id
    _cleanup_auth_user(user_id)


def test_profile_crud_roundtrip(synthetic_user_id: str) -> None:
    profile = create_or_update_profile(
        user_id=synthetic_user_id,
        display_name="Test User",
        allergies=["penicillin"],
        current_meds=["Aspirin"],
        age=40,
        sex="F",
        linguistic_signature="English",
    )
    assert profile.patient_id == synthetic_user_id

    loaded = get_profile(synthetic_user_id)
    assert loaded is not None
    assert loaded.display_name == "Test User"
    assert loaded.allergies == ["penicillin"]
    assert loaded.demographics.age == 40

    updated = add_medication(synthetic_user_id, "Metformin")
    assert updated is not None
    assert any("Metformin" in m for m in updated.current_meds)

    reloaded = get_profile(synthetic_user_id)
    assert reloaded is not None
    assert any("Metformin" in m for m in reloaded.current_meds)


def test_profile_upsert_replaces_fields(synthetic_user_id: str) -> None:
    create_or_update_profile(
        user_id=synthetic_user_id,
        display_name="Initial Name",
        allergies=["latex"],
        current_meds=[],
        age=30,
        sex="M",
        linguistic_signature="English",
    )
    create_or_update_profile(
        user_id=synthetic_user_id,
        display_name="Updated Name",
        allergies=[],
        current_meds=["Vitamin D"],
        age=31,
        sex="M",
        linguistic_signature="Singlish",
    )
    loaded = get_profile(synthetic_user_id)
    assert loaded is not None
    assert loaded.display_name == "Updated Name"
    assert loaded.allergies == []
    assert loaded.current_meds == ["Vitamin D"]
    assert loaded.linguistic_signature == "Singlish"
