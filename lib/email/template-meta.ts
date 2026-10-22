/**
 * How the admin presents each email: which shelf it belongs on, who opens it,
 * what it is for, and which tokens its copy may use.
 *
 * Kept apart from the ids and labels so the list a sender iterates stays small,
 * and so this prose never lands in a mail bundle.
 */

import type { EmailTemplateId } from "./template-labels";

export type EmailTemplateGroup =
  | "Account"
  | "Trial"
  | "Feedback"
  | "Billing"
  | "Admin";

export const EMAIL_TEMPLATE_GROUP_ORDER: readonly EmailTemplateGroup[] = [
  "Account",
  "Trial",
  "Feedback",
  "Billing",
  "Admin",
];

export const EMAIL_TEMPLATE_GROUP: Record<EmailTemplateId, EmailTemplateGroup> = {
  password_reset: "Account",
  welcome_invite: "Account",
  password_changed: "Account",
  welcome: "Account",
  account_deleted: "Account",
  payment_receipt: "Billing",
  payment_failed: "Billing",
  subscription_canceled: "Billing",
  trial_started: "Trial",
  trial_charge_reminder: "Trial",
  trial_feedback: "Feedback",
  post_trial_checkin: "Trial",
  admin_signup: "Admin",
  admin_trial: "Admin",
  admin_payment: "Admin",
  admin_subscription_canceled: "Admin",
  admin_subscription_resumed: "Admin",
  admin_feedback: "Admin",
};

export const EMAIL_TEMPLATE_DESCRIPTION: Record<EmailTemplateId, string> = {
  password_reset:
    "A reset link, sent when someone asks for one from the sign-in screen.",
  welcome_invite:
    "The invite an admin sends so a new member can choose a password.",
  password_changed:
    "A confirmation after a password change, with a way back in.",
  welcome:
    "The first mail after an account is created.",
  account_deleted:
    "Confirmation that the account and its session data are gone.",
  payment_receipt:
    "The receipt for the first real charge on a subscription.",
  payment_failed:
    "Asks for a new card when a charge does not go through.",
  subscription_canceled:
    "Confirms a cancellation and says when access ends.",
  trial_started:
    "Confirms the trial and the date of the first charge.",
  trial_charge_reminder:
    "A reminder about two days before the trial's first charge.",
  trial_feedback:
    "A five-row star prompt and a link to the feedback form, sent one month after the trial so the member has had time to use Nura. The stars are visual — every one opens the same form, where the score and note are stored. Change the days in Scheduled send.",
  post_trial_checkin:
    "One check-in after the first app use following the trial. Sent by the post-trial cron after the delay below.",
  admin_signup:
    "Tells the platform admin that a new account was created.",
  admin_trial:
    "Tells the platform admin that a trial started.",
  admin_payment:
    "Tells the platform admin that a payment landed.",
  admin_subscription_canceled:
    "Tells the platform admin that a subscription was canceled or scheduled to cancel.",
  admin_subscription_resumed:
    "Tells the platform admin that a cancellation was undone.",
  admin_feedback:
    "Tells the platform admin that a member left feedback or a review, with the score and the full note.",
};

export type EmailTemplatePlaceholder = {
  token: string;
  description: string;
};

/** What the scheduled delay counts from, in the admin's words. */
export const EMAIL_TEMPLATE_SCHEDULE_HINT: Partial<
  Record<EmailTemplateId, string>
> = {
  trial_feedback: "Counted from the day the trial ended. 30 is one month.",
  post_trial_checkin:
    "Counted from the first app use after the trial date. The default is 3 days.",
};

export const EMAIL_TEMPLATE_PLACEHOLDERS: Record<
  EmailTemplateId,
  EmailTemplatePlaceholder[]
