import { ensureSchemaReady, getPool } from "@/lib/db";
import type { EmailTemplateId } from "@/lib/email/templates";
import {
  EMAIL_TEMPLATE_IDS,
  SCHEDULED_TEMPLATE_DELAY_HOURS,
  isScheduledTemplate,
} from "@/lib/email/template-labels";
import { renderEmailTemplate } from "@/lib/email/templates";
import { getPlatformSettings, getPublicAppUrl } from "@/lib/platform-settings";
import { BRAND_SUPPORT_EMAIL } from "@/lib/brand";

export type EmailTemplateRecord = {
  id: EmailTemplateId;
  subject: string;
  html: string;
  text: string;
  updatedAt: string;
  isCustom: boolean;
  /** False turns a scheduled template off without losing its copy. */
  enabled: boolean;
  /** Hours after the trigger; only scheduled templates have a value. */
  delayHours: number | null;
  /** True when this template is sent by a cron rather than an event. */
  scheduled: boolean;
};

/** What a template does before anyone edits it in Admin → Email. */
export function defaultTemplateAutomation(id: EmailTemplateId): {
  enabled: boolean;
  delayHours: number | null;
} {
  return {
    enabled: true,
    delayHours: SCHEDULED_TEMPLATE_DELAY_HOURS[id] ?? null,
  };
}

const ALL_TEMPLATE_IDS = EMAIL_TEMPLATE_IDS;

