-- 2026-10-23 win-back reactivation offers.
--
-- Applied automatically on boot by lib/db.ts runSchemaMigrations (same
-- statements, all idempotent). Kept here so the change can be reviewed or run
-- by hand before deploy:
--   psql "$DATABASE_URL" -f docs/migrations/2026-10-23-reactivation-offers.sql

-- Which kind of trial a Stripe subscription is. 'reactivation' = the 30-day
-- win-back trial, which gets full access (not the 3-session trial limits).
-- Filled from subscription metadata nura_trial_kind on every webhook sync.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_kind TEXT;

-- One row per generated link. The raw token is only in the link; this table
-- stores its SHA-256 hash. used_at set = consumed (single use).
CREATE TABLE IF NOT EXISTS reactivation_offers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  checkout_session_id TEXT,
  used_at TIMESTAMPTZ,
  new_subscription_id TEXT,
  old_subscription_id TEXT,
  old_status TEXT
);
CREATE INDEX IF NOT EXISTS idx_reactivation_offers_user
  ON reactivation_offers(user_id, created_at DESC);

-- Rollback (only before any link was used):
--   DROP TABLE IF EXISTS reactivation_offers;
--   ALTER TABLE subscriptions DROP COLUMN IF EXISTS trial_kind;
