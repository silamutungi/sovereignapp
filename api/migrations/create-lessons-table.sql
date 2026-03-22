-- api/migrations/create-lessons-table.sql
--
-- Lessons knowledge base: every build failure and founder note that improves
-- future builds. Run in Supabase SQL Editor.
--
-- Confirm after: SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name = 'lessons';

CREATE TABLE IF NOT EXISTS lessons (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category            text        NOT NULL, -- 'generation', 'deployment', 'oauth', 'database', 'env_vars', 'ux', 'stack'
  source              text        NOT NULL, -- 'build_failure', 'user_edit', 'founder_note', 'automatic'
  problem             text        NOT NULL,
  solution            text        NOT NULL,
  applied_automatically boolean   DEFAULT false,
  build_count         integer     DEFAULT 0,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can read lessons with a solution (knowledge base)
CREATE POLICY IF NOT EXISTS "public_read_lessons"
ON lessons FOR SELECT
TO anon
USING (solution != '');

-- No public insert/update — service role only
-- All writes go through api/ routes using the service role key.

CREATE INDEX IF NOT EXISTS lessons_category_idx  ON lessons(category);
CREATE INDEX IF NOT EXISTS lessons_source_idx    ON lessons(source);
CREATE INDEX IF NOT EXISTS lessons_build_count_idx ON lessons(build_count DESC);
