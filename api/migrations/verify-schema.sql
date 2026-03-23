-- api/migrations/verify-schema.sql
--
-- Run in Supabase SQL Editor to check whether all required columns exist.
-- Each query returns 'EXISTS' or 'MISSING' — no row returned means the table itself is missing.
-- If any column returns 'MISSING', run ensure-schema.sql to add it safely.

-- ── builds table columns ────────────────────────────────────────────────────

SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'builds' AND column_name = 'supabase_token'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS supabase_token_status;

SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'builds' AND column_name = 'staging'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS staging_status;

SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'builds' AND column_name = 'expires_at'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS expires_at_status;

SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'builds' AND column_name = 'claimed_at'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS claimed_at_status;

SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'builds' AND column_name = 'supabase_project_ref'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS supabase_project_ref_status;

SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'builds' AND column_name = 'deleted_at'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS deleted_at_status;

SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'builds' AND column_name = 'next_steps'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS next_steps_status;

-- ── required tables ─────────────────────────────────────────────────────────

SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'builds'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS builds_table_status;

SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'waitlist'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS waitlist_table_status;

SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'magic_links'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS magic_links_table_status;

SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lessons'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS lessons_table_status;
