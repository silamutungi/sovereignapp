-- App Manifest — visila.json substrate
-- Run in Supabase SQL Editor before deploying api/lib/generateManifest.ts wiring.
-- Adds three columns to the builds table that mirror the visila.json file
-- committed alongside generated app code.

ALTER TABLE builds
  ADD COLUMN IF NOT EXISTS app_manifest        jsonb,
  ADD COLUMN IF NOT EXISTS completeness_score  integer,
  ADD COLUMN IF NOT EXISTS completeness_gaps   text[];

-- Verify (must return 3 rows):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'builds'
--   AND column_name IN ('app_manifest', 'completeness_score', 'completeness_gaps');
