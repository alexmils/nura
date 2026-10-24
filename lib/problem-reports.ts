/**
 * Problem reports: someone tells the AI guide the app is not working (ball
 * missing, no sound, page not loading...). Detected in app/api/chat/route.ts,
 * stored here, reviewed in Admin > Billing > Problem reports, and a confirmed
 * one can get a win-back link from the existing reactivation system.
 *
 * Pure rules (matcher, dedupe, rate limit, transitions, emails) are in
 * lib/problem-report-rules.ts. Schema: lib/db.ts runSchemaMigrations and
 * docs/migrations/2026-10-24-problem-reports.sql.
 */
import { randomUUID } from "crypto";
import {
  deliverWinbackEmail,
  mintWinbackLink,
  prepareWinbackEmail,
  WinbackError,
} from "@/lib/winback-email";
import { ensureSchemaReady, getPool } from "@/lib/db";
import { sendEmail, getAppUrl } from "@/lib/email";
import { adminPaymentNotifyRecipients } from "@/lib/email/admin-payment-notify";
import { type ReactivationOffer } from "@/lib/reactivation";
import { reactivationLinkStatus, type ReactivationLinkStatus } from "@/lib/reactivation-rules";
import {
  buildProblemAlertEmail,
  canGenerateWinback,
  canTransitionProblemReport,
  detectAppProblem,
  mergeProblemExcerpt,
  parseAdminAlertEnv,
  problemEvent,
  problemExcerpt,
  PROBLEM_ALERT_WINDOW_MS,
  PROBLEM_NOTE_MAX,
  PROBLEM_REPORTS_ADMIN_PATH,
  shouldMergeProblemReport,
  shouldSendProblemAlert,
  statusEventType,
  type ProblemCategory,
  type ProblemEvent,
  type ProblemReportStatus,
  type WinbackEmailDraft,
  isProblemSource,
  type ProblemSource,
} from "@/lib/problem-report-rules";

export type ProblemReport = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  threadId: string | null;
  /** Where it was detected: AI guide session, help chat, or admin. */
  source: ProblemSource;
  helpThreadId: string | null;
  threadTitle: string | null;
  excerpt: string;
  category: ProblemCategory;
  language: string | null;
  hitCount: number;
  status: ProblemReportStatus;
  adminNote: string | null;
  reactivationOfferId: string | null;
  linkStatus: ReactivationLinkStatus;
  linkExpiresAt: string | null;
  /** The user already redeemed a win-back once: no second free month. */
  winbackUsed: boolean;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  emailedAdminAt: string | null;
  winbackEmailSentAt: string | null;
  winbackEmailTo: string | null;
  winbackEmailSubject: string | null;
  winbackEmailBody: string | null;
  events: ProblemEvent[];
  createdAt: string;
  lastDetectedAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  thread_id: string | null;
  source: string | null;
  help_thread_id: string | null;
  thread_title: string | null;
  excerpt: string;
  category: string;
  language: string | null;
  hit_count: number;
  status: string;
  admin_note: string | null;
  reactivation_offer_id: string | null;
  offer_created_at: Date | null;
  offer_expires_at: Date | null;
  offer_sent_at: Date | null;
  offer_opened_at: Date | null;
  offer_used_at: Date | null;
  winback_used: boolean | null;
  sub_status: string | null;
  cancel_at_period_end: boolean | null;
  emailed_admin_at: Date | null;
  winback_email_sent_at: Date | null;
  winback_email_to: string | null;
  winback_email_subject: string | null;
  winback_email_body: string | null;
  events: unknown;
  created_at: Date;
  last_detected_at: Date;
  updated_at: Date;
};

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

const SELECT = `
  SELECT pr.*, u.email AS user_email, u.name AS user_name, t.title AS thread_title,
         o.created_at AS offer_created_at, o.expires_at AS offer_expires_at,
         o.sent_at AS offer_sent_at, o.opened_at AS offer_opened_at, o.used_at AS offer_used_at,
         EXISTS (SELECT 1 FROM reactivation_offers ro WHERE ro.user_id = pr.user_id AND ro.used_at IS NOT NULL) AS winback_used,
         s.status AS sub_status, s.cancel_at_period_end
  FROM problem_reports pr
  JOIN users u ON u.id = pr.user_id
  LEFT JOIN threads t ON t.id = pr.thread_id
  LEFT JOIN reactivation_offers o ON o.id = pr.reactivation_offer_id
  LEFT JOIN subscriptions s ON s.user_id = pr.user_id`;

