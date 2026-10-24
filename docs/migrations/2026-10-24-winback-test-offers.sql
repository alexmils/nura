-- Test win-back links (admin "Send test email" on the single-user page).
-- A test offer never replaces, consumes or counts as the member's real link.
-- Applied automatically by ensureSchema() in lib/db.ts.
ALTER TABLE reactivation_offers ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
