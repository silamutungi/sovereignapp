-- App Topology Graph — page nodes + navigation edges + orphan detection
-- Run in Supabase SQL Editor before deploying api/lib/buildTopology.ts wiring.
-- The other manifest columns (app_manifest, completeness_score, completeness_gaps)
-- were added in api/migrations/add_app_manifest.sql — only adding the new one here.

ALTER TABLE builds
  ADD COLUMN IF NOT EXISTS app_topology jsonb;

-- Verify (must return 1 row):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'builds' AND column_name = 'app_topology';
