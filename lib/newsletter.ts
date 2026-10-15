import { randomUUID } from "crypto";
import { getPool, ensureSchemaReady } from "@/lib/db";
import {
  resolvedMarketingListId,
  upsertBrevoMarketingContact,
} from "@/lib/email/brevo-contacts";
import { hashIp, isGuestEmailValid } from "@/lib/help-visitor-core";
import { getUserByEmail } from "@/lib/users";

const HOUR_LIMIT = 8;

export type NewsletterResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function subscribeNewsletter(input: {
  email: string;
  marketingEmailOptIn: boolean;
  ip: string | null;
}): Promise<NewsletterResult> {
  if (input.marketingEmailOptIn !== true) {
    return {
      ok: false,
      status: 400,
      error: "Check the box to get product news by email.",
    };
  }
  if (!isGuestEmailValid(input.email)) {
    return { ok: false, status: 400, error: "Enter a valid email." };
  }
  const email = input.email.trim().toLowerCase();
  await ensureSchemaReady();
  const ipHash = hashIp(input.ip);
  if (ipHash) {
    const recent = await getPool().query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM newsletter_attempts
       WHERE ip_hash = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [ipHash]
    );
    if (Number(recent.rows[0]?.count ?? 0) >= HOUR_LIMIT) {
      return { ok: false, status: 429, error: "Too many tries. Try again later." };
    }
    await getPool().query(
      `INSERT INTO newsletter_attempts (id, ip_hash) VALUES ($1, $2)`,
      [randomUUID(), ipHash]
    );
  }

  const user = await getUserByEmail(email);
  if (user) return { ok: true };

  const existing = await getPool().query<{
    opted_out_at: Date | null;
    brevo_synced_at: Date | null;
  }>(
    `SELECT opted_out_at, brevo_synced_at FROM newsletter_leads WHERE email = $1`,
    [email]
  );
  if (existing.rows[0] && !existing.rows[0].opted_out_at && existing.rows[0].brevo_synced_at) {
    return { ok: true };
  }

  await getPool().query(
    `INSERT INTO newsletter_leads (email, opted_in_at, opted_out_at, ip_hash, source)
     VALUES ($1, NOW(), NULL, $2, 'footer')
     ON CONFLICT (email) DO UPDATE SET
       opted_in_at = NOW(),
       opted_out_at = NULL,
       ip_hash = EXCLUDED.ip_hash,
       source = 'footer'`,
    [email, ipHash]
  );

  const listId = await resolvedMarketingListId();
  try {
    await upsertBrevoMarketingContact({
      email,
      listIds: listId ? [listId] : [],
      attributes: {
        NURA_ACCOUNT: false,
        MARKETING_OPT_IN: true,
        OPT_IN_SOURCE: "footer",
        OPT_IN_AT: new Date().toISOString(),
      },
    });
    await getPool().query(
      `UPDATE newsletter_leads SET brevo_synced_at = NOW() WHERE email = $1`,
      [email]
    );
  } catch (err) {
    console.error("[newsletter] Brevo", err);
    return {
      ok: false,
      status: 503,
      error: "Could not subscribe. Try again.",
    };
  }
  return { ok: true };
}
