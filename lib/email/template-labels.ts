/**
 * The single list of email templates.
 *
 * `EmailTemplateId` is derived from it, so adding a template here is the only
 * edit needed: the admin list, the admin test send, the template route, and the
 * store all read this array instead of keeping a copy that can drift.
 */
export const EMAIL_TEMPLATE_IDS = [
  "password_reset",
  "welcome_invite",
  "password_changed",
  "welcome",
  "account_deleted",
  "payment_receipt",
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export function isEmailTemplateId(value: unknown): value is EmailTemplateId {
  return (
    typeof value === "string" &&
    (EMAIL_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

/** Admin-facing names — never show snake_case ids in UI. */
export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateId, string> = {
  password_reset: "Reset password",
  welcome_invite: "Invite",
  password_changed: "Password changed",
  welcome: "Welcome",
  account_deleted: "Account deleted",
  payment_receipt: "Purchase receipt",
};

export function emailTemplateLabel(id: string): string {
  return EMAIL_TEMPLATE_LABELS[id as EmailTemplateId] ?? id;
}

/** Keep the current pick unless it disappeared from the fetched list. */
export function keepEmailTemplateId(
  selected: string,
  ids: readonly string[]
): string {
  return ids.includes(selected) ? selected : (ids[0] ?? selected);
}