export async function ensureEmailTemplatesSchema() {
  await ensureSchemaReady();
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      html TEXT NOT NULL,
      text TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS delay_hours INTEGER;
  `);
}

function sampleData(id: EmailTemplateId) {
  const base = {
    name: "Alex",
    resetUrl: "https://example.com/reset",
    createPasswordUrl: "https://example.com/app/create-password",
    loginUrl: "https://example.com/app/login",
    expiresIn: "72 hours",
    supportEmail: BRAND_SUPPORT_EMAIL,
    homeUrl: "https://example.com/",
  };
  switch (id) {
    case "password_reset":
      return {
        name: base.name,
        resetUrl: base.resetUrl,
        expiresIn: base.expiresIn,
      };
    case "welcome_invite":
      return {
        name: base.name,
        createPasswordUrl: base.createPasswordUrl,
        expiresIn: base.expiresIn,
      };
    case "password_changed":
      return { name: base.name, loginUrl: base.loginUrl };
    case "welcome":
      return { name: base.name, loginUrl: base.loginUrl };
    case "account_deleted":
      return {
        name: base.name,
        supportEmail: base.supportEmail,
        homeUrl: base.homeUrl,
        billingNote: "Your subscription was canceled.",
      };
    case "payment_receipt":
      return {
        name: base.name,
        planLabel: "Monthly",
        amount: "$14.99",
        paidAt: "21 September 2026",
        manageBillingUrl: "https://example.com/app/billing",
        supportEmail: base.supportEmail,
      };
    case "trial_started":
      return {
        name: base.name,
        planLabel: "Monthly",
        amount: "$14.99",
        trialEndsAt: "October 22, 2026",
        manageBillingUrl: "https://example.com/app/billing",
        supportEmail: base.supportEmail,
      };
    case "payment_failed":
      return {
        name: base.name,
        amount: "$14.99",
        manageBillingUrl: "https://example.com/app/billing",
        supportEmail: base.supportEmail,
      };
    case "trial_charge_reminder":
      return {
        name: base.name,
        planLabel: "Monthly",
        amount: "$14.99",
        chargeDate: "October 22, 2026",
        manageBillingUrl: "https://example.com/app/billing",
      };
    case "trial_feedback":
      return {
        name: base.name,
        feedbackUrl: "https://example.com/review?t=example-preview-token-not-real",
      };
    case "post_trial_checkin":
      return {
        name: base.name,
        trialEndedOn: "12 October 2026",
        appUrl: "https://example.com/app",
        preferencesUrl: "https://example.com/app/settings",
      };
    case "subscription_canceled":
      return {
        name: base.name,
        accessEndsAt: "October 22, 2026",
        homeUrl: base.homeUrl,
        supportEmail: base.supportEmail,
        billingNote: "Your plan will not renew.",
        keepsAccess: false,
      };
    case "admin_signup":
      return {
        customerName: "Sam",
        customerEmail: "sam@example.com",
        source: "Google",
        adminUserUrl: "https://example.com/admin/users/u1",
      };
    case "admin_trial":
      return {
        customerName: "Sam",
        customerEmail: "sam@example.com",
        planLabel: "Weekly",
        amount: "$0",
        trialEndsAt: "October 22, 2026",
        mode: "Live",
        adminUserUrl: "https://example.com/admin/users/u1",
      };
    case "admin_payment":
      return {
        customerName: "Alex",
        customerEmail: "alex@example.com",
        planLabel: "Monthly",
        amount: "$14.99",
        paidAt: "September 21, 2026",
        adminUserUrl: "https://example.com/admin/users/u1",
      };
    case "admin_subscription_canceled":
      return {
        customerName: "Alex",
        customerEmail: "alex@example.com",
        planLabel: "Monthly",
        accessEndsAt: "October 22, 2026",
        keepsAccess: true,
        mode: "Live",
        headline: "Subscription cancel scheduled",
        adminUserUrl: "https://example.com/admin/users/u1",
      };
    case "admin_subscription_resumed":
      return {
        customerName: "Alex",
        customerEmail: "alex@example.com",
        planLabel: "Monthly",
        renewsAt: "October 22, 2026",
        mode: "Live",
        adminUserUrl: "https://example.com/admin/users/u1",
      };
  }
}

export async function getEmailTemplate(
  id: EmailTemplateId
): Promise<EmailTemplateRecord> {
  await ensureEmailTemplatesSchema();
  const { rows } = await getPool().query<{
    id: string;
    subject: string;
    html: string;
    text: string;
    updated_at: string;
    enabled: boolean;
    delay_hours: number | null;
  }>("SELECT * FROM email_templates WHERE id = $1", [id]);
  const defaults = defaultTemplateAutomation(id);

  if (rows[0]) {
    return {
      id,
      subject: rows[0].subject,
      html: rows[0].html,
      text: rows[0].text,
      updatedAt: new Date(rows[0].updated_at).toISOString(),
      isCustom: true,
      enabled: rows[0].enabled !== false,
      delayHours: rows[0].delay_hours ?? defaults.delayHours,
      scheduled: isScheduledTemplate(id),
    };
  }

  const platform = await getPlatformSettings();
  const rendered = renderEmailTemplate(
    id,
    sampleData(id) as never,
    platform.siteName,
    await getPublicAppUrl()
  );
  return {
    id,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    updatedAt: new Date().toISOString(),
    isCustom: false,
    enabled: defaults.enabled,
    delayHours: defaults.delayHours,
    scheduled: isScheduledTemplate(id),
  };
}

/**
 * Just the automation switch and the delay — no rendering.
 *
 * The cron calls this on every run, and rendering a 20 KB email to learn
 * whether it is switched on would be work for nothing.
 */
export async function getEmailTemplateAutomation(
  id: EmailTemplateId
): Promise<{ enabled: boolean; delayHours: number | null }> {
  await ensureEmailTemplatesSchema();
  const defaults = defaultTemplateAutomation(id);
  const { rows } = await getPool().query<{
    enabled: boolean;
    delay_hours: number | null;
  }>("SELECT enabled, delay_hours FROM email_templates WHERE id = $1", [id]);

  return {
    enabled: rows[0] ? rows[0].enabled !== false : defaults.enabled,
    delayHours: rows[0]?.delay_hours ?? defaults.delayHours,
  };
}

export async function listEmailTemplates(): Promise<EmailTemplateRecord[]> {
  return Promise.all(ALL_TEMPLATE_IDS.map((id) => getEmailTemplate(id)));
}

export async function saveEmailTemplate(
  id: EmailTemplateId,
  patch: {
    subject: string;
    html: string;
    text: string;
    enabled?: boolean;
    delayHours?: number | null;
  }
): Promise<EmailTemplateRecord> {
  await ensureEmailTemplatesSchema();
  const defaults = defaultTemplateAutomation(id);
  const enabled = patch.enabled ?? defaults.enabled;
  // Only a scheduled template keeps a delay; a transactional one stores null
  // so an accidental value cannot make it look schedulable in the admin.
  const delayHours = isScheduledTemplate(id)
    ? patch.delayHours ?? defaults.delayHours
    : null;

  await getPool().query(
    `INSERT INTO email_templates (id, subject, html, text, enabled, delay_hours, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (id) DO UPDATE SET
       subject = EXCLUDED.subject,
       html = EXCLUDED.html,
       text = EXCLUDED.text,
       enabled = EXCLUDED.enabled,
       delay_hours = EXCLUDED.delay_hours,
       updated_at = NOW()`,
    [id, patch.subject.trim(), patch.html, patch.text, enabled, delayHours]
  );
  return getEmailTemplate(id);
}

export async function renderStoredTemplate<T extends EmailTemplateId>(
  id: T,
  data: import("@/lib/email/templates").EmailTemplateData[T]
): Promise<{ subject: string; html: string; text: string }> {
  const stored = await getEmailTemplate(id);
  if (stored.isCustom) {
    return {
      subject: interpolate(stored.subject, data),
      html: interpolate(stored.html, data),
      text: interpolate(stored.text, data),
    };
  }
  const platform = await getPlatformSettings();
  return renderEmailTemplate(id, data, platform.siteName, await getPublicAppUrl());
}

function interpolate(template: string, data: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => data[key] ?? "");
}
