import { getPool } from "@/lib/db";
import { getEmailConfig } from "@/lib/email/status";
import { getResolvedBrevoApiKey } from "@/lib/email/status";
import { markBrevoContactSynced } from "@/lib/marketing-email-preference";
import { getUserById } from "@/lib/users";
import { getSubscriptionByUserId } from "@/lib/stripe-admin";

export type BrevoContactInput = {
  email: string;
  name?: string | null;
  attributes: Record<string, string | boolean>;
  listIds: number[];
  unlinkListIds?: number[];
};

export function parseBrevoListId(raw: string | null | undefined): number | null {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function resolvedMarketingListId(): Promise<number | null> {
  const cfg = await getEmailConfig();
  return parseBrevoListId(cfg.brevoMarketingListId);
}

export async function upsertBrevoMarketingContact(
  input: BrevoContactInput
): Promise<void> {
  const apiKey = await getResolvedBrevoApiKey();
  if (!apiKey) return;
  const payload: Record<string, unknown> = {
    email: input.email.trim().toLowerCase(),
    updateEnabled: true,
    attributes: {
      ...input.attributes,
      ...(input.name?.trim() ? { FIRSTNAME: input.name.trim() } : {}),
    },
  };
  if (input.listIds.length) payload.listIds = input.listIds;
  if (input.unlinkListIds?.length) payload.unlinkListIds = input.unlinkListIds;

  const res = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo contact sync failed (${res.status}): ${body}`);
  }
}

export async function syncBrevoContactForUser(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user?.email) return;
  const listId = await resolvedMarketingListId();
  const listIds = listId ? [listId] : [];
  if (!user.marketingEmailOptIn) {
    if (!user.brevoContactSyncedAt || !listIds.length) return;
    await upsertBrevoMarketingContact({
      email: user.email,
      name: user.name,
      attributes: { NURA_USER_ID: user.id, MARKETING_OPT_IN: false },
      listIds: [],
      unlinkListIds: listIds,
    });
    return;
  }

  const sub = await getSubscriptionByUserId(userId);
  await upsertBrevoMarketingContact({
    email: user.email,
    name: user.name,
    listIds,
    attributes: {
      NURA_USER_ID: user.id,
      NURA_ACCOUNT: true,
      MARKETING_OPT_IN: true,
      PLAN: sub?.plan ?? "",
      SUB_STATUS: sub?.status ?? "",
      TRIAL_ENDS_AT: sub?.trial_ends_at
        ? new Date(sub.trial_ends_at).toISOString()
        : "",
      OPT_IN_SOURCE: "account",
      OPT_IN_AT: user.marketingEmailOptInAt ?? new Date().toISOString(),
    },
  });
  await markBrevoContactSynced(userId);
}

export async function removeBrevoContact(email: string): Promise<void> {
  const apiKey = await getResolvedBrevoApiKey();
  if (!apiKey) return;
  const encoded = encodeURIComponent(email.trim().toLowerCase());
  const res = await fetch(`https://api.brevo.com/v3/contacts/${encoded}`, {
    method: "DELETE",
    headers: { "api-key": apiKey, Accept: "application/json" },
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Brevo contact delete failed (${res.status}): ${body}`);
  }
}

export async function countMarketingOptIns(): Promise<{
  users: number;
  leads: number;
}> {
  const users = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM users WHERE marketing_email_opt_in = TRUE`
  );
  const leads = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM newsletter_leads WHERE opted_out_at IS NULL`
  );
  return {
    users: Number(users.rows[0]?.count ?? 0),
    leads: Number(leads.rows[0]?.count ?? 0),
  };
}
