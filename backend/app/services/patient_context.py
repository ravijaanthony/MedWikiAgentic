from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from uuid import uuid4

from app.config import get_settings
from app.state.schemas import Demographics, PatientContext


def _db_path() -> Path:
    url = get_settings().database_url
    if url.startswith("sqlite:///"):
        rel = url.replace("sqlite:///", "")
        return Path(rel)
    return Path("swaramed.db")


def init_db() -> None:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS patients (
                patient_id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                allergies TEXT NOT NULL DEFAULT '[]',
                current_meds TEXT NOT NULL DEFAULT '[]',
                demographics TEXT NOT NULL DEFAULT '{}',
                linguistic_signature TEXT NOT NULL DEFAULT 'English',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


def create_patient(
    display_name: str,
    allergies: list[str],
    current_meds: list[str],
    age: int | None,
    sex: str | None,
    linguistic_signature: str,
) -> PatientContext:
    init_db()
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
    with sqlite3.connect(_db_path()) as conn:
        conn.execute(
            """
            INSERT INTO patients (patient_id, display_name, allergies, current_meds, demographics, linguistic_signature)
            VALUES (?, ?, ?, ?, ?, ?)
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
    init_db()
    with sqlite3.connect(_db_path()) as conn:
        row = conn.execute(
            "SELECT patient_id, display_name, allergies, current_meds, demographics, linguistic_signature FROM patients WHERE patient_id = ?",
            (patient_id,),
        ).fetchone()
    if not row:
        return None
    demo_data = json.loads(row[4])
    return PatientContext(
        patient_id=row[0],
        display_name=row[1],
        allergies=json.loads(row[2]),
        current_meds=json.loads(row[3]),
        demographics=Demographics.model_validate(demo_data),
        linguistic_signature=row[5],
    )


def list_patients() -> list[PatientContext]:
    init_db()
    with sqlite3.connect(_db_path()) as conn:
        rows = conn.execute(
            "SELECT patient_id, display_name, allergies, current_meds, demographics, linguistic_signature FROM patients ORDER BY created_at DESC"
        ).fetchall()
    result = []
    for row in rows:
        result.append(
            PatientContext(
                patient_id=row[0],
                display_name=row[1],
                allergies=json.loads(row[2]),
                current_meds=json.loads(row[3]),
                demographics=Demographics.model_validate(json.loads(row[4])),
                linguistic_signature=row[5],
            )
        )
    return result


def add_medication(patient_id: str, medication: str) -> PatientContext | None:
    patient = get_patient(patient_id)
    if not patient:
        return None
    med_lower = medication.strip().lower()
    if med_lower and med_lower not in [m.lower() for m in patient.current_meds]:
        patient.current_meds.append(medication.strip())
    with sqlite3.connect(_db_path()) as conn:
        conn.execute(
            "UPDATE patients SET current_meds = ? WHERE patient_id = ?",
            (json.dumps(patient.current_meds), patient_id),
        )
        conn.commit()
    return patient
