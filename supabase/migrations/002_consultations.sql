-- Run in Supabase SQL editor (Dashboard -> SQL -> New query)
-- Persists consultation runs per patient. The full graph state lives in JSONB.
CREATE TABLE IF NOT EXISTS consultations (
    run_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    state JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_consultations_patient_created
    ON consultations (patient_id, created_at DESC);
