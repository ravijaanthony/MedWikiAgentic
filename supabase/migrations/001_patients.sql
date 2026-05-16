-- Run in Supabase SQL editor (Dashboard -> SQL -> New query)
CREATE TABLE IF NOT EXISTS patients (
    patient_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    allergies TEXT NOT NULL DEFAULT '[]',
    current_meds TEXT NOT NULL DEFAULT '[]',
    demographics TEXT NOT NULL DEFAULT '{}',
    linguistic_signature TEXT NOT NULL DEFAULT 'English',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients (created_at DESC);
