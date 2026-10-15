import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  canSubmitFeedback,
  userHasQualifyingSession,
} from "@/lib/feedback-eligibility";
import {
  type FeedbackSource,
  resolveFeedbackSubmitSource,
  shouldOfferPrompt,
  snoozeUntilIso,
} from "@/lib/feedback";

export type FeedbackPromptState = {
  userId: string;
  snoozeUntil: string | null;
  pendingSource: FeedbackSource | null;
  forceShow: boolean;
  lastShownAt: string | null;
  updatedAt: string;
};

export type FeedbackResponse = {
  id: string;
  userId: string;
  score: number;
  comment: string | null;
  source: FeedbackSource;
  adminSeenAt: string | null;
  createdAt: string;
  userEmail?: string;
  userName?: string | null;
};

let feedbackSchemaDone = false;

function parseSource(value: unknown): FeedbackSource | null {
  if (
    value === "session_end" ||
    value === "days_elapsed" ||
    value === "forced" ||
    value === "trial_end_email" ||
    value === "page"
  ) {
    return value;
  }
  return null;
}

export async function ensureFeedbackSchema(): Promise<void> {
  await ensureSchemaReady();
  if (feedbackSchemaDone) return;
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS feedback_responses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
      comment TEXT,
      source TEXT NOT NULL,
      admin_seen_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_responses_created
      ON feedback_responses(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_feedback_responses_user
      ON feedback_responses(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_feedback_responses_unread
      ON feedback_responses(admin_seen_at, created_at DESC);

    CREATE TABLE IF NOT EXISTS feedback_prompt_state (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      snooze_until TIMESTAMPTZ,
      pending_source TEXT,
      force_show BOOLEAN NOT NULL DEFAULT FALSE,
      last_shown_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  feedbackSchemaDone = true;
}

async function getPromptState(
  userId: string
): Promise<FeedbackPromptState | null> {
  await ensureFeedbackSchema();
  const { rows } = await getPool().query(
    `SELECT user_id, snooze_until, pending_source, force_show, last_shown_at, updated_at
     FROM feedback_prompt_state WHERE user_id = $1`,
    [userId]
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    userId: row.user_id as string,
    snoozeUntil: row.snooze_until
      ? new Date(row.snooze_until as string).toISOString()
      : null,
    pendingSource: parseSource(row.pending_source),
    forceShow: Boolean(row.force_show),
    lastShownAt: row.last_shown_at
      ? new Date(row.last_shown_at as string).toISOString()
      : null,
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

async function upsertPromptState(
  userId: string,
  patch: {
    snoozeUntil?: string | null;
    pendingSource?: FeedbackSource | null;
    forceShow?: boolean;
    lastShownAt?: string | null;
  }
): Promise<FeedbackPromptState> {
  await ensureFeedbackSchema();
  const current = await getPromptState(userId);
  const snoozeUntil =
    patch.snoozeUntil !== undefined
      ? patch.snoozeUntil
      : (current?.snoozeUntil ?? null);
  const pendingSource =
    patch.pendingSource !== undefined
      ? patch.pendingSource
      : (current?.pendingSource ?? null);
  const forceShow =
    patch.forceShow !== undefined
      ? patch.forceShow
      : (current?.forceShow ?? false);
  const lastShownAt =
    patch.lastShownAt !== undefined
      ? patch.lastShownAt
      : (current?.lastShownAt ?? null);

  await getPool().query(
    `INSERT INTO feedback_prompt_state
       (user_id, snooze_until, pending_source, force_show, last_shown_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       snooze_until = EXCLUDED.snooze_until,
       pending_source = EXCLUDED.pending_source,
       force_show = EXCLUDED.force_show,
       last_shown_at = EXCLUDED.last_shown_at,
       updated_at = NOW()`,
    [userId, snoozeUntil, pendingSource, forceShow, lastShownAt]
  );
  const next = await getPromptState(userId);
  if (!next) throw new Error("feedback_prompt_state missing after upsert");
  return next;
}

export async function userHasSubmittedFeedback(userId: string): Promise<boolean> {
  await ensureFeedbackSchema();
  const { rows } = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM feedback_responses WHERE user_id = $1`,
    [userId]
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function getFeedbackPromptForUser(input: {
  userId: string;
  userCreatedAt: string;
}): Promise<{ show: boolean; source: FeedbackSource | null }> {
  const [hasResponse, state, hasQualifyingSession] = await Promise.all([
    userHasSubmittedFeedback(input.userId),
    getPromptState(input.userId),
    userHasQualifyingSession(input.userId),
  ]);

  return shouldOfferPrompt({
    hasResponse,
    forceShow: state?.forceShow ?? false,
    snoozeUntil: state?.snoozeUntil ?? null,
    pendingSource: state?.pendingSource ?? null,
    userCreatedAt: input.userCreatedAt,
    hasQualifyingSession,
  });
}

export async function getFeedbackPageState(input: {
  userId: string;
  userCreatedAt: string;
  allowTrialLink: boolean;
}) {
  const [hasResponse, hasQualifyingSession] = await Promise.all([
    userHasSubmittedFeedback(input.userId),
    userHasQualifyingSession(input.userId),
  ]);
  return canSubmitFeedback({
    hasResponse,
    hasQualifyingSession,
    userCreatedAt: input.userCreatedAt,
    allowTrialLink: input.allowTrialLink,
  });
}

/** Session closure no longer opens the in-app NPS popup. */
export async function markFeedbackSessionEnd(
  _userId: string
): Promise<{ show: boolean; source: FeedbackSource | null }> {
  return { show: false, source: null };
}

export async function snoozeFeedbackPrompt(userId: string): Promise<void> {
  await upsertPromptState(userId, {
    snoozeUntil: snoozeUntilIso(),
    forceShow: false,
  });
}

export async function recordFeedbackShown(userId: string): Promise<void> {
  await upsertPromptState(userId, {
    lastShownAt: new Date().toISOString(),
  });
}

export async function submitFeedbackResponse(input: {
  userId: string;
  userCreatedAt: string;
  score: number;
  comment?: string | null;
  sourceOverride?: FeedbackSource | null;
  allowTrialLink?: boolean;
}): Promise<
  | { ok: true; feedback: FeedbackResponse }
  | { ok: false; error: "already_submitted" | "not_eligible" }
> {
  await ensureFeedbackSchema();
  const [hasResponse, state, hasQualifyingSession] = await Promise.all([
    userHasSubmittedFeedback(input.userId),
    getPromptState(input.userId),
    userHasQualifyingSession(input.userId),
  ]);
  if (hasResponse && !state?.forceShow) {
    return { ok: false, error: "already_submitted" };
  }

  const pageState = canSubmitFeedback({
    hasResponse: false,
    hasQualifyingSession,
    userCreatedAt: input.userCreatedAt,
    allowTrialLink: Boolean(input.allowTrialLink),
  });
  const forced = state?.forceShow ?? false;
  if (!forced && !pageState.canSubmit) {
    return { ok: false, error: "not_eligible" };
  }

  const source = resolveFeedbackSubmitSource({
    forceShow: forced,
    pendingSource: state?.pendingSource ?? null,
    userCreatedAt: input.userCreatedAt,
    sourceOverride: input.sourceOverride ?? null,
  });

  const id = crypto.randomUUID();
  const comment = input.comment?.trim()
    ? input.comment.trim().slice(0, 2000)
    : null;
  await getPool().query(
    `INSERT INTO feedback_responses (id, user_id, score, comment, source, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [id, input.userId, input.score, comment, source]
  );
  await upsertPromptState(input.userId, {
    forceShow: false,
    pendingSource: null,
    snoozeUntil: null,
  });
  const { rows } = await getPool().query(
    `SELECT id, user_id, score, comment, source, admin_seen_at, created_at
     FROM feedback_responses WHERE id = $1`,
    [id]
  );
  const row = rows[0] as Record<string, unknown>;
  return {
    ok: true,
    feedback: {
      id: row.id as string,
      userId: row.user_id as string,
      score: Number(row.score),
      comment: (row.comment as string) ?? null,
      source: parseSource(row.source) ?? source,
      adminSeenAt: row.admin_seen_at
        ? new Date(row.admin_seen_at as string).toISOString()
        : null,
      createdAt: new Date(row.created_at as string).toISOString(),
    },
  };
}

export async function forceFeedbackPromptForEmail(
  email: string
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  await ensureFeedbackSchema();
  const { rows } = await getPool().query(
    `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email.trim()]
  );
  const userId = rows[0]?.id as string | undefined;
  if (!userId) return { ok: false, error: "User not found" };
  await upsertPromptState(userId, {
    forceShow: true,
    snoozeUntil: null,
    pendingSource: "forced",
  });
  return { ok: true, userId };
}

export async function listFeedbackResponses(limit = 100): Promise<FeedbackResponse[]> {
  await ensureFeedbackSchema();
  const { rows } = await getPool().query(
    `SELECT f.id, f.user_id, f.score, f.comment, f.source, f.admin_seen_at, f.created_at,
            u.email AS user_email, u.name AS user_name
     FROM feedback_responses f
     JOIN users u ON u.id = f.user_id
     ORDER BY f.created_at DESC
     LIMIT $1`,
    [Math.min(500, Math.max(1, limit))]
  );
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      userId: r.user_id as string,
      score: Number(r.score),
      comment: (r.comment as string) ?? null,
      source: parseSource(r.source) ?? "days_elapsed",
      adminSeenAt: r.admin_seen_at
        ? new Date(r.admin_seen_at as string).toISOString()
        : null,
      createdAt: new Date(r.created_at as string).toISOString(),
      userEmail: r.user_email as string,
      userName: (r.user_name as string) ?? null,
    };
  });
}

export async function countUnreadFeedback(): Promise<number> {
  await ensureFeedbackSchema();
  const { rows } = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM feedback_responses WHERE admin_seen_at IS NULL`
  );
  return Number(rows[0]?.count ?? 0);
}

export async function markAllFeedbackSeen(): Promise<void> {
  await ensureFeedbackSchema();
  await getPool().query(
    `UPDATE feedback_responses SET admin_seen_at = NOW() WHERE admin_seen_at IS NULL`
  );
}
