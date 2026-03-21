-- magic_links table for dashboard authentication
-- Run this in the Supabase SQL editor if the table does not exist.
-- Confirm after: SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name = 'magic_links';

CREATE TABLE IF NOT EXISTS magic_links (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  token      TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;
-- No public policies — service role key bypasses RLS automatically.

CREATE INDEX IF NOT EXISTS magic_links_token_idx ON magic_links(token);
CREATE INDEX IF NOT EXISTS magic_links_email_idx ON magic_links(email);
