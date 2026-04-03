-- Add audit_top_fixes column and convert audit_flags to jsonb
-- Run in Supabase SQL Editor.

-- audit_top_fixes: top 3 most impactful fixes as a JSON array of strings
ALTER TABLE builds ADD COLUMN IF NOT EXISTS audit_top_fixes jsonb;

-- audit_flags was text, needs to be jsonb for structured breakdown
-- Drop default first if any, then alter type
ALTER TABLE builds ALTER COLUMN audit_flags DROP DEFAULT;
ALTER TABLE builds ALTER COLUMN audit_flags TYPE jsonb USING audit_flags::jsonb;
