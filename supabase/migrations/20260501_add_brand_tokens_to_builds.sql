-- Add brand_tokens jsonb column to builds table
-- Required by api/start-build.ts (insert) and the multi-source brand
-- extraction pipeline (URL / Figma / logo / PDF / screenshot) in
-- api/extract-brand.ts.
--
-- Production was returning PGRST204 ("Could not find the 'brand_tokens'
-- column of 'builds' in the schema cache") because the column was
-- referenced in code but never applied to the schema.

ALTER TABLE builds ADD COLUMN IF NOT EXISTS brand_tokens JSONB DEFAULT NULL;

-- Force PostgREST schema cache reload so the REST API picks up the new
-- column immediately (without this, PGRST204 can persist for ~10 min).
NOTIFY pgrst, 'reload schema';

-- Verify:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'builds' AND column_name = 'brand_tokens';
-- Must return exactly 1 row: brand_tokens, jsonb.
