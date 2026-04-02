-- Migration: audit_log table for Brain Audit Engine
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/gudiuktjzynkjvtqmuvi/sql/new

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id uuid REFERENCES builds(id) ON DELETE CASCADE,
  check_name text NOT NULL,
  passed boolean NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  auto_fixed boolean NOT NULL DEFAULT false,
  fix_commit text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_audit_log"
  ON audit_log FOR SELECT
  USING (
    build_id IN (
      SELECT id FROM builds WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS audit_log_build_id_idx ON audit_log(build_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);
