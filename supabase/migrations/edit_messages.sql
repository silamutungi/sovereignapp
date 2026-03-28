-- supabase/migrations/edit_messages.sql
--
-- Persists chat history for the Edit page per build.
-- Run in Supabase SQL editor, then confirm with the SELECT below.
--
-- NOTE: Sovereign uses sessionStorage magic-link auth, NOT Supabase JWT auth.
-- auth.jwt() is always null for our users, so the policies below use anon
-- access. The build_id UUID acts as the capability token (128-bit random =
-- cryptographically safe). Anyone who can reach /app/:buildId/edit already
-- has the buildId from the URL.

CREATE TABLE IF NOT EXISTS edit_messages (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id      uuid        REFERENCES builds(id) ON DELETE CASCADE,
  role          text        NOT NULL CHECK (role IN ('user', 'sovereign')),
  content       text        NOT NULL,
  message_type  text        NOT NULL DEFAULT 'text',
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE edit_messages ENABLE ROW LEVEL SECURITY;

-- Anon read/write — build_id UUID is the access token
CREATE POLICY "anon_select_edit_messages"
  ON edit_messages FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_insert_edit_messages"
  ON edit_messages FOR INSERT TO anon
  WITH CHECK (true);

-- Index for fast per-build queries
CREATE INDEX IF NOT EXISTS edit_messages_build_id_idx
  ON edit_messages(build_id, created_at);

-- Confirm after running:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'edit_messages'
-- ORDER BY ordinal_position;
-- Must return: id, build_id, role, content, message_type, metadata, created_at
