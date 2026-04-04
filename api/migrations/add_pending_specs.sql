-- Pending specs table — decouples generation from browser connection
-- Run in Supabase SQL Editor before deploying polling architecture

CREATE TABLE IF NOT EXISTS pending_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spec jsonb NOT NULL,
  status text NOT NULL DEFAULT 'generating',
  error text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_pending_specs_expires
  ON pending_specs(expires_at);

ALTER TABLE pending_specs ENABLE ROW LEVEL SECURITY;
-- Service role only — no public policies
