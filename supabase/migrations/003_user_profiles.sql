-- 003_user_profiles.sql
-- Pivot to single-user-per-account model.
--
-- One Supabase auth user == one MedWiki patient. The `patient_id` concept
-- collapses into the user's `auth.users.id`. Existing test data is wiped.
--
-- Backend talks to Postgres as the `postgres` role (bypasses RLS). RLS here
-- is defense in depth in case the frontend ever talks to Supabase directly.

-- Idempotent: safe to re-run. Drops anything we may have created in a
-- previous attempt (including the FK-less `profiles` table the in-app
-- fallback creates if init_db() runs before this migration).
DROP TABLE IF EXISTS consultations CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS patients CASCADE;

CREATE TABLE profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    allergies JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_meds JSONB NOT NULL DEFAULT '[]'::jsonb,
    demographics JSONB NOT NULL DEFAULT '{}'::jsonb,
    linguistic_signature TEXT NOT NULL DEFAULT 'English',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE consultations (
    run_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    state JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_consultations_user_created
    ON consultations (user_id, created_at DESC);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile select"
    ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own profile insert"
    ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update"
    ON profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "own runs select"
    ON consultations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own runs insert"
    ON consultations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own runs update"
    ON consultations FOR UPDATE USING (auth.uid() = user_id);
