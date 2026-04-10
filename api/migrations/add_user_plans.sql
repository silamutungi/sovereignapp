-- Create user_plans table for plan-based quotas
-- Run in Supabase SQL Editor before deploying quota changes

CREATE TABLE IF NOT EXISTS user_plans (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL UNIQUE,
  plan       TEXT        NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;
-- No public policies — service role only

CREATE INDEX IF NOT EXISTS user_plans_email_idx ON user_plans(email);

-- Plan limits reference (enforced in API, not DB):
-- free:    1 build, 10 edits/hour per build
-- starter: 3 builds, 20 edits/hour per build
-- pro:     10 builds, 30 edits/hour per build
-- agency:  999 builds, 60 edits/hour per build

-- To manually set a user's plan:
-- INSERT INTO user_plans (email, plan) VALUES ('user@example.com', 'pro')
-- ON CONFLICT (email) DO UPDATE SET plan = 'pro', updated_at = now();
