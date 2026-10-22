import { ensureSchemaReady, getPool } from "@/lib/db";
import { sqlUserCountsInStats } from "@/lib/stats-scope";
import { ensureFeedbackSchema } from "@/lib/feedback-db";
import {
  formatActivityBilling,
  formatActivityFeedback,
  formatActivitySignup,
  type AdminActivityItem,
} from "@/lib/admin-activity-format";

const PER_SOURCE = 8;

export async function listAdminActivity(limit = 12): Promise<AdminActivityItem[]> {
  await ensureSchemaReady();
  await ensureFeedbackSchema();
  const pool = getPool();
  const capped = Math.min(40, Math.max(1, limit));

  const [signups, billing, feedback] = await Promise.all([
    pool.query<{
      id: string;
      created_at: string;
      detail: { source?: string } | null;
      user_id: string;
      email: string;
      name: string | null;
      has_google: boolean;
      plan: string | null;
    }>(
      `SELECT e.id, e.created_at, e.detail,
              u.id AS user_id, u.email, u.name,
              (u.google_sub IS NOT NULL) AS has_google,
              s.plan
       FROM audit_events e
       JOIN users u ON u.id = e.target_user_id
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE e.action = 'user.created'
         AND ${sqlUserCountsInStats("u")}
       ORDER BY e.created_at DESC
       LIMIT $1`,
      [PER_SOURCE]
    ),
    pool.query<{
      id: string;
      occurred_at: string;
      status: string;
      amount_cents: number;
      currency: string;
      livemode: boolean | null;
      user_id: string;
      email: string;
      name: string | null;
      plan: string | null;
      trial_ends_at: string | null;
      description: string | null;
    }>(
      `SELECT be.id, be.occurred_at, be.status, be.amount_cents, be.currency, be.livemode,
              be.description,
              u.id AS user_id, u.email, u.name,
              COALESCE(s.plan, NULL) AS plan,
              s.trial_ends_at
       FROM billing_events be
       JOIN users u ON u.id = be.user_id
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE ${sqlUserCountsInStats("u")}
       ORDER BY be.occurred_at DESC
       LIMIT $1`,
      [PER_SOURCE]
    ),
    pool.query<{
      id: string;
      created_at: string;
      score: number;
      kind: string;
      source: string;
      email: string;
      name: string | null;
    }>(
      `SELECT f.id, f.created_at, f.score, f.kind, f.source,
              u.email, u.name
       FROM feedback_responses f
       JOIN users u ON u.id = f.user_id
       WHERE ${sqlUserCountsInStats("u")}
       ORDER BY f.created_at DESC
       LIMIT $1`,
      [PER_SOURCE]
    ),
  ]);

  const items: AdminActivityItem[] = [
    ...signups.rows.map((row) => {
      const copy = formatActivitySignup({
        name: row.name,
        email: row.email,
        source: row.detail?.source ?? null,
        hasGoogle: row.has_google,
        plan: row.plan,
      });
      return {
        id: `signup:${row.id}`,
        kind: "signup" as const,
        title: copy.title,
        detail: copy.detail,
        href: `/admin/users/${row.user_id}`,
        at: new Date(row.created_at).toISOString(),
      };
    }),
    ...billing.rows.map((row) => {
      const copy = formatActivityBilling({
        name: row.name,
        email: row.email,
        plan: row.plan,
        amountCents: row.amount_cents,
        currency: row.currency,
        status: row.status,
        livemode: row.livemode,
        trialEndsAt: row.trial_ends_at,
        accessEndsAt: row.description,
      });
      return {
        id: `billing:${row.id}`,
        kind: "billing" as const,
        title: copy.title,
        detail: copy.detail,
        href: `/admin/users/${row.user_id}`,
        at: new Date(row.occurred_at).toISOString(),
      };
    }),
    ...feedback.rows.map((row) => {
      const copy = formatActivityFeedback({
        name: row.name,
        email: row.email,
        score: Number(row.score),
        kind: row.kind === "review" ? "review" : "feedback",
        source: row.source,
      });
      return {
        id: `feedback:${row.id}`,
        kind: "feedback" as const,
        title: copy.title,
        detail: copy.detail,
        href: `/admin/feedback?id=${row.id}`,
        at: new Date(row.created_at).toISOString(),
      };
    }),
  ];

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return items.slice(0, capped);
}
