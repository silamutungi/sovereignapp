-- Try Mode columns for builds table
-- Run in Supabase SQL Editor before deploying try mode feature

ALTER TABLE builds
ADD COLUMN IF NOT EXISTS try_mode boolean DEFAULT true;

ALTER TABLE builds
ADD COLUMN IF NOT EXISTS expires_at timestamptz
DEFAULT (now() + interval '7 days');

-- claimed_at may already exist from earlier migrations; safe to re-run
ALTER TABLE builds
ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Existing builds are owned (not try mode)
UPDATE builds SET try_mode = false
WHERE try_mode IS NULL;
