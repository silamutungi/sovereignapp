-- api/migrations/ensure-schema.sql
--
-- Safe, idempotent migration — adds all columns and tables that may be missing.
-- Uses IF NOT EXISTS throughout — safe to run multiple times.
-- Run in Supabase SQL Editor after verify-schema.sql shows any MISSING status.
--
-- Confirm after: run verify-schema.sql — every row should return 'EXISTS'.

-- ── builds table — all required columns ─────────────────────────────────────

-- Supabase OAuth token stored after user connects their own Supabase account
ALTER TABLE builds ADD COLUMN IF NOT EXISTS supabase_token TEXT DEFAULT NULL;

-- True while the build is on Sovereign-hosted infrastructure (before user claims it)
ALTER TABLE builds ADD COLUMN IF NOT EXISTS staging BOOLEAN DEFAULT true;

-- Absolute expiry timestamp — default 7 days from creation
ALTER TABLE builds ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days');

-- Set when the user completes the claim flow (transfers ownership)
ALTER TABLE builds ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ DEFAULT NULL;

-- The Supabase project ref provisioned for this build (e.g. "abcdefghij")
ALTER TABLE builds ADD COLUMN IF NOT EXISTS supabase_project_ref TEXT DEFAULT NULL;

-- Soft delete timestamp — set instead of hard delete to preserve audit trail
ALTER TABLE builds ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Array of next-step recommendations returned by the generation prompt
ALTER TABLE builds ADD COLUMN IF NOT EXISTS next_steps JSONB DEFAULT NULL;

-- Supabase provisioning mode: 'sovereign' | 'sovereign_temporary' | 'own'
-- sovereign_temporary = user chose own Supabase but we used Sovereign's temporarily (pending claim flow)
-- own = fully migrated to user's own Supabase project
ALTER TABLE builds ADD COLUMN IF NOT EXISTS supabase_mode TEXT DEFAULT 'sovereign';

-- Checkpoint array for retry-from-failure — tracks which major steps completed
-- Values: 'github', 'vercel', 'database', 'files'
ALTER TABLE builds ADD COLUMN IF NOT EXISTS completed_steps JSONB DEFAULT '[]';

-- Vercel project ID for the staging deployment — stored so retries can skip project creation
ALTER TABLE builds ADD COLUMN IF NOT EXISTS vercel_project_id TEXT DEFAULT NULL;

-- ── magic_links table — create if missing ───────────────────────────────────
-- Required for magic link authentication flow.

CREATE TABLE IF NOT EXISTS magic_links (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  token      TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS magic_links_token_idx ON magic_links(token);
CREATE INDEX IF NOT EXISTS magic_links_email_idx ON magic_links(email);

-- ── lessons table — create if missing ───────────────────────────────────────
-- Knowledge base: auto-captured build failures + seeded founder notes.

CREATE TABLE IF NOT EXISTS lessons (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category              TEXT        NOT NULL,
  source                TEXT        NOT NULL,
  problem               TEXT        NOT NULL,
  solution              TEXT        NOT NULL DEFAULT '',
  applied_automatically BOOLEAN     DEFAULT false,
  build_count           INTEGER     DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "public_read_lessons"
ON lessons FOR SELECT TO anon
USING (solution != '');

CREATE INDEX IF NOT EXISTS lessons_category_idx    ON lessons(category);
CREATE INDEX IF NOT EXISTS lessons_source_idx      ON lessons(source);
CREATE INDEX IF NOT EXISTS lessons_build_count_idx ON lessons(build_count DESC);

-- Sovereign Standards confidence score (0–100) calculated from generated files
ALTER TABLE builds ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT NULL;

-- Whether the app passed the launch gate (security OK + score >= 60)
ALTER TABLE builds ADD COLUMN IF NOT EXISTS launch_gate_passed BOOLEAN DEFAULT NULL;

-- ── RLS policies — ensures all tables are locked down ───────────────────────

ALTER TABLE builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Waitlist: allow anon insert (the join waitlist flow), no public read
CREATE POLICY IF NOT EXISTS "anon_insert_waitlist"
ON waitlist FOR INSERT TO anon
WITH CHECK (true);

-- Confirm after:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'builds'
-- ORDER BY ordinal_position;
