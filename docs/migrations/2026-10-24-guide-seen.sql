-- 2026-10-24: remember a dismissed product tour per account.
-- Additive and nullable. lib/db.ts applies the same statement on boot
-- (ADD COLUMN IF NOT EXISTS), so a deploy handles it automatically; this file
-- is the reviewable record / manual path.
ALTER TABLE users ADD COLUMN IF NOT EXISTS guide_seen_at TIMESTAMPTZ;

-- Rollback (safe, only re-enables the tour):
-- ALTER TABLE users DROP COLUMN IF EXISTS guide_seen_at;
