-- 2026-10-23: closure card start values (SUDs / VoC) per guided thread.
-- Additive and nullable. The app runs the same statements on boot in
-- lib/db.ts runSchemaMigrations (ADD COLUMN IF NOT EXISTS), so a deploy applies
-- it automatically; this file is the reviewable record / manual path.
ALTER TABLE threads ADD COLUMN IF NOT EXISTS baseline_suds INTEGER;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS baseline_voc INTEGER;

-- Rollback (safe, data is display-only):
-- ALTER TABLE threads DROP COLUMN IF EXISTS baseline_suds;
-- ALTER TABLE threads DROP COLUMN IF EXISTS baseline_voc;
