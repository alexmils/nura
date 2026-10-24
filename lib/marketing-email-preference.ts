import { getPool } from "@/lib/db";
import { recordConsent } from "@/lib/consents";
import { LEGAL_DOC_VERSION } from "@/lib/legal-entity";
import { getUserById, type User } from "@/lib/users";

export type MarketingEmailSource =
  | "signup"
  | "onboarding"
  | "settings"
  | "brevo_webhook";

export async function setMarketingEmailPreference(input: {
  userId: string;
  optedIn: boolean;
  source: MarketingEmailSource;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<User | null> {
  await getPool().query(
    `UPDATE users SET
       marketing_email_opt_in = $2,
       marketing_email_opt_in_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
       -- A fresh opt-in is the user overriding an earlier hard bounce.
       marketing_email_bounced_at = CASE WHEN $2 THEN NULL ELSE marketing_email_bounced_at END,
       updated_at = NOW()
     WHERE id = $1`,
    [input.userId, input.optedIn]
  );
  await recordConsent({
    userId: input.userId,
    docType: "marketing_email",
    docVersion: LEGAL_DOC_VERSION.marketing_email,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    detail: { optedIn: input.optedIn, source: input.source },
  });
  return getUserById(input.userId);
}

export async function markBrevoContactSynced(userId: string): Promise<void> {
  await getPool().query(
    `UPDATE users SET brevo_contact_synced_at = NOW() WHERE id = $1`,
    [userId]
  );
}
