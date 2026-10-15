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
  "trial_started",
  "payment_failed",
  "trial_charge_reminder",
  "subscription_canceled",
  "admin_signup",
  "admin_trial",
  "admin_payment",
  "admin_subscription_canceled",
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

/** Who receives the mail. Admin rows go to the platform operator. */
export type EmailTemplateAudience = "customer" | "admin";

export const EMAIL_TEMPLATE_AUDIENCE: Record<EmailTemplateId, EmailTemplateAudience> = {
  password_reset: "customer",
  welcome_invite: "customer",
  password_changed: "customer",
  welcome: "customer",
  account_deleted: "customer",
  payment_receipt: "customer",
  trial_started: "customer",
  payment_failed: "customer",
  trial_charge_reminder: "customer",
  subscription_canceled: "customer",
  admin_signup: "admin",
  admin_trial: "admin",
  admin_payment: "admin",
  admin_subscription_canceled: "admin",
};

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
  trial_started: "Trial confirmation",
  payment_failed: "Payment failed",
  trial_charge_reminder: "Charge reminder",
  subscription_canceled: "Subscription canceled",
  admin_signup: "New account",
  admin_trial: "Trial started",
  admin_payment: "Payment received",
  admin_subscription_canceled: "Subscription canceled",
};

/** Log filter. User is customer mail plus broadcasts. */
export type EmailLogAudience = "user" | "admin";

export function emailLogTemplateIds(audience: EmailLogAudience): string[] {
  if (audience === "admin") {
    return EMAIL_TEMPLATE_IDS.filter((id) => EMAIL_TEMPLATE_AUDIENCE[id] === "admin");
  }
  return [
    ...EMAIL_TEMPLATE_IDS.filter((id) => EMAIL_TEMPLATE_AUDIENCE[id] === "customer"),
    "broadcast",
  ];
}

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
