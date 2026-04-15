-- Brain 2.5 — Structural Recommendations
-- Run in Supabase SQL Editor before deploying api/lib/structuralRecommendations.ts wiring.
-- Stores the full RecommendationReport (priority, category, title, description,
-- editInstruction, effort) per build. Overwritten on every audit.

ALTER TABLE builds
  ADD COLUMN IF NOT EXISTS structural_recommendations jsonb;

-- Verify (must return 1 row):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'builds' AND column_name = 'structural_recommendations';
