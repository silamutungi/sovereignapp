-- Add confidence and validation_results columns to edit_messages
-- Supports the proactive edit engine's self-validation pipeline (Prompt B)
--
-- confidence: "high" | "medium" | "low" — Sonnet's self-assessed confidence
-- validation_results: JSON array of { check, passed, note } from the validation checklist

ALTER TABLE edit_messages
ADD COLUMN IF NOT EXISTS confidence text,
ADD COLUMN IF NOT EXISTS validation_results jsonb;

-- Verify columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'edit_messages'
AND column_name IN ('confidence', 'validation_results');
-- Expected: 2 rows
