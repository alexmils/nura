-- 2026-10-24: dissociation screening level per guided thread
-- ("screening" | "cautious" | "severe", NULL = nothing flagged).
-- Additive and nullable. The app runs the same statement on boot in
-- lib/db.ts runSchemaMigrations (ADD COLUMN IF NOT EXISTS), so a deploy applies
-- it automatically; this file is the reviewable record / manual path.
ALTER TABLE threads ADD COLUMN IF NOT EXISTS dissociation TEXT;

-- Rollback (loses the per-thread safety flag):
-- ALTER TABLE threads DROP COLUMN IF EXISTS dissociation;
