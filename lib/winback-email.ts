/**
 * Win-back links + emails shared by Admin > Problem reports and the admin
 * single-user page. Links come from the existing reactivation system
 * (lib/reactivation.ts): one open link per person, a new one replaces the
 * unused old one, and nobody gets a second link once one was redeemed.
 *
 * Every win-back email that went out is kept in winback_emails (token
 * redacted; the DB only stores the token's hash), one email per link.
 */
import { randomUUID } from "crypto";
import { ensureSchemaReady, getPool } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { BRAND_SPOKEN } from "@/lib/brand";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { writeAuditEvent } from "@/lib/audit-log";
import { getUserById } from "@/lib/users";
import {
  createReactivationOffer,
  markReactivationSent,
  type ReactivationOffer,
} from "@/lib/reactivation";
import {
  hashReactivationToken,
  reactivationLink,
  reactivationLinkStatus,
  REACTIVATION_TRIAL_DAYS,
  type ReactivationLinkStatus,
  type ReactivationOfferSource,
} from "@/lib/reactivation-rules";
import { isExtensionMarker } from "@/lib/reactivation-extend";
import {
  buildWinbackEmailDraft,
  problemTextToHtml,
  redactWinbackToken,
  tokenFromWinbackBody,
  validateWinbackEmail,
  winbackModeFor,
  type WinbackEmailDraft,
  type WinbackMode,
} from "@/lib/problem-report-rules";

export class WinbackError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

type SubRow = { status: string | null; cancel_at_period_end: boolean | null };

