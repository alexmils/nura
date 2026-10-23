import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  TRIAL_BLS_SECONDS,
  TRIAL_GUIDED_SESSIONS,
} from "@/lib/billing-constants";
import type { UserRole } from "@/lib/roles";
import { deriveBillingState } from "@/lib/billing-access-state";

export type AccessTier = "none" | "legacy" | "trialing" | "active" | "blocked";

export type SubscriptionStatus =
  | "none"
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "legacy";

export type EntitlementSnapshot = {
  accessTier: AccessTier;
  canUseApp: boolean;
  needsOnboarding: boolean;
  needsPayment: boolean;
  plan: string;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  accessEndsAt: string | null;
  guidedUsed: number;
  guidedLimit: number;
  guidedRemaining: number;
  blsSecondsUsed: number;
  blsSecondsLimit: number;
  blsSecondsRemaining: number;
  isTrialLimited: boolean;
  onboardingCompletedAt: string | null;
};

type SubRow = {
  plan: string;
  status: string;
  renews_at: string | null;
  trial_ends_at: string | null;
  access_tier: string | null;
  cancel_at_period_end: boolean;
  trial_kind: string | null;
};

type UsageRow = {
  guided_sessions_used: number;
  bls_seconds_used: number;
};

function asIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

function normalizeStatus(raw: string | null | undefined): SubscriptionStatus {
  switch (raw) {
    case "incomplete":
    case "trialing":
    case "active":
    case "past_due":
    case "unpaid":
    case "canceled":
    case "legacy":
      return raw;
    default:
      return "none";
  }
}

export function resolveAccessTier(input: {
  role: UserRole;
  onboardingCompletedAt: string | null;
  accessTier: string | null | undefined;
  status: string | null | undefined;
  trialEndsAt: string | null | undefined;
  renewsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  now?: Date;
}): AccessTier {
  if (input.role === "platform_admin" || input.role === "support") {
    return "legacy";
  }

  const now = input.now ?? new Date();
  const status = normalizeStatus(input.status);
  const tier = input.accessTier;

  if (tier === "legacy" || status === "legacy") return "legacy";
  if (status === "active") return "active";
  if (status === "trialing") {
    const ends = input.trialEndsAt ? new Date(input.trialEndsAt) : null;
    if (ends && ends.getTime() < now.getTime()) return "blocked";
    return "trialing";
  }

  // Canceled at period end but the paid period is still running (e.g. the
  // webhook wrote "canceled" early): keep access until the real end date.
  if (status === "canceled" && input.cancelAtPeriodEnd && input.renewsAt) {
    const end = new Date(input.renewsAt).getTime();
    if (Number.isFinite(end) && end > now.getTime()) return "active";
  }

  if (
    status === "past_due" ||
    status === "unpaid" ||
    status === "canceled" ||
    status === "incomplete"
  ) {
    return "blocked";
  }

  if (!input.onboardingCompletedAt) return "none";
  return "blocked";
}

