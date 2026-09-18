import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  TRIAL_BLS_SECONDS,
  TRIAL_GUIDED_SESSIONS,
} from "@/lib/billing-constants";
import {
  getEntitlementForUser,
  type EntitlementSnapshot,
} from "@/lib/entitlements";
import type { UserRole } from "@/lib/roles";

export class TrialLimitError extends Error {
  code: "trial_limit_reached" | "bls_limit_reached";
  entitlement: EntitlementSnapshot;

  constructor(
    code: "trial_limit_reached" | "bls_limit_reached",
    entitlement: EntitlementSnapshot,
    message: string
  ) {
    super(message);
    this.code = code;
    this.entitlement = entitlement;
  }
}

export class PaymentRequiredError extends Error {
  code = "needs_payment" as const;
  entitlement: EntitlementSnapshot;

  constructor(
    entitlement: EntitlementSnapshot,
    message = "Payment required to use self-guided set time"
  ) {
    super(message);
    this.entitlement = entitlement;
  }
}

async function ensureUsageRow(userId: string) {
  await getPool().query(
    `INSERT INTO trial_usage (user_id, guided_sessions_used, bls_seconds_used, updated_at)
     VALUES ($1, 0, 0, NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

/**
 * Atomically consume one guided trial session when a thread first becomes guided.
 * Re-entering the same thread does not consume again. Deleting the thread does not refund.
 */
export async function consumeGuidedSessionIfNeeded(input: {
  userId: string;
  role: UserRole;
  onboardingCompletedAt: string | null;
  threadId: string;
  previousMode: string;
  nextMode: string;
}): Promise<EntitlementSnapshot> {
  const entitlement = await getEntitlementForUser({
    userId: input.userId,
    role: input.role,
    onboardingCompletedAt: input.onboardingCompletedAt,
  });

  if (!entitlement.isTrialLimited) return entitlement;
  if (input.nextMode !== "guided") return entitlement;
  if (input.previousMode === "guided") return entitlement;

  await ensureSchemaReady();
  await ensureUsageRow(input.userId);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // Already counted for this thread?
    const existing = await client.query(
      `SELECT 1 FROM trial_guided_ledger WHERE user_id = $1 AND thread_id = $2`,
      [input.userId, input.threadId]
    );
    if (existing.rowCount) {
      await client.query("COMMIT");
      return getEntitlementForUser({
        userId: input.userId,
        role: input.role,
        onboardingCompletedAt: input.onboardingCompletedAt,
      });
    }

    const usage = await client.query<{ guided_sessions_used: number }>(
      `SELECT guided_sessions_used FROM trial_usage WHERE user_id = $1 FOR UPDATE`,
      [input.userId]
    );
    const used = Number(usage.rows[0]?.guided_sessions_used ?? 0);
    if (used >= TRIAL_GUIDED_SESSIONS) {
      await client.query("ROLLBACK");
      const latest = await getEntitlementForUser({
        userId: input.userId,
        role: input.role,
        onboardingCompletedAt: input.onboardingCompletedAt,
      });
      throw new TrialLimitError(
        "trial_limit_reached",
        latest,
        "Trial guided session limit reached"
      );
    }

    await client.query(
      `INSERT INTO trial_guided_ledger (user_id, thread_id, consumed_at)
       VALUES ($1, $2, NOW())`,
      [input.userId, input.threadId]
    );
    await client.query(
      `UPDATE trial_usage
       SET guided_sessions_used = guided_sessions_used + 1, updated_at = NOW()
       WHERE user_id = $1`,
      [input.userId]
    );
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }

  return getEntitlementForUser({
    userId: input.userId,
    role: input.role,
    onboardingCompletedAt: input.onboardingCompletedAt,
  });
}

/**
 * Reserve / consume BLS seconds for a free-mode trial run.
 * Returns how many seconds were granted (may be less than requested).
 */
export async function consumeBlsSeconds(input: {
  userId: string;
  role: UserRole;
  onboardingCompletedAt: string | null;
  seconds: number;
}): Promise<{ granted: number; entitlement: EntitlementSnapshot }> {
  const seconds = Math.max(0, Math.floor(input.seconds));
  let entitlement = await getEntitlementForUser({
    userId: input.userId,
    role: input.role,
    onboardingCompletedAt: input.onboardingCompletedAt,
  });

  if (!entitlement.canUseApp) {
    throw new PaymentRequiredError(entitlement);
  }
  if (!entitlement.isTrialLimited) {
    return { granted: seconds, entitlement };
  }
  if (seconds <= 0) {
    return { granted: 0, entitlement };
  }

  await ensureSchemaReady();
  await ensureUsageRow(input.userId);
  const client = await getPool().connect();
  let granted = 0;
  try {
    await client.query("BEGIN");
    const usage = await client.query<{ bls_seconds_used: number }>(
      `SELECT bls_seconds_used FROM trial_usage WHERE user_id = $1 FOR UPDATE`,
      [input.userId]
    );
    const used = Number(usage.rows[0]?.bls_seconds_used ?? 0);
    const remaining = Math.max(0, TRIAL_BLS_SECONDS - used);
    if (remaining <= 0) {
      await client.query("ROLLBACK");
      entitlement = await getEntitlementForUser({
        userId: input.userId,
        role: input.role,
        onboardingCompletedAt: input.onboardingCompletedAt,
      });
      throw new TrialLimitError(
        "bls_limit_reached",
        entitlement,
        "Trial self-guided set time limit reached"
      );
    }
    granted = Math.min(seconds, remaining);
    await client.query(
      `UPDATE trial_usage
       SET bls_seconds_used = bls_seconds_used + $2, updated_at = NOW()
       WHERE user_id = $1`,
      [input.userId, granted]
    );
    await client.query(
      `INSERT INTO trial_bls_ledger (id, user_id, seconds, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [crypto.randomUUID(), input.userId, granted]
    );
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }

  entitlement = await getEntitlementForUser({
    userId: input.userId,
    role: input.role,
    onboardingCompletedAt: input.onboardingCompletedAt,
  });
  return { granted, entitlement };
}
