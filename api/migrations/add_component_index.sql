-- Component Index table — maps every visible UI component to file coordinates.
-- Used by Brain to improve edit accuracy.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS component_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id uuid REFERENCES builds(id) ON DELETE CASCADE,
  name text NOT NULL,
  file text NOT NULL,
  line_start integer,
  line_end integer,
  type text,
  description text,
  props jsonb DEFAULT '[]',
  visible_text jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_component_index_build_id
  ON component_index(build_id);

ALTER TABLE component_index ENABLE ROW LEVEL SECURITY;
-- Service role only — no public policies needed.
