from __future__ import annotations

import json
from uuid import uuid4

import psycopg
from psycopg.rows import tuple_row

from app.config import get_settings
from app.state.schemas import Demographics, PatientContext

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS patients (
    patient_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    allergies TEXT NOT NULL DEFAULT '[]',
    current_meds TEXT NOT NULL DEFAULT '[]',
    demographics TEXT NOT NULL DEFAULT '{}',
    linguistic_signature TEXT NOT NULL DEFAULT 'English',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

_CREATE_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients (created_at DESC)
"""


def _connect() -> psycopg.Connection:
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(url, row_factory=tuple_row)


def init_db() -> None:
    with _connect() as conn:
        conn.execute(_CREATE_TABLE_SQL)
        conn.execute(_CREATE_INDEX_SQL)
        conn.commit()


def _row_to_patient(row: tuple) -> PatientContext:
    demo_data = json.loads(row[4])
    return PatientContext(
        patient_id=row[0],
        display_name=row[1],
        allergies=json.loads(row[2]),
        current_meds=json.loads(row[3]),
        demographics=Demographics.model_validate(demo_data),
        linguistic_signature=row[5],
    )


def create_patient(
    display_name: str,
    allergies: list[str],
    current_meds: list[str],
    age: int | None,
    sex: str | None,
    linguistic_signature: str,
) -> PatientContext:
    patient_id = str(uuid4())
    demo = Demographics(age=age, sex=sex)
    ctx = PatientContext(
        patient_id=patient_id,
        display_name=display_name,
        allergies=allergies,
        current_meds=current_meds,
        demographics=demo,
        linguistic_signature=linguistic_signature,
    )
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO patients (patient_id, display_name, allergies, current_meds, demographics, linguistic_signature)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                patient_id,
                display_name,
                json.dumps(allergies),
                json.dumps(current_meds),
                json.dumps(demo.model_dump()),
                linguistic_signature,
            ),
        )
        conn.commit()
    return ctx


def get_patient(patient_id: str) -> PatientContext | None:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT patient_id, display_name, allergies, current_meds, demographics, linguistic_signature
            FROM patients WHERE patient_id = %s
            """,
            (patient_id,),
        ).fetchone()
    if not row:
        return None
    return _row_to_patient(row)


def list_patients() -> list[PatientContext]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT patient_id, display_name, allergies, current_meds, demographics, linguistic_signature
            FROM patients ORDER BY created_at DESC
            """
        ).fetchall()
    return [_row_to_patient(row) for row in rows]


def add_medication(patient_id: str, medication: str) -> PatientContext | None:
    patient = get_patient(patient_id)
    if not patient:
        return None
    med_lower = medication.strip().lower()
    if med_lower and med_lower not in [m.lower() for m in patient.current_meds]:
        patient.current_meds.append(medication.strip())
    with _connect() as conn:
        conn.execute(
            "UPDATE patients SET current_meds = %s WHERE patient_id = %s",
            (json.dumps(patient.current_meds), patient_id),
        )
        conn.commit()
    return patient