async function subscriptionOf(userId: string): Promise<SubRow | null> {
  const { rows } = await getPool().query<SubRow>(
    `SELECT status, cancel_at_period_end FROM subscriptions WHERE user_id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function hasRedeemedWinback(userId: string): Promise<boolean> {
  const { rows } = await getPool().query(
    `SELECT 1 FROM reactivation_offers WHERE user_id = $1 AND used_at IS NOT NULL LIMIT 1`,
    [userId]
  );
  return rows.length > 0;
}

/** Which path the link takes for this person right now. */
export async function winbackModeForUser(userId: string): Promise<WinbackMode> {
  const sub = await subscriptionOf(userId);
  return winbackModeFor(sub ? { status: sub.status, cancelAtPeriodEnd: sub.cancel_at_period_end } : null);
}

/**
 * Mint a link (replaces an unused old one) and the default email for it.
 * Refuses when the person already redeemed a win-back.
 */
export async function mintWinbackLink(input: {
  userId: string;
  actorUserId: string;
  source: ReactivationOfferSource;
  problemReportId?: string | null;
}): Promise<{ link: string; offer: ReactivationOffer; draft: WinbackEmailDraft; mode: WinbackMode }> {
  await ensureSchemaReady();
  const user = await getUserById(input.userId);
  if (!user?.email) throw new WinbackError("User not found", 404);
  if (await hasRedeemedWinback(input.userId)) {
    throw new WinbackError("This person already redeemed a win-back. One per person.");
  }
  const { token, offer } = await createReactivationOffer({
    userId: input.userId,
    createdBy: input.actorUserId,
    source: input.source,
  });
  const link = reactivationLink(await getPublicAppUrl(), token);
  await writeAuditEvent({
    actorUserId: input.actorUserId,
    targetUserId: input.userId,
    action: "reactivation.link_generated",
    detail: {
      offerId: offer.id,
      plan: offer.plan,
      expiresAt: offer.expiresAt,
      source: input.source,
      ...(input.problemReportId ? { problemReportId: input.problemReportId } : {}),
    },
  }).catch(() => {});
  const mode = await winbackModeForUser(input.userId);
  const draft = buildWinbackEmailDraft({
    to: user.email,
    name: user.name,
    link,
    expiresAt: new Date(offer.expiresAt),
    brand: BRAND_SPOKEN,
    trialDays: REACTIVATION_TRIAL_DAYS,
    mode,
  });
  return { link, offer, draft, mode };
}

export type PreparedWinbackEmail = {
  userId: string;
  to: string;
  offerId: string;
  subject: string;
  body: string;
  mode: WinbackMode;
};

/**
 * Check an (edited) email before anything is sent: subject/body valid, the
 * body still has a link, and that link is this person's current, unused,
 * unexpired offer (optionally a specific one).
 */
export async function prepareWinbackEmail(input: {
  userId: string;
  subject: unknown;
  body: unknown;
  expectedOfferId?: string | null;
}): Promise<PreparedWinbackEmail> {
  await ensureSchemaReady();
  const valid = validateWinbackEmail({ subject: input.subject, body: input.body });
  if (!valid.ok) throw new WinbackError(valid.error);
  const token = tokenFromWinbackBody(valid.body);
  if (!token) throw new WinbackError("The body must contain the win-back link");
  const { rows } = await getPool().query<{
    id: string;
    user_id: string;
    expires_at: Date;
    used_at: Date | null;
  }>(`SELECT id, user_id, expires_at, used_at FROM reactivation_offers WHERE token_hash = $1`, [
    hashReactivationToken(token),
  ]);
  const offer = rows[0];
  if (!offer || offer.user_id !== input.userId) {
    throw new WinbackError("The link in the email is not the current one, generate a new one");
  }
  if (input.expectedOfferId && offer.id !== input.expectedOfferId) {
    throw new WinbackError("The link in the email is not the current one, generate a new one");
  }
  if (offer.used_at || new Date(offer.expires_at).getTime() <= Date.now()) {
    throw new WinbackError("The link is used or expired, generate a new one");
  }
  const user = await getUserById(input.userId);
  if (!user?.email) throw new WinbackError("User not found", 404);
  return {
    userId: input.userId,
    to: user.email,
    offerId: offer.id,
    subject: valid.subject,
    body: valid.body,
    mode: await winbackModeForUser(input.userId),
  };
}

/**
 * Send a prepared email. One email per link: the history row is claimed
 * first (unique per offer), removed again if the send fails.
 */
export async function deliverWinbackEmail(input: {
  prepared: PreparedWinbackEmail;
  actorUserId: string;
  problemReportId?: string | null;
}): Promise<{ id: string; sentAt: string; redactedBody: string }> {
  const p = input.prepared;
  const id = randomUUID();
  const redactedBody = redactWinbackToken(p.body);
  const claim = await getPool().query<{ sent_at: Date }>(
    `INSERT INTO winback_emails (id, user_id, offer_id, problem_report_id, mode, to_email, subject, body, sent_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (offer_id) DO NOTHING
     RETURNING sent_at`,
    [id, p.userId, p.offerId, input.problemReportId ?? null, p.mode, p.to, p.subject, redactedBody, input.actorUserId]
  );
  if (!claim.rowCount) throw new WinbackError("An email with this link was already sent. Generate a new link to send again.", 409);
  try {
    await sendEmail({
      to: p.to,
      subject: p.subject,
      text: p.body,
      html: problemTextToHtml(p.body),
      templateId: "winback",
      dedupKey: `winback:${p.offerId}`,
    });
  } catch (err) {
    await getPool().query(`DELETE FROM winback_emails WHERE id = $1`, [id]).catch(() => {});
    console.error("[winback] send failed", err);
    throw new WinbackError("Sending failed, nothing was sent. Check Admin > Email.", 502);
  }
  await markReactivationSent(p.offerId).catch((err) => console.error("[winback] mark sent", err));
  return { id, sentAt: new Date(claim.rows[0]!.sent_at).toISOString(), redactedBody };
}

export type WinbackEmailRecord = {
  id: string;
  offerId: string | null;
  problemReportId: string | null;
  mode: string | null;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  sentByEmail: string | null;
};

export async function listWinbackEmails(userId: string): Promise<WinbackEmailRecord[]> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<{
    id: string;
    offer_id: string | null;
    problem_report_id: string | null;
    mode: string | null;
    to_email: string;
    subject: string;
    body: string;
    sent_at: Date;
    sent_by_email: string | null;
  }>(
    `SELECT w.*, u.email AS sent_by_email FROM winback_emails w
     LEFT JOIN users u ON u.id = w.sent_by
     WHERE w.user_id = $1 ORDER BY w.sent_at DESC LIMIT 50`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    offerId: r.offer_id,
    problemReportId: r.problem_report_id,
    mode: r.mode,
    to: r.to_email,
    subject: r.subject,
    body: r.body,
    sentAt: new Date(r.sent_at).toISOString(),
    sentByEmail: r.sent_by_email,
  }));
}

export type UserWinback = {
  userId: string;
  email: string;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  /** Path a redeemed link takes now: extend (paying) or trial (lapsed). */
  mode: WinbackMode;
  linkStatus: ReactivationLinkStatus;
  offer: {
    id: string;
    createdAt: string;
    expiresAt: string;
    sentAt: string | null;
    openedAt: string | null;
    usedAt: string | null;
    source: string | null;
    redeemedAs: "extend" | "trial" | null;
  } | null;
  /** One win-back per person: no new link after this. */
  redeemed: boolean;
  emails: WinbackEmailRecord[];
};

/** Win-back status for the admin single-user page. */
export async function getUserWinback(userId: string, now = new Date()): Promise<UserWinback | null> {
  await ensureSchemaReady();
  const user = await getUserById(userId);
  if (!user) return null;
  const sub = await subscriptionOf(userId);
  // A redeemed offer wins over a later one; otherwise the newest.
  const { rows } = await getPool().query<{
    id: string;
    created_at: Date;
    expires_at: Date;
    sent_at: Date | null;
    opened_at: Date | null;
    used_at: Date | null;
    checkout_session_id: string | null;
    source: string | null;
  }>(
    `SELECT id, created_at, expires_at, sent_at, opened_at, used_at, checkout_session_id, source
     FROM reactivation_offers WHERE user_id = $1
     ORDER BY (used_at IS NOT NULL) DESC, created_at DESC LIMIT 1`,
    [userId]
  );
  const o = rows[0];
  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
  const offer = o
    ? {
        id: o.id,
        createdAt: new Date(o.created_at).toISOString(),
        expiresAt: new Date(o.expires_at).toISOString(),
        sentAt: iso(o.sent_at),
        openedAt: iso(o.opened_at),
        usedAt: iso(o.used_at),
        source: o.source,
        redeemedAs: o.used_at ? (isExtensionMarker(o.checkout_session_id) ? ("extend" as const) : ("trial" as const)) : null,
      }
    : null;
  return {
    userId,
    email: user.email,
    subscriptionStatus: sub?.status ?? null,
    cancelAtPeriodEnd: Boolean(sub?.cancel_at_period_end),
    mode: winbackModeFor(sub ? { status: sub.status, cancelAtPeriodEnd: sub.cancel_at_period_end } : null),
    linkStatus: reactivationLinkStatus(offer, now),
    offer,
    redeemed: Boolean(offer?.usedAt),
    emails: await listWinbackEmails(userId),
  };
}

/** User page: "Generate win-back" without a problem report (admin decision). */
export async function generateUserWinback(input: { userId: string; actorUserId: string }) {
  const out = await mintWinbackLink({ userId: input.userId, actorUserId: input.actorUserId, source: "admin_user" });
  return { link: out.link, offer: out.offer, draft: out.draft, mode: out.mode };
}

/** User page: send the previewed email (explicit click only). */
export async function sendUserWinbackEmail(input: {
  userId: string;
  subject: unknown;
  body: unknown;
  actorUserId: string;
}): Promise<UserWinback | null> {
  const prepared = await prepareWinbackEmail({ userId: input.userId, subject: input.subject, body: input.body });
  await deliverWinbackEmail({ prepared, actorUserId: input.actorUserId });
  return getUserWinback(input.userId);
}
