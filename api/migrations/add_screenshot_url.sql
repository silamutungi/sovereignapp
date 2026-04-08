-- Run in Supabase SQL Editor
-- Adds screenshot_url column to builds table

ALTER TABLE builds ADD COLUMN IF NOT EXISTS screenshot_url text;
