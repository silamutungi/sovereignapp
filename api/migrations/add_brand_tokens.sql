-- Add brand_tokens column to builds table
-- Run in Supabase SQL Editor before deploying brand extraction feature
ALTER TABLE builds ADD COLUMN IF NOT EXISTS brand_tokens JSONB DEFAULT NULL;

-- Confirm:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'builds' AND column_name = 'brand_tokens';
-- Must return 1 row.