function rowToReport(r: Row, now = new Date()): ProblemReport {
  const offer = r.offer_created_at
    ? {
        createdAt: r.offer_created_at,
        expiresAt: r.offer_expires_at!,
        sentAt: r.offer_sent_at,
        openedAt: r.offer_opened_at,
        usedAt: r.offer_used_at,
      }
    : null;
  return {
    id: r.id,
    userId: r.user_id,
    userEmail: r.user_email,
    userName: r.user_name,
    threadId: r.thread_id,
    source: isProblemSource(r.source) ? r.source : "guide_session",
    helpThreadId: r.help_thread_id,
    threadTitle: r.thread_title,
    excerpt: r.excerpt,
    category: r.category as ProblemCategory,
    language: r.language,
    hitCount: Number(r.hit_count ?? 1),
    status: r.status as ProblemReportStatus,
    adminNote: r.admin_note,
    reactivationOfferId: r.reactivation_offer_id,
    linkStatus: reactivationLinkStatus(offer, now),
    linkExpiresAt: iso(r.offer_expires_at),
    winbackUsed: Boolean(r.winback_used),
    subscriptionStatus: r.sub_status,
    cancelAtPeriodEnd: Boolean(r.cancel_at_period_end),
    emailedAdminAt: iso(r.emailed_admin_at),
    winbackEmailSentAt: iso(r.winback_email_sent_at),
    winbackEmailTo: r.winback_email_to,
    winbackEmailSubject: r.winback_email_subject,
    winbackEmailBody: r.winback_email_body,
    events: Array.isArray(r.events) ? (r.events as ProblemEvent[]) : [],
    createdAt: new Date(r.created_at).toISOString(),
    lastDetectedAt: new Date(r.last_detected_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function getProblemReport(id: string): Promise<ProblemReport | null> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<Row>(`${SELECT} WHERE pr.id = $1`, [id]);
  return rows[0] ? rowToReport(rows[0]) : null;
}

export async function listProblemReports(
  limit = 200,
  opts: { userId?: string | null } = {}
): Promise<ProblemReport[]> {
  await ensureSchemaReady();
  const max = Math.max(1, Math.min(500, limit));
  const { rows } = opts.userId
    ? await getPool().query<Row>(
        `${SELECT} WHERE pr.user_id = $2 ORDER BY pr.last_detected_at DESC LIMIT $1`,
        [max, opts.userId]
      )
    : await getPool().query<Row>(`${SELECT} ORDER BY pr.last_detected_at DESC LIMIT $1`, [max]);
  const now = new Date();
  return rows.map((r) => rowToReport(r, now));
}

async function appendEvent(id: string, event: ProblemEvent, extraSql = "", extra: unknown[] = []) {
  await getPool().query(
    `UPDATE problem_reports
     SET events = events || $2::jsonb, updated_at = NOW()${extraSql}
     WHERE id = $1`,
    [id, JSON.stringify([event]), ...extra]
  );
}

/** Who gets the operator alert. ADMIN_ALERT_EMAIL overrides (or "off"). */
export async function problemAlertRecipients(): Promise<string[]> {
  const env = parseAdminAlertEnv(process.env.ADMIN_ALERT_EMAIL);
  if (env.mode === "off") return [];
  if (env.mode === "list") return env.emails;
  return adminPaymentNotifyRecipients();
}

async function maybeAlertAdmins(reportId: string, now: Date): Promise<void> {
  const report = await getProblemReport(reportId);
  if (!report) return;
  const { rows } = await getPool().query<{ last: Date | null }>(
    `SELECT MAX(emailed_admin_at) AS last FROM problem_reports WHERE user_id = $1`,
    [report.userId]
  );
  if (!shouldSendProblemAlert(rows[0]?.last ?? null, now, PROBLEM_ALERT_WINDOW_MS)) return;

  const recipients = await problemAlertRecipients();
  if (!recipients.length) {
    await appendEvent(reportId, problemEvent("admin_email_skipped", { now, detail: "No alert recipients (ADMIN_ALERT_EMAIL is off)" }));
    return;
  }
  // Claim the slot first so two quick turns cannot both email.
  const claim = await getPool().query(
    `UPDATE problem_reports SET emailed_admin_at = $2
     WHERE id = $1 AND NOT EXISTS (
       SELECT 1 FROM problem_reports p2
       WHERE p2.user_id = $3 AND p2.emailed_admin_at > $4
     )`,
    [reportId, now, report.userId, new Date(now.getTime() - PROBLEM_ALERT_WINDOW_MS)]
  );
  if (!claim.rowCount) return;

  const copy = buildProblemAlertEmail({
    userEmail: report.userEmail,
    userName: report.userName,
    detectedAt: now,
    category: report.category,
    language: report.language,
    excerpt: report.excerpt,
    threadTitle: report.threadTitle,
    source: report.source,
    adminUrl: await getAppUrl(`${PROBLEM_REPORTS_ADMIN_PATH}#problem-${report.id}`),
  });
  let sent = 0;
  for (const to of recipients) {
    try {
      await sendEmail({ to, ...copy, templateId: "admin_problem_report", dedupKey: `problem-alert:${report.id}:${now.getTime()}:${to}` });
      sent += 1;
    } catch (err) {
      console.error("[problem-reports] admin alert failed:", to, err);
    }
  }
  await appendEvent(
    reportId,
    sent > 0
      ? problemEvent("admin_emailed", { now, detail: `${sent} recipient(s)` })
      : problemEvent("admin_email_failed", { now, detail: "Every send failed (see server log)" })
  );
}

/**
 * Called from the chat route for every guided user turn. Never throws and
 * never changes the guide's reply: everything is caught and logged.
 */
export async function recordProblemReportFromChat(input: {
  userId: string | null | undefined;
  /** Guided session (threads.id). */
  threadId?: string | null | undefined;
  /** Help chat thread (help_threads.id), with source "help_chat". */
  helpThreadId?: string | null;
  source?: ProblemSource;
  text: string | null | undefined;
  languageHint?: string | null;
  now?: Date;
}): Promise<{ reportId: string; merged: boolean } | null> {
  try {
    if (!input.userId || !input.text) return null;
    const match = detectAppProblem(input.text);
    if (!match) return null;
    const now = input.now ?? new Date();
    const source: ProblemSource = input.source ?? "guide_session";
    const threadId = input.threadId ?? null;
    const helpThreadId = input.helpThreadId ?? null;
    // Same conversation = same guided session, or same help-chat thread.
    const convKey = source === "help_chat" ? `help:${helpThreadId ?? ""}` : threadId;
    const detail = match.category;
    const excerpt = problemExcerpt(input.text);
    const language = match.language ?? input.languageHint ?? null;
    await ensureSchemaReady();
    const pool = getPool();

    const { rows } = await pool.query<{
      id: string;
      user_id: string;
      thread_id: string | null;
      status: string;
      last_detected_at: Date;
      excerpt: string;
    }>(
      `SELECT id, user_id, thread_id, status, last_detected_at, excerpt FROM problem_reports
       WHERE user_id = $1 AND source = $2
         AND thread_id IS NOT DISTINCT FROM $3 AND help_thread_id IS NOT DISTINCT FROM $4
       ORDER BY last_detected_at DESC LIMIT 1`,
      [input.userId, source, threadId, helpThreadId]
    );
    const existing = rows[0];
    let reportId: string;
    let merged = false;
    if (
      existing &&
      shouldMergeProblemReport(
        {
          userId: existing.user_id,
          threadId: convKey,
          status: existing.status as ProblemReportStatus,
          lastDetectedAt: existing.last_detected_at,
        },
        { userId: input.userId, threadId: convKey, now }
      )
    ) {
      reportId = existing.id;
      merged = true;
      await pool.query(
        `UPDATE problem_reports
         SET excerpt = $2, hit_count = hit_count + 1, last_detected_at = $3, updated_at = $3,
             category = CASE WHEN category = 'other' THEN $4 ELSE category END,
             language = COALESCE(language, $5),
             events = events || $6::jsonb
         WHERE id = $1`,
        [
          reportId,
          mergeProblemExcerpt(existing.excerpt, input.text),
          now,
          match.category,
          language,
          JSON.stringify([problemEvent("merged", { now, detail })]),
        ]
      );
    } else {
      reportId = randomUUID();
      await pool.query(
        `INSERT INTO problem_reports
           (id, user_id, thread_id, excerpt, category, language, status, events, created_at, last_detected_at, updated_at, source, help_thread_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'new', $7::jsonb, $8, $8, $8, $9, $10)`,
        [
          reportId,
          input.userId,
          threadId,
          excerpt,
          match.category,
          language,
          JSON.stringify([problemEvent("detected", { now, detail })]),
          now,
          source,
          helpThreadId,
        ]
      );
    }
    console.info(`[problem-reports] ${merged ? "merged into" : "new"} report ${reportId} (${match.category})`);
    try {
      await maybeAlertAdmins(reportId, now);
    } catch (err) {
      console.error("[problem-reports] admin alert step failed", err);
    }
    return { reportId, merged };
  } catch (err) {
    console.error("[problem-reports] record failed", err);
    return null;
  }
}

/** Same error class as the shared win-back code, so routes catch one type. */
export const ProblemReportError = WinbackError;
export type ProblemReportError = WinbackError;

export async function setProblemReportStatus(input: {
  id: string;
  status: ProblemReportStatus;
  actorUserId: string;
}): Promise<ProblemReport> {
  const report = await getProblemReport(input.id);
  if (!report) throw new ProblemReportError("Report not found", 404);
  if (input.status === "winback_sent") {
    throw new ProblemReportError("Send the win-back email to finish a report");
  }
  if (!canTransitionProblemReport(report.status, input.status)) {
    throw new ProblemReportError(`Cannot move a ${report.status} report to ${input.status}`);
  }
  const { rowCount } = await getPool().query(
    `UPDATE problem_reports SET status = $3, updated_at = NOW(), events = events || $4::jsonb
     WHERE id = $1 AND status = $2`,
    [input.id, report.status, input.status, JSON.stringify([problemEvent(statusEventType(input.status), { by: input.actorUserId })])]
  );
  if (!rowCount) throw new ProblemReportError("The report changed meanwhile, reload", 409);
  return (await getProblemReport(input.id))!;
}

export async function setProblemReportNote(input: {
  id: string;
  note: string;
  actorUserId: string;
}): Promise<ProblemReport> {
  const note = input.note.trim().slice(0, PROBLEM_NOTE_MAX);
  const { rowCount } = await getPool().query(
    `UPDATE problem_reports SET admin_note = $2, updated_at = NOW(), events = events || $3::jsonb WHERE id = $1`,
    [input.id, note || null, JSON.stringify([problemEvent("note", { by: input.actorUserId, detail: note ? note.slice(0, 120) : "(cleared)" })])]
  );
  if (!rowCount) throw new ProblemReportError("Report not found", 404);
  return (await getProblemReport(input.id))!;
}

/**
 * New win-back link for a confirmed report through the existing reactivation
 * system (lib/reactivation.ts): one open link per person (a new one replaces
 * the unused old one) and no second link once one was redeemed.
 */
export async function generateProblemWinback(input: {
  id: string;
  actorUserId: string;
}): Promise<{ link: string; offer: ReactivationOffer; draft: WinbackEmailDraft; report: ProblemReport }> {
  const report = await getProblemReport(input.id);
  if (!report) throw new ProblemReportError("Report not found", 404);
  if (!canGenerateWinback(report.status)) {
    throw new ProblemReportError("Confirm the problem first");
  }
  if (report.winbackUsed) {
    throw new ProblemReportError("This person already redeemed a win-back month");
  }
  const { link, offer, draft } = await mintWinbackLink({
    userId: report.userId,
    actorUserId: input.actorUserId,
    source: "problem_report",
    problemReportId: report.id,
  });
  await appendEvent(
    report.id,
    problemEvent("link_generated", { by: input.actorUserId, detail: `Offer ${offer.id.slice(0, 8)}, ${offer.plan}, expires ${offer.expiresAt.slice(0, 10)}` }),
    ", reactivation_offer_id = $3",
    [offer.id]
  );
  return { link, offer, draft, report: (await getProblemReport(report.id))! };
}

/**
 * Send the (possibly edited) win-back email. Only on the admin's explicit
 * click. The body must still carry the link for this report's current offer.
 * The stored snapshot has the token redacted.
 */
export async function sendProblemWinbackEmail(input: {
  id: string;
  subject: unknown;
  body: unknown;
  actorUserId: string;
}): Promise<ProblemReport> {
  const report = await getProblemReport(input.id);
  if (!report) throw new ProblemReportError("Report not found", 404);
  if (report.status !== "confirmed") {
    throw new ProblemReportError(report.status === "winback_sent" ? "Already sent" : "Confirm the problem first");
  }
  if (!report.reactivationOfferId) throw new ProblemReportError("Generate the win-back link first");
  const prepared = await prepareWinbackEmail({
    userId: report.userId,
    subject: input.subject,
    body: input.body,
    expectedOfferId: report.reactivationOfferId,
  });
  // Claim the send so a double click cannot email twice.
  const claim = await getPool().query(
    `UPDATE problem_reports SET status = 'winback_sent', winback_email_sent_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'confirmed'`,
    [report.id]
  );
  if (!claim.rowCount) throw new ProblemReportError("Already sent", 409);
  let sent: Awaited<ReturnType<typeof deliverWinbackEmail>>;
  try {
    sent = await deliverWinbackEmail({ prepared, actorUserId: input.actorUserId, problemReportId: report.id });
  } catch (err) {
    await getPool().query(
      `UPDATE problem_reports SET status = 'confirmed', winback_email_sent_at = NULL, updated_at = NOW(), events = events || $2::jsonb WHERE id = $1`,
      [report.id, JSON.stringify([problemEvent("email_failed", { by: input.actorUserId, detail: err instanceof Error ? err.message.slice(0, 200) : "Send failed" })])]
    );
    throw err;
  }
  await getPool().query(
    `UPDATE problem_reports
     SET winback_email_to = $2, winback_email_subject = $3, winback_email_body = $4, updated_at = NOW(),
         events = events || $5::jsonb
     WHERE id = $1`,
    [
      report.id,
      prepared.to,
      prepared.subject,
      sent.redactedBody,
      JSON.stringify([problemEvent("email_sent", { by: input.actorUserId, detail: `To ${prepared.to}` })]),
    ]
  );
  return (await getProblemReport(report.id))!;
}
