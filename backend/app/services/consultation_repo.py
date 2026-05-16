from __future__ import annotations

import logging

import psycopg
from psycopg.rows import tuple_row
from psycopg.types.json import Jsonb

from app.config import get_settings

_logger = logging.getLogger(__name__)

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS consultations (
    run_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    state JSONB NOT NULL DEFAULT '{}'::jsonb
)
"""

_CREATE_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_consultations_patient_created
    ON consultations (patient_id, created_at DESC)
"""


def _connect() -> psycopg.Connection:
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(url, row_factory=tuple_row)


def init_consultations_db() -> None:
    with _connect() as conn:
        conn.execute(_CREATE_TABLE_SQL)
        conn.execute(_CREATE_INDEX_SQL)
        conn.commit()


def _strip_for_storage(state: dict) -> dict:
    return {k: v for k, v in state.items() if k != "audio_bytes"}


def upsert_consultation(
    run_id: str,
    patient_id: str,
    status: str,
    state: dict,
    completed: bool = False,
) -> None:
    """Insert or update a consultation row. Failures are logged, not raised,
    so a DB hiccup never breaks the live consultation pipeline.
    """
    payload = _strip_for_storage(state)
    sql = """
    INSERT INTO consultations (run_id, patient_id, status, state, completed_at)
    VALUES (%s, %s, %s, %s, CASE WHEN %s THEN NOW() ELSE NULL END)
    ON CONFLICT (run_id) DO UPDATE SET
        status = EXCLUDED.status,
        state = EXCLUDED.state,
        completed_at = CASE WHEN %s THEN NOW() ELSE consultations.completed_at END
    """
    try:
        with _connect() as conn:
            conn.execute(sql, (run_id, patient_id, status, Jsonb(payload), completed, completed))
            conn.commit()
    except Exception as exc:
        _logger.warning("Failed to persist consultation %s: %s", run_id, exc)


def get_consultation(run_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT run_id, patient_id, status, created_at, completed_at, state
            FROM consultations WHERE run_id = %s
            """,
            (run_id,),
        ).fetchone()
    if not row:
        return None
    return {
        "run_id": row[0],
        "patient_id": row[1],
        "status": row[2],
        "created_at": row[3].isoformat() if row[3] else None,
        "completed_at": row[4].isoformat() if row[4] else None,
        "state": row[5] or {},
    }


def list_consultations_for_patient(patient_id: str, limit: int = 20) -> list[dict]:
    sql = """
    SELECT
        run_id,
        status,
        created_at,
        completed_at,
        state->'integrity_report'->>'passed' AS integrity_passed,
        jsonb_array_length(COALESCE(state->'warnings', '[]'::jsonb)) AS warning_count,
        COALESCE(state->>'ground_truth_transcript', state->>'raw_transcript', '') AS transcript_preview
    FROM consultations
    WHERE patient_id = %s
    ORDER BY created_at DESC
    LIMIT %s
    """
    with _connect() as conn:
        rows = conn.execute(sql, (patient_id, limit)).fetchall()
    summaries = []
    for r in rows:
        preview = (r[6] or "")[:120]
        summaries.append(
            {
                "run_id": r[0],
                "status": r[1],
                "created_at": r[2].isoformat() if r[2] else None,
                "completed_at": r[3].isoformat() if r[3] else None,
                "integrity_passed": (r[4] == "true") if r[4] is not None else None,
                "warning_count": r[5] or 0,
                "transcript_preview": preview,
            }
        )
    return summaries
