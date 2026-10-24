-- Win-back on the admin single-user page + help chat problem reports.
-- Idempotent; lib/db.ts runs the same statements at startup.

-- Where a problem report came from.
ALTER TABLE problem_reports ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'guide_session';
DO $$ BEGIN
  ALTER TABLE problem_reports ADD CONSTRAINT problem_reports_source_check
    CHECK (source IN ('guide_session', 'help_chat', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Help chat thread (help_threads.id) for source = 'help_chat'.
ALTER TABLE problem_reports ADD COLUMN IF NOT EXISTS help_thread_id TEXT;
CREATE INDEX IF NOT EXISTS idx_problem_reports_user_source
  ON problem_reports(user_id, source, last_detected_at DESC);

-- Who minted a win-back link: 'winback_tab' | 'problem_report' | 'admin_user' (NULL = older links).
ALTER TABLE reactivation_offers ADD COLUMN IF NOT EXISTS source TEXT;

-- Win-back emails that went out (token redacted), one per link.
CREATE TABLE IF NOT EXISTS winback_emails (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id TEXT,
  problem_report_id TEXT REFERENCES problem_reports(id) ON DELETE SET NULL,
  mode TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_winback_emails_offer ON winback_emails(offer_id);
CREATE INDEX IF NOT EXISTS idx_winback_emails_user ON winback_emails(user_id, sent_at DESC);
