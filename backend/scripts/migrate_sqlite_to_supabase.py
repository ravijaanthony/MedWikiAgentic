#!/usr/bin/env python3
"""One-time migration: copy patients from local swaramed.db into Supabase Postgres."""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

import psycopg

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_ROOT))

from app.config import get_settings  # noqa: E402


def main() -> None:
    sqlite_path = _BACKEND_ROOT / "swaramed.db"
    if not sqlite_path.exists():
        print(f"No SQLite database at {sqlite_path}; nothing to migrate.")
        return

    settings = get_settings()
    url = settings.database_url
    if not url.startswith(("postgresql://", "postgres://")):
        print("DATABASE_URL must be a PostgreSQL connection string (Supabase) to migrate into.")
        sys.exit(1)

    with sqlite3.connect(sqlite_path) as src:
        rows = src.execute(
            "SELECT patient_id, display_name, allergies, current_meds, demographics, linguistic_signature, created_at FROM patients"
        ).fetchall()

    if not rows:
        print("SQLite patients table is empty; nothing to migrate.")
        return

    with psycopg.connect(url) as conn:
        for row in rows:
            conn.execute(
                """
                INSERT INTO patients (patient_id, display_name, allergies, current_meds, demographics, linguistic_signature, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s::timestamptz)
                ON CONFLICT (patient_id) DO NOTHING
                """,
                row,
            )
        conn.commit()

    print(f"Migrated {len(rows)} patient(s) to Supabase.")


if __name__ == "__main__":
    main()
