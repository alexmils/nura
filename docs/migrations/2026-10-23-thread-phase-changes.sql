-- 2026-10-23: phase timeline for the guided chat (transcript phase badges).
-- One row per protocol phase change, written by lib/db.ts updateThread when
-- threads.phase changes. Anchored to the thread's latest message at that time
-- (after_message_id) plus the message count as a fallback position.
-- Additive. The app runs the same statements on boot in lib/db.ts
-- runSchemaMigrations, and the RLS policy in lib/rls-policies.ts, so a deploy
-- applies it automatically; this file is the reviewable record / manual path.
-- No backfill: older threads show the opening badge + the current phase.
CREATE TABLE IF NOT EXISTS thread_phase_changes (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  after_message_id TEXT,
  message_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_thread_phase_changes_thread
  ON thread_phase_changes(thread_id, created_at);

-- Owner-only, same shape as messages_all.
ALTER TABLE thread_phase_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS thread_phase_changes_all ON thread_phase_changes;
CREATE POLICY thread_phase_changes_all ON thread_phase_changes FOR ALL USING (
  EXISTS (
    SELECT 1 FROM threads t
    WHERE t.id = thread_phase_changes.thread_id AND t.user_id = app_current_user_id()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM threads t
    WHERE t.id = thread_phase_changes.thread_id AND t.user_id = app_current_user_id()
  )
);

-- Rollback (safe, data is display-only):
-- DROP TABLE IF EXISTS thread_phase_changes;
