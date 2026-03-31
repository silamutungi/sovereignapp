-- Migration: add Supabase auto-provisioning fields to builds table
-- Run in Supabase SQL Editor before deploying auto-provisioning changes.

ALTER TABLE builds ADD COLUMN IF NOT EXISTS supabase_url TEXT;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS supabase_anon_key TEXT;

-- Confirm:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'builds' AND column_name IN ('supabase_url', 'supabase_anon_key');
-- Must return 2 rows.
