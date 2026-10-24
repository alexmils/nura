import { getPool, ensureSchemaReady } from "@/lib/db";
import { setMarketingEmailPreference } from "@/lib/marketing-email-preference";
import { getUserByEmail } from "@/lib/users";

export type BrevoWebhookEvent = {
  event?: string;
  email?: string;
};

const OPT_OUT_EVENTS = new Set([
  "unsubscribed",
  "contact_deleted",
  "unsubscribe",
  // A spam complaint is a withdrawal of consent even without the link click.
  "spam",
]);

// A hard bounce means the mailbox does not exist. Keep mailing it and the
// sender reputation takes the hit, so suppress the address instead.
const BOUNCE_EVENTS = new Set(["hard_bounce"]);

function normalizeEvent(event: string | undefined): string {
  return (event ?? "").trim().toLowerCase().replace(/-/g, "_");
}

export function brevoWebhookAuthorized(
  request: Request,
  secret: string | undefined
): boolean {
  const expected = secret?.trim();
  if (!expected) return false;
  const header = request.headers.get("x-brevo-secret")?.trim();
  if (header && header === expected) return true;
  const auth = request.headers.get("authorization")?.trim();
  return auth === `Bearer ${expected}`;
}

export function brevoEventsFromBody(body: unknown): BrevoWebhookEvent[] {
  if (Array.isArray(body)) {
    return body.filter((row) => row && typeof row === "object") as BrevoWebhookEvent[];
  }
  if (body && typeof body === "object") return [body as BrevoWebhookEvent];
  return [];
}

export function isBrevoOptOutEvent(event: string | undefined): boolean {
  return OPT_OUT_EVENTS.has(normalizeEvent(event));
}

export function isBrevoBounceEvent(event: string | undefined): boolean {
  return BOUNCE_EVENTS.has(normalizeEvent(event));
}

export async function applyBrevoOptOut(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  await ensureSchemaReady();
  const user = await getUserByEmail(normalized);
  if (user?.marketingEmailOptIn) {
    await setMarketingEmailPreference({
      userId: user.id,
      optedIn: false,
      source: "brevo_webhook",
    });
  }
  await getPool().query(
    `UPDATE newsletter_leads SET opted_out_at = NOW() WHERE email = $1`,
    [normalized]
  );
}

/**
 * Records a hard bounce. The opt-in flag stays as the user set it; the bounce
 * timestamp is what suppresses the address and keeps it out of the Brevo list
 * on the next sync. An explicit opt-in clears it again.
 */
export async function applyBrevoBounce(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  await ensureSchemaReady();
  const user = await getUserByEmail(normalized);
  if (user) {
    await getPool().query(
      `UPDATE users SET marketing_email_bounced_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );
  }
  await getPool().query(
    `UPDATE newsletter_leads SET bounced_at = NOW() WHERE email = $1`,
    [normalized]
  );
}
