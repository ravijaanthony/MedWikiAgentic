"""User profile persistence (one profile per Supabase auth user).

Replaces the older `patient_context` module. The `user_id` here is the UUID
from Supabase's `auth.users.id`. We surface profile data to the rest of the
pipeline as the existing `PatientContext` model so the LangGraph state schema
does not need to change — `PatientContext.patient_id` simply holds the
authenticated user's UUID.
"""

from __future__ import annotations

import psycopg
from psycopg.rows import tuple_row
from psycopg.types.json import Jsonb

from app.config import get_settings
from app.state.schemas import Demographics, PatientContext

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY,
    display_name TEXT NOT NULL,
    allergies JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_meds JSONB NOT NULL DEFAULT '[]'::jsonb,
    demographics JSONB NOT NULL DEFAULT '{}'::jsonb,
    linguistic_signature TEXT NOT NULL DEFAULT 'English',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""


def _connect() -> psycopg.Connection:
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(url, row_factory=tuple_row)


def init_db() -> None:
    """Idempotent table-create. The canonical schema is in
    `supabase/migrations/003_user_profiles.sql` (which also wires up the FK to
    `auth.users` and RLS). This is the in-app fallback for first boot against
    a fresh database.
    """
    with _connect() as conn:
        conn.execute(_CREATE_TABLE_SQL)
        conn.commit()


def _row_to_profile(row: tuple) -> PatientContext:
    return PatientContext(
        patient_id=str(row[0]),
        display_name=row[1],
        allergies=row[2] or [],
        current_meds=row[3] or [],
        demographics=Demographics.model_validate(row[4] or {}),
        linguistic_signature=row[5],
    )


def create_or_update_profile(
    user_id: str,
    display_name: str,
    allergies: list[str],
    current_meds: list[str],
    age: int | None,
    sex: str | None,
    linguistic_signature: str,
) -> PatientContext:
    demo = Demographics(age=age, sex=sex)
    sql = """
    INSERT INTO profiles (
        user_id, display_name, allergies, current_meds,
        demographics, linguistic_signature, updated_at
    )
    VALUES (%s, %s, %s, %s, %s, %s, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        display_name         = EXCLUDED.display_name,
        allergies            = EXCLUDED.allergies,
        current_meds         = EXCLUDED.current_meds,
        demographics         = EXCLUDED.demographics,
        linguistic_signature = EXCLUDED.linguistic_signature,
        updated_at           = NOW()
    """
    with _connect() as conn:
        conn.execute(
            sql,
            (
                user_id,
                display_name,
                Jsonb(allergies),
                Jsonb(current_meds),
                Jsonb(demo.model_dump()),
                linguistic_signature,
            ),
        )
        conn.commit()
    return PatientContext(
        patient_id=user_id,
        display_name=display_name,
        allergies=allergies,
        current_meds=current_meds,
        demographics=demo,
        linguistic_signature=linguistic_signature,
    )


def get_profile(user_id: str) -> PatientContext | None:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT user_id, display_name, allergies, current_meds,
                   demographics, linguistic_signature
            FROM profiles WHERE user_id = %s
            """,
            (user_id,),
        ).fetchone()
    return _row_to_profile(row) if row else None


def add_medication(user_id: str, medication: str) -> PatientContext | None:
    profile = get_profile(user_id)
    if not profile:
        return None
    med_clean = medication.strip()
    if not med_clean:
        return profile
    if med_clean.lower() not in [m.lower() for m in profile.current_meds]:
        profile.current_meds.append(med_clean)
    with _connect() as conn:
        conn.execute(
            "UPDATE profiles SET current_meds = %s, updated_at = NOW() WHERE user_id = %s",
            (Jsonb(profile.current_meds), user_id),
        )
        conn.commit()
    return profile