> = {
  password_reset: [
    { token: "name", description: "Member's name, or the part before the @" },
    { token: "resetUrl", description: "The password reset link" },
    { token: "expiresIn", description: "How long the link stays valid" },
  ],
  welcome_invite: [
    { token: "name", description: "Member's name" },
    { token: "createPasswordUrl", description: "The create-password link" },
    { token: "expiresIn", description: "How long the link stays valid" },
  ],
  password_changed: [
    { token: "name", description: "Member's name" },
    { token: "loginUrl", description: "Sign-in link" },
  ],
  welcome: [
    { token: "name", description: "Member's name" },
    { token: "loginUrl", description: "Sign-in link" },
  ],
  account_deleted: [
    { token: "name", description: "Member's name" },
    { token: "supportEmail", description: "Support address" },
    { token: "homeUrl", description: "Public site link" },
    { token: "billingNote", description: "Sentence about the subscription outcome" },
  ],
  payment_receipt: [
    { token: "name", description: "Member's name" },
    { token: "planLabel", description: "Plan as the customer knows it" },
    { token: "amount", description: "Formatted amount, e.g. $14.99" },
    { token: "paidAt", description: "Charge date" },
    { token: "manageBillingUrl", description: "Billing page link" },
    { token: "supportEmail", description: "Support address" },
  ],
  payment_failed: [
    { token: "name", description: "Member's name" },
    { token: "amount", description: "Formatted amount" },
    { token: "manageBillingUrl", description: "Billing page link" },
    { token: "supportEmail", description: "Support address" },
  ],
  subscription_canceled: [
    { token: "name", description: "Member's name" },
    { token: "accessEndsAt", description: "Last day of access" },
    { token: "homeUrl", description: "Public site link" },
    { token: "supportEmail", description: "Support address" },
    { token: "billingNote", description: "Sentence about the cancellation" },
    { token: "keepsAccess", description: "true while the paid period is still open" },
  ],
  trial_started: [
    { token: "name", description: "Member's name" },
    { token: "planLabel", description: "Plan as the customer knows it" },
    { token: "amount", description: "First charge, formatted" },
    { token: "trialEndsAt", description: "Trial end date" },
    { token: "manageBillingUrl", description: "Billing page link" },
    { token: "supportEmail", description: "Support address" },
  ],
  trial_charge_reminder: [
    { token: "name", description: "Member's name" },
    { token: "planLabel", description: "Plan as the customer knows it" },
    { token: "amount", description: "First charge, formatted" },
    { token: "chargeDate", description: "Date of the first charge" },
    { token: "manageBillingUrl", description: "Billing page link" },
  ],
  trial_feedback: [
    { token: "name", description: "Member's name" },
    { token: "feedbackUrl", description: "One-use review link, with its token" },
  ],
  post_trial_checkin: [
    { token: "name", description: "Member's name" },
    { token: "trialEndedOn", description: "Date the trial ended" },
    { token: "appUrl", description: "The app's home screen" },
    { token: "preferencesUrl", description: "Email settings link" },
  ],
  admin_signup: [
    { token: "customerName", description: "New member's name" },
    { token: "customerEmail", description: "New member's email" },
    { token: "source", description: "How they signed up" },
    { token: "adminUserUrl", description: "The member in admin" },
  ],
  admin_trial: [
    { token: "customerName", description: "Member's name" },
    { token: "customerEmail", description: "Member's email" },
    { token: "planLabel", description: "Plan label" },
    { token: "amount", description: "First charge, formatted" },
    { token: "trialEndsAt", description: "Trial end date" },
    { token: "mode", description: "Demo or live" },
    { token: "adminUserUrl", description: "The member in admin" },
  ],
  admin_payment: [
    { token: "customerName", description: "Member's name" },
    { token: "customerEmail", description: "Member's email" },
    { token: "planLabel", description: "Plan label" },
    { token: "amount", description: "Amount, formatted" },
    { token: "paidAt", description: "Charge date" },
    { token: "adminUserUrl", description: "The member in admin" },
  ],
  admin_subscription_canceled: [
    { token: "customerName", description: "Member's name" },
    { token: "customerEmail", description: "Member's email" },
    { token: "planLabel", description: "Plan label" },
    { token: "accessEndsAt", description: "Last day of access" },
    { token: "keepsAccess", description: "true while the paid period is still open" },
    { token: "mode", description: "Demo or live" },
    { token: "headline", description: "Headline for the mail" },
    { token: "adminUserUrl", description: "The member in admin" },
  ],
  admin_subscription_resumed: [
    { token: "customerName", description: "Member's name" },
    { token: "customerEmail", description: "Member's email" },
    { token: "planLabel", description: "Plan label" },
    { token: "renewsAt", description: "Next renewal date" },
    { token: "mode", description: "Demo or live" },
    { token: "adminUserUrl", description: "The member in admin" },
  ],
  admin_feedback: [
    { token: "customerName", description: "Member's name" },
    { token: "customerEmail", description: "Member's email" },
    { token: "score", description: "Score, e.g. 9/10" },
    { token: "kindLabel", description: "review or feedback" },
    { token: "source", description: "Where it came from" },
    { token: "comment", description: "The full note" },
    { token: "adminFeedbackUrl", description: "The item in Admin → Feedback" },
  ],
};
