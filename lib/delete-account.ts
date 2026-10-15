import { ensureSchemaReady, getPool } from "@/lib/db";
import { getSubscriptionByUserId } from "@/lib/stripe-admin";
import { resolveStripeClient } from "@/lib/stripe";
import { removeBrevoContact } from "@/lib/email/brevo-contacts";
import { verifyPassword } from "@/lib/auth/password";
import {
  DELETE_CONFIRM_PHRASE,
  deleteConfirmPhraseMatches,
  type StripeCancelResult,
} from "@/lib/delete-account-shared";

export type { StripeCancelResult };

export {
  DELETE_CONFIRM_PHRASE,
  accountDeletedBillingNote,
  deleteConfirmPhraseMatches,
  emailsMatchForDeletion,
} from "@/lib/delete-account-shared";

type StripeSnap = {
  subscriptionId: string;
  customerId: string | null;
  livemode: boolean | null;
};

const TERMINAL_SUB_STATUSES = new Set([
  "canceled",
  "incomplete_expired",
]);

async function snapshotStripeSubscription(
  userId: string
): Promise<StripeSnap | null> {
  const sub = await getSubscriptionByUserId(userId);
  const subscriptionId = sub?.stripe_subscription_id?.trim();
  if (!subscriptionId) return null;
  return {
    subscriptionId,
    customerId: sub.stripe_customer_id?.trim() || null,
    livemode:
      typeof sub.stripe_livemode === "boolean" ? sub.stripe_livemode : null,
  };
}

/**
 * Cancel from a snapshot taken before the user row is deleted.
 * Already-canceled subs count as success. Customer delete is best-effort.
 */
export async function cancelStripeFromSnapshot(
  snap: StripeSnap | null
): Promise<StripeCancelResult> {
  if (!snap) {
    return { attempted: false, canceled: false, hadSubscription: false };
  }

  try {
    const resolved = await resolveStripeClient({
      livemode: snap.livemode,
      objectId: snap.subscriptionId,
    });
    if (!resolved) {
      return {
        attempted: true,
        canceled: false,
        hadSubscription: true,
        error: "Stripe client unavailable",
      };
    }

    const existing = await resolved.stripe.subscriptions.retrieve(
      snap.subscriptionId
    );
    if (!TERMINAL_SUB_STATUSES.has(existing.status)) {
      await getPool().query(
        `UPDATE subscriptions
         SET cancel_notice_sent_at = COALESCE(cancel_notice_sent_at, NOW())
         WHERE stripe_subscription_id = $1`,
        [snap.subscriptionId]
      );
      await resolved.stripe.subscriptions.cancel(snap.subscriptionId);
    }

    const customerId =
      snap.customerId ||
      (typeof existing.customer === "string"
        ? existing.customer
        : existing.customer?.id) ||
      null;
    if (customerId) {
      try {
        await resolved.stripe.customers.del(customerId);
      } catch (err) {
        console.warn("[delete-account] Stripe customer delete", err);
      }
    }

    return { attempted: true, canceled: true, hadSubscription: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe cancel failed";
    console.error("[delete-account] Stripe cancel", err);
    return {
      attempted: true,
      canceled: false,
      hadSubscription: true,
      error: message,
    };
  }
}

export type DeleteAccountAuth =
  | { kind: "password"; password: string }
  | { kind: "phrase"; phrase: string };

async function assertMayDeleteTarget(
  target: User,
  actorId: string,
  mode: "self" | "admin"
): Promise<{ error: string } | null> {
  if (mode === "self" && target.id !== actorId) {
    return { error: "Forbidden" };
  }
  if (mode === "admin" && target.id === actorId) {
    return { error: "You cannot delete your own account" };
  }

  if (target.role === "platform_admin") {
    const { rows } = await getPool().query<{ c: number }>(
      "SELECT COUNT(*)::int AS c FROM users WHERE role = 'platform_admin'"
    );
    if ((rows[0]?.c ?? 0) <= 1) {
      return {
        error:
          mode === "self"
            ? "Cannot delete the last platform admin. Promote another admin first."
            : "Cannot delete the last platform admin",
      };
    }
  }
  return null;
}

async function verifySelfAuth(
  user: User,
  auth: DeleteAccountAuth
): Promise<{ error: string } | null> {
  if (user.passwordHash) {
    if (auth.kind !== "password" || !auth.password) {
      return { error: "Enter your password to confirm" };
    }
    const ok = await verifyPassword(auth.password, user.passwordHash);
    if (!ok) return { error: "Incorrect password" };
    return null;
  }
  if (auth.kind !== "phrase" || !deleteConfirmPhraseMatches(auth.phrase)) {
    return { error: `Type ${DELETE_CONFIRM_PHRASE} to confirm` };
  }
  return null;
}

/**
 * Snapshot Stripe → cancel (required when a sub exists) → DELETE user.
 * Caller writes audit only after success.
 */
export async function deleteUserAccount(opts: {
  targetId: string;
  actorId: string;
  mode: "self" | "admin";
  auth?: DeleteAccountAuth;
}): Promise<
  | { ok: true; user: User; stripe: StripeCancelResult }
  | { error: string }
> {
  await ensureSchemaReady();

  const user = await getUserById(opts.targetId);
  if (!user) return { error: "User not found" };

  const blocked = await assertMayDeleteTarget(user, opts.actorId, opts.mode);
  if (blocked) return blocked;

  if (opts.mode === "self") {
    if (!opts.auth) return { error: "Confirmation required" };
    const authErr = await verifySelfAuth(user, opts.auth);
    if (authErr) return authErr;
  }

  const stripeSnap = await snapshotStripeSubscription(user.id);
  const stripe = await cancelStripeFromSnapshot(stripeSnap);
  if (stripe.hadSubscription && !stripe.canceled) {
    return {
      error:
        "Could not cancel the Stripe subscription. Fix billing or try again before deleting this account.",
    };
  }

  await getPool().query("DELETE FROM users WHERE id = $1", [user.id]);
  try {
    await removeBrevoContact(user.email);
  } catch (err) {
    console.warn("[delete-account] Brevo contact", err);
  }

  return { ok: true, user, stripe };
}

export async function deleteOwnAccount(
  userId: string,
  auth: DeleteAccountAuth
): Promise<
  | { ok: true; user: User; stripe: StripeCancelResult }
  | { error: string }
> {
  return deleteUserAccount({
    targetId: userId,
    actorId: userId,
    mode: "self",
    auth,
  });
}
