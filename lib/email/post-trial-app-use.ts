/**
 * The post-trial anchor, kept apart from the sender.
 *
 * `/api/auth/access` runs on every app navigation; importing the module that
 * opens a mail provider just to write one timestamp would drag the whole email
 * stack into that route's server bundle. This module touches the database only.
 */

import { ensureSchemaReady, getPool } from "@/lib/db";

/** Record the first app use after the trial. Idempotent and cheap after the first hit. */
export async function markPostTrialAppUse(userId: string): Promise<void> {
  await ensureSchemaReady();
  await getPool().query(
    `UPDATE users
     SET post_trial_seen_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND post_trial_seen_at IS NULL`,
    [userId]
  );
}
