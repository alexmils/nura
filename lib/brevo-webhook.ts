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
]);

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
  return OPT_OUT_EVENTS.has((event ?? "").toLowerCase());
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
