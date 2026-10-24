-- 2026-10-24 problem reports (app malfunctions told to the AI guide).
--
-- Applied automatically on boot by lib/db.ts runSchemaMigrations (same
-- statements, all idempotent). Kept here so the change can be reviewed or run
-- by hand before deploy:
--   psql "$DATABASE_URL" -f docs/migrations/2026-10-24-problem-reports.sql

-- One row per report. Same user + same session within 6 hours merges into
-- the open report (hit_count + excerpt). events is the admin timeline:
-- [{ type, at, by, detail }]. The win-back email snapshot has the link token
-- redacted (reactivation_offers keeps only its hash).
CREATE TABLE IF NOT EXISTS problem_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id TEXT REFERENCES threads(id) ON DELETE SET NULL,
  excerpt TEXT NOT NULL,
  category TEXT NOT NULL,
  language TEXT,
  hit_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'confirmed', 'dismissed', 'winback_sent')),
  admin_note TEXT,
  reactivation_offer_id TEXT REFERENCES reactivation_offers(id) ON DELETE SET NULL,
  emailed_admin_at TIMESTAMPTZ,
  winback_email_sent_at TIMESTAMPTZ,
  winback_email_to TEXT,
  winback_email_subject TEXT,
  winback_email_body TEXT,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_problem_reports_user_thread
  ON problem_reports(user_id, thread_id, last_detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_problem_reports_recent
  ON problem_reports(last_detected_at DESC);

-- Rollback:
--   DROP TABLE IF EXISTS problem_reports;