export function buildEntitlementSnapshot(input: {
  role: UserRole;
  onboardingCompletedAt: string | null;
  plan: string;
  status: string;
  accessTier: string | null;
  trialEndsAt: string | null;
  renewsAt: string | null;
  cancelAtPeriodEnd?: boolean;
  guidedUsed: number;
  blsSecondsUsed: number;
  /** "reactivation" = 30-day win-back trial: full access, no trial caps. */
  trialKind?: string | null;
  now?: Date;
}): EntitlementSnapshot {
  const accessTier = resolveAccessTier(input);
  const isTrialLimited =
    accessTier === "trialing" && input.trialKind !== "reactivation";
  const guidedLimit = isTrialLimited ? TRIAL_GUIDED_SESSIONS : Number.POSITIVE_INFINITY;
  const blsLimit = isTrialLimited ? TRIAL_BLS_SECONDS : Number.POSITIVE_INFINITY;
  const guidedUsed = Math.max(0, input.guidedUsed);
  const blsUsed = Math.max(0, input.blsSecondsUsed);
  const guidedRemaining = isTrialLimited
    ? Math.max(0, TRIAL_GUIDED_SESSIONS - guidedUsed)
    : Number.POSITIVE_INFINITY;
  const blsRemaining = isTrialLimited
    ? Math.max(0, TRIAL_BLS_SECONDS - blsUsed)
    : Number.POSITIVE_INFINITY;

  const needsOnboarding =
    input.role === "user" &&
    !input.onboardingCompletedAt &&
    accessTier === "none";
  const canUseApp =
    accessTier === "legacy" ||
    accessTier === "trialing" ||
    accessTier === "active";
  const needsPayment = accessTier === "blocked" || accessTier === "none";
  const renewsAt = asIso(input.renewsAt);
  const nowMs = (input.now ?? new Date()).getTime();
  // "Canceling" only means something while access is live and the period
  // end is still ahead. A leftover flag on an ended / unpaid subscription is
  // just "ended", so the UI never shows "Plan: None" next to "Canceling".
  const cancelAtPeriodEnd =
    Boolean(input.cancelAtPeriodEnd) &&
    (accessTier === "active" || accessTier === "trialing") &&
    renewsAt !== null &&
    new Date(renewsAt).getTime() > nowMs;
  const accessEndsAt = cancelAtPeriodEnd ? renewsAt : null;

  return {
    accessTier,
    canUseApp: canUseApp && !needsOnboarding,
    needsOnboarding,
    needsPayment,
    plan: input.plan || "free",
    status: normalizeStatus(input.status),
    trialEndsAt: asIso(input.trialEndsAt),
    renewsAt,
    cancelAtPeriodEnd,
    accessEndsAt,
    guidedUsed,
    guidedLimit: isTrialLimited ? TRIAL_GUIDED_SESSIONS : -1,
    guidedRemaining: isTrialLimited ? guidedRemaining : -1,
    blsSecondsUsed: blsUsed,
    blsSecondsLimit: isTrialLimited ? TRIAL_BLS_SECONDS : -1,
    blsSecondsRemaining: isTrialLimited ? blsRemaining : -1,
    isTrialLimited,
    onboardingCompletedAt: asIso(input.onboardingCompletedAt),
  };
}

export async function getEntitlementForUser(input: {
  userId: string;
  role: UserRole;
  onboardingCompletedAt: string | null;
}): Promise<EntitlementSnapshot> {
  await ensureSchemaReady();
  const pool = getPool();

  const [{ rows: subRows }, { rows: usageRows }] = await Promise.all([
    pool.query<SubRow>(
      `SELECT plan, status, renews_at, trial_ends_at, access_tier,
              COALESCE(cancel_at_period_end, FALSE) AS cancel_at_period_end,
              trial_kind
       FROM subscriptions WHERE user_id = $1`,
      [input.userId]
    ),
    pool.query<UsageRow>(
      `SELECT guided_sessions_used, bls_seconds_used
       FROM trial_usage WHERE user_id = $1`,
      [input.userId]
    ),
  ]);

  const sub = subRows[0];
  const usage = usageRows[0];

  return buildEntitlementSnapshot({
    role: input.role,
    onboardingCompletedAt: input.onboardingCompletedAt,
    plan: sub?.plan ?? "free",
    status: sub?.status ?? "none",
    accessTier: sub?.access_tier ?? null,
    trialEndsAt: sub?.trial_ends_at ?? null,
    renewsAt: sub?.renews_at ?? null,
    cancelAtPeriodEnd: Boolean(sub?.cancel_at_period_end),
    guidedUsed: Number(usage?.guided_sessions_used ?? 0),
    blsSecondsUsed: Number(usage?.bls_seconds_used ?? 0),
    trialKind: sub?.trial_kind ?? null,
  });
}

export function publicEntitlement(snapshot: EntitlementSnapshot) {
  return {
    accessTier: snapshot.accessTier,
    canUseApp: snapshot.canUseApp,
    needsOnboarding: snapshot.needsOnboarding,
    needsPayment: snapshot.needsPayment,
    plan: snapshot.plan,
    status: snapshot.status,
    trialEndsAt: snapshot.trialEndsAt,
    renewsAt: snapshot.renewsAt,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    accessEndsAt: snapshot.accessEndsAt,
    guidedUsed: snapshot.guidedUsed,
    guidedLimit: snapshot.guidedLimit,
    guidedRemaining: snapshot.guidedRemaining,
    blsSecondsUsed: snapshot.blsSecondsUsed,
    blsSecondsLimit: snapshot.blsSecondsLimit,
    blsSecondsRemaining: snapshot.blsSecondsRemaining,
    isTrialLimited: snapshot.isTrialLimited,
    onboardingCompletedAt: snapshot.onboardingCompletedAt,
    billingState: deriveBillingState(snapshot),
  };
}
