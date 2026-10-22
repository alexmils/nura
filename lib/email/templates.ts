import { BRAND_COLORS, BRAND_SPOKEN, chromeBrandName } from "@/lib/brand";
import { EMAIL_LOGO_WIDTH, emailLogoSrcForOrigin } from "@/lib/brand-assets";
import { reviewStars } from "@/lib/email/review-stars";
import type { EmailTemplateId } from "@/lib/email/template-labels";

export type { EmailTemplateId } from "@/lib/email/template-labels";

export type EmailTemplateData = {
  password_reset: {
    name: string;
    resetUrl: string;
    expiresIn: string;
  };
  welcome_invite: {
    name: string;
    createPasswordUrl: string;
    expiresIn: string;
  };
  password_changed: {
    name: string;
    loginUrl: string;
  };
  welcome: {
    name: string;
    loginUrl: string;
  };
  account_deleted: {
    name: string;
    supportEmail: string;
    homeUrl: string;
    /** Pre-built sentence about subscription cancel outcome */
    billingNote: string;
  };
  payment_receipt: {
    name: string;
    /** Plan as the customer knows it, e.g. "Monthly". */
    planLabel: string;
    /** Already formatted for the recipient, e.g. "$14.99". */
    amount: string;
    paidAt: string;
    manageBillingUrl: string;
    supportEmail: string;
  };
  trial_started: {
    name: string;
    planLabel: string;
    amount: string;
    trialEndsAt: string;
    manageBillingUrl: string;
    supportEmail: string;
  };
  payment_failed: {
    name: string;
    amount: string;
    manageBillingUrl: string;
    supportEmail: string;
  };
  trial_charge_reminder: {
    name: string;
    planLabel: string;
    amount: string;
    chargeDate: string;
    manageBillingUrl: string;
  };
  trial_feedback: {
    name: string;
    feedbackUrl: string;
  };
  post_trial_checkin: {
    name: string;
    trialEndedOn: string;
    appUrl: string;
    preferencesUrl: string;
  };
  subscription_canceled: {
    name: string;
    accessEndsAt: string;
    homeUrl: string;
    supportEmail: string;
    billingNote: string;
    /** True while the paid period is still open. */
    keepsAccess: boolean;
  };
  admin_signup: {
    customerName: string;
    customerEmail: string;
    source: string;
    adminUserUrl: string;
  };
  admin_trial: {
    customerName: string;
    customerEmail: string;
    planLabel: string;
    amount: string;
    trialEndsAt: string;
    mode: string;
    adminUserUrl: string;
  };
  admin_payment: {
    customerName: string;
    customerEmail: string;
    planLabel: string;
    amount: string;
    paidAt: string;
    adminUserUrl: string;
  };
  admin_subscription_canceled: {
    customerName: string;
    customerEmail: string;
    planLabel: string;
    accessEndsAt: string;
    keepsAccess: boolean;
    mode: string;
    headline: string;
    adminUserUrl: string;
  };
  admin_subscription_resumed: {
    customerName: string;
    customerEmail: string;
    planLabel: string;
    renewsAt: string;
    mode: string;
    adminUserUrl: string;
  };
  admin_feedback: {
    customerName: string;
    customerEmail: string;
    score: string;
    kindLabel: string;
    source: string;
    comment: string;
    adminFeedbackUrl: string;
  };
};

const brandColor = BRAND_COLORS.action;
const mutedColor = BRAND_COLORS.olive;
const inkColor = BRAND_COLORS.ink;
const pageBg = "#EDF9ED";
const cardBg = "#F7FDF7";
const borderColor = "#5F8A4C";

type EmailBrand = {
  name: string;
  /** Absolute origin for links and the logo; empty → plain-text wordmark. */
  url: string;
};

/**
 * Header brand: the real lockup, linked to the site.
 *
 * Email clients need an absolute `src`, which is why the origin is passed down
 * from the caller. `alt` carries the name so a client with images blocked still
 * shows who the mail is from, and explicit width/height stop the layout from
 * jumping while the image loads.
 */
function brandHeader(brand: EmailBrand): string {
  // Total, because this header is reachable from the admin template list: an
  // exception here returns a 500 that hides every template. `chromeBrandName`
  // is the same normalisation the rest of the app applies to a display name, so
  // a missing or retired name lands on the brand instead of on a stack trace.
  const safeName = escapeEmailHtml(chromeBrandName(brand.name));
  const origin =
    typeof brand.url === "string" ? brand.url.replace(/\/$/, "") : "";
  if (!origin) {
    return `<p style="margin:0 0 8px;font-size:13px;font-weight:500;color:${mutedColor};">${safeName}</p>`;
  }
  const height = Math.round((EMAIL_LOGO_WIDTH * 363) / 1600);
  const logoSrc = emailLogoSrcForOrigin(origin);
  // Full-width row so the title starts under the logo. A shrink-wrapped
  // left-aligned table lets the heading sit beside the image.
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td align="left" style="padding:0 0 20px;">
                    <a href="${origin}" style="display:block;text-decoration:none;border:0;">
                      <img src="${logoSrc}" alt="${safeName}" width="${EMAIL_LOGO_WIDTH}" height="${height}" style="display:block;width:${EMAIL_LOGO_WIDTH}px;max-width:${EMAIL_LOGO_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;" />
                    </a>
                  </td>
                </tr>
              </table>`;
}

function layout(
  brand: EmailBrand,
  title: string,
  body: string,
  footer = "If you didn't request this email, you can safely ignore it."
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${pageBg};font-family:'Source Sans 3','Segoe UI',system-ui,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${pageBg};padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:${cardBg};border-radius:8px;border:1px solid ${borderColor};overflow:hidden;">
          <tr>
            <td style="padding:36px 32px 12px;">
              ${brandHeader(brand)}
              <h1 style="margin:0 0 22px;font-size:22px;font-weight:500;color:${inkColor};letter-spacing:-0.018em;font-family:Georgia,serif;">${title}</h1>
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 30px;border-top:1px solid ${borderColor};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${mutedColor};">
                ${footer}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<p style="margin:28px 0;">
  <a href="${href}" style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;">${label}</a>
</p>`;
}

/** Total on purpose: a missing value must degrade, never throw mid-render. */
function escapeEmailHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderEmailTemplate<T extends EmailTemplateId>(
  id: T,
  data: EmailTemplateData[T],
  siteName = BRAND_SPOKEN,
  /** Public origin — the logo and its link need an absolute URL. */
  siteUrl = ""
): { subject: string; html: string; text: string } {
  // Normalised once here so every path below can assume a usable name.
  const brand: EmailBrand = {
    name: chromeBrandName(siteName),
    url: (typeof siteUrl === "string" ? siteUrl : "").replace(/\/$/, ""),
  };
  switch (id) {
    case "password_reset": {
      const d = data as EmailTemplateData["password_reset"];
      const subject = "Reset your password";
      const text = `Hi ${d.name},\n\nReset your password: ${d.resetUrl}\n\nThis link expires in ${d.expiresIn}.`;
      const html = layout(
        brand,
        "Reset your password",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Hi ${d.name},</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">We received a request to reset your password. Use the button below to choose a new one.</p>
         ${ctaButton(d.resetUrl, "Reset password")}
         <p style="margin:0;font-size:13px;line-height:1.5;color:${mutedColor};">This link expires in ${d.expiresIn}.</p>`
      );
      return { subject, html, text };
    }
    case "welcome_invite": {
      const d = data as EmailTemplateData["welcome_invite"];
      const subject = `You're invited to ${siteName}`;
      const text = `Hi ${d.name},\n\nCreate your password: ${d.createPasswordUrl}\n\nThis link expires in ${d.expiresIn}.`;
      const html = layout(
        brand,
        "Create your password",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Hi ${d.name},</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">You've been invited to ${siteName}. Set your password to get started.</p>
         ${ctaButton(d.createPasswordUrl, "Create password")}
         <p style="margin:0;font-size:13px;line-height:1.5;color:${mutedColor};">This link expires in ${d.expiresIn}.</p>`
      );
      return { subject, html, text };
    }
    case "password_changed": {
      const d = data as EmailTemplateData["password_changed"];
      const subject = "Your password was changed";
      const text = `Hi ${d.name},\n\nYour password was changed. Sign in: ${d.loginUrl}`;
      const html = layout(
        brand,
        "Password updated",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Hi ${d.name},</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Your password was successfully changed. If you didn't make this change, contact support immediately.</p>
         ${ctaButton(d.loginUrl, "Sign in")}`
      );
      return { subject, html, text };
    }
    case "welcome": {
      const d = data as EmailTemplateData["welcome"];
      const subject = `Welcome to ${siteName}`;
      const text = `Hi ${d.name},\n\nYour account is ready. Sign in: ${d.loginUrl}`;
      const html = layout(
        brand,
        "Welcome",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Hi ${d.name},</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Your account is ready. Sign in to start EMDR Support sessions.</p>
         ${ctaButton(d.loginUrl, "Sign in")}`
      );
      return { subject, html, text };
    }
    case "account_deleted": {
      const d = data as EmailTemplateData["account_deleted"];
      const safeName = escapeEmailHtml(d.name);
      const safeSupport = escapeEmailHtml(d.supportEmail);
      const safeBilling = escapeEmailHtml(d.billingNote);
      const subject = "Your account was deleted";
      const text = `Hi ${d.name},\n\nYour ${siteName} account and associated session data have been deleted. ${d.billingNote}\n\nIf you did not request this, contact ${d.supportEmail} right away.\n\n${d.homeUrl}`;
      const html = layout(
        brand,
        "Account deleted",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Hi ${safeName},</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Your ${escapeEmailHtml(siteName)} account and associated session data have been permanently deleted.</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">${safeBilling}</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Questions? Email <a href="mailto:${safeSupport}" style="color:${brandColor};">${safeSupport}</a>.</p>
         ${ctaButton(d.homeUrl, "Back to home")}`,
        `If you did not delete this account, contact ${safeSupport} right away.`
      );
      return { subject, html, text };
    }
    case "payment_receipt": {
      const d = data as EmailTemplateData["payment_receipt"];
      const safeName = escapeEmailHtml(d.name);
      const safePlan = escapeEmailHtml(d.planLabel);
      const safeAmount = escapeEmailHtml(d.amount);
      const safePaidAt = escapeEmailHtml(d.paidAt);
      const safeSupport = escapeEmailHtml(d.supportEmail);
      const subject = "Thank you for your purchase";
      const text = [
        `Hi ${d.name},`,
        "",
        `Thank you. Your ${d.planLabel} plan is active and your sessions are unlimited.`,
        "",
        "------------------------------",
        `Amount charged: ${d.amount}`,
        `Date: ${d.paidAt}`,
        "------------------------------",
        "",
        `Manage your subscription: ${d.manageBillingUrl}`,
        "",
        `Questions about this charge? Reply to this email or write to ${d.supportEmail}.`,
      ].join("\n");
      // Rules between the rows, inside a rounded box: a receipt should read as
      // a receipt. Hairlines are drawn with cell borders, which every client
      // renders, and the labels are small caps so the numbers carry the weight.
      const html = layout(
        brand,
        "Thank you for your purchase",
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${inkColor};">Hi ${safeName},</p>
         <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:${inkColor};">Thank you. Your <strong>${safePlan}</strong> plan is active and your sessions are unlimited.</p>
         <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0 4px;border:1px solid ${borderColor};border-radius:10px;">
           <tr>
             <td style="padding:15px 18px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${mutedColor};border-bottom:1px solid ${borderColor};">Amount charged</td>
             <td align="right" style="padding:15px 18px;font-size:17px;font-weight:600;color:${inkColor};border-bottom:1px solid ${borderColor};">${safeAmount}</td>
           </tr>
           <tr>
             <td style="padding:15px 18px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${mutedColor};">Date</td>
             <td align="right" style="padding:15px 18px;font-size:15px;color:${inkColor};">${safePaidAt}</td>
           </tr>
         </table>
         ${ctaButton(d.manageBillingUrl, "Manage billing")}
         <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${mutedColor};">Questions about this charge? Reply to this email or write to <a href="mailto:${safeSupport}" style="color:${brandColor};">${safeSupport}</a>.</p>`,
        `This is a receipt for a charge on your ${escapeEmailHtml(siteName)} subscription. Manage it any time from Billing.`
      );
      return { subject, html, text };
    }
    case "trial_started": {
      const d = data as EmailTemplateData["trial_started"];
      const safeName = escapeEmailHtml(d.name);
      const safePlan = escapeEmailHtml(d.planLabel);
      const safeAmount = escapeEmailHtml(d.amount);
      const safeEnd = escapeEmailHtml(d.trialEndsAt);
      const safeSupport = escapeEmailHtml(d.supportEmail);
      const subject = "Your trial has started";
      const text = [
        `Hi ${d.name},`,
        "",
        `Your ${d.planLabel} trial is on. The first charge of ${d.amount} is scheduled for ${d.trialEndsAt}.`,
        "",
        `Manage billing: ${d.manageBillingUrl}`,
        `Questions: ${d.supportEmail}`,
      ].join("\n");
      const html = layout(
        brand,
        "Your trial has started",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Hi ${safeName},</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Your <strong>${safePlan}</strong> trial is on. The first charge of <strong>${safeAmount}</strong> is scheduled for ${safeEnd}.</p>
         ${ctaButton(d.manageBillingUrl, "Manage billing")}
         <p style="margin:0;font-size:13px;line-height:1.5;color:${mutedColor};">Questions? <a href="mailto:${safeSupport}" style="color:${brandColor};">${safeSupport}</a></p>`,
        "This note is about your trial. Billing emails are separate from optional product news."
      );
      return { subject, html, text };
    }
    case "payment_failed": {
      const d = data as EmailTemplateData["payment_failed"];
      const safeName = escapeEmailHtml(d.name);
      const safeAmount = escapeEmailHtml(d.amount);
      const safeSupport = escapeEmailHtml(d.supportEmail);
      const subject = "We could not process your payment";
      const text = [
        `Hi ${d.name},`,
        "",
        `We could not charge ${d.amount}. Update your card in Manage billing so your plan stays active.`,
        "",
        d.manageBillingUrl,
        "",
        d.supportEmail,
      ].join("\n");
      const html = layout(
        brand,
        "Payment did not go through",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Hi ${safeName},</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">We could not charge <strong>${safeAmount}</strong>. Update your card so your plan stays active.</p>
         ${ctaButton(d.manageBillingUrl, "Manage billing")}
         <p style="margin:0;font-size:13px;line-height:1.5;color:${mutedColor};">Questions? <a href="mailto:${safeSupport}" style="color:${brandColor};">${safeSupport}</a></p>`
      );
      return { subject, html, text };
    }
    case "trial_charge_reminder": {
      const d = data as EmailTemplateData["trial_charge_reminder"];
      const safeName = escapeEmailHtml(d.name);
      const safePlan = escapeEmailHtml(d.planLabel);
      const safeAmount = escapeEmailHtml(d.amount);
      const safeDate = escapeEmailHtml(d.chargeDate);
      const subject = "Your trial ends soon";
      const text = [
        `Hi ${d.name},`,
        "",
        `Your ${d.planLabel} trial ends on ${d.chargeDate}. The first charge will be ${d.amount}.`,
        "",
        `Manage billing: ${d.manageBillingUrl}`,
      ].join("\n");
      const html = layout(
        brand,
        "Your trial ends soon",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Hi ${safeName},</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Your <strong>${safePlan}</strong> trial ends on ${safeDate}. The first charge will be <strong>${safeAmount}</strong>.</p>
         ${ctaButton(d.manageBillingUrl, "Manage billing")}`,
        "Cancel or change the plan in Manage billing before that date if you do not want the charge."
      );
      return { subject, html, text };
    }
    case "trial_feedback": {
      const d = data as EmailTemplateData["trial_feedback"];
      const safeName = escapeEmailHtml(d.name);
      const stars = reviewStars(d.feedbackUrl);
      const subject = "How did we do?";
      const text = [
        `Hi ${d.name},`,
        "",
        "Thank you again for trying Nura. I would love to hear how the sessions felt for you — what worked, what surprised you, anything you would tell a friend.",
        "",
        "How did we do?",
        "",
        stars.text,
        "",
        `Leave a review: ${d.feedbackUrl}`,
        "",
        "Thank you,",
        "The Nura team",
      ].join("\n");
      const html = layout(
        brand,
        "I would love to hear how it felt",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Hi ${safeName},</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Thank you again for trying Nura. I would love to hear how the sessions felt for you — what worked, what surprised you, anything you would tell a friend.</p>
         <p style="margin:0 0 4px;font-size:15px;line-height:1.5;color:${inkColor};">How did we do?</p>
         ${stars.html}
         ${ctaButton(d.feedbackUrl, "Leave a review")}
         <p style="margin:0;font-size:15px;line-height:1.6;color:${inkColor};">Thank you,<br />The Nura team</p>`,
        "Questions? Reply to this email."
      );
      return { subject, html, text };
    }
    case "post_trial_checkin": {
      const d = data as EmailTemplateData["post_trial_checkin"];
      const safeName = escapeEmailHtml(d.name);
      const safeDate = escapeEmailHtml(d.trialEndedOn);
      const safePrefs = escapeEmailHtml(d.preferencesUrl);
      const subject = "How are the sessions going?";
      const text = [
        `Hi ${d.name},`,
        "",
        `Your trial ended on ${d.trialEndedOn}, and you have been using Nura since. We would love to know how it is going — whether the guided sessions fit into your routine, and whether anything in the app feels awkward.`,
        "",
        `Open Nura: ${d.appUrl}`,
        "",
        `Manage what Nura emails you about any time in Settings: ${d.preferencesUrl}`,
      ].join("\n");
      const html = layout(
        brand,
        "How are the sessions going?",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Hi ${safeName},</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Your trial ended on ${safeDate}, and you have been using Nura since. We would love to know how it is going — whether the guided sessions fit into your routine, and whether anything in the app feels awkward.</p>
         ${ctaButton(d.appUrl, "Open Nura")}
         <p style="margin:0;font-size:13px;line-height:1.5;color:${mutedColor};">Manage what Nura emails you about any time in <a href="${safePrefs}" style="color:${brandColor};">Settings</a>.</p>`,
        `Manage what Nura emails you about any time in Settings: ${d.preferencesUrl}`
      );
      return { subject, html, text };
    }
    case "subscription_canceled": {
      const d = data as EmailTemplateData["subscription_canceled"];
      const safeName = escapeEmailHtml(d.name);
      const safeEnd = escapeEmailHtml(d.accessEndsAt);
      const safeNote = escapeEmailHtml(d.billingNote);
      const safeSupport = escapeEmailHtml(d.supportEmail);
      const subject = d.keepsAccess
        ? "Your plan will not renew"
        : "Your subscription has ended";
      const title = d.keepsAccess ? "Your plan will not renew" : "Subscription canceled";
      const text = [
        `Hi ${d.name},`,
        "",
        d.billingNote,
        `Access: ${d.accessEndsAt}`,
        "",
        d.homeUrl,
        d.supportEmail,
      ].join("\n");
      const html = layout(
        brand,
        title,
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Hi ${safeName},</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">${safeNote}</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Access: ${safeEnd}</p>
         ${ctaButton(d.homeUrl, "Back to home")}
         <p style="margin:0;font-size:13px;line-height:1.5;color:${mutedColor};">Questions? <a href="mailto:${safeSupport}" style="color:${brandColor};">${safeSupport}</a></p>`
      );
      return { subject, html, text };
    }
    case "admin_signup": {
      const d = data as EmailTemplateData["admin_signup"];
      const name = escapeEmailHtml(d.customerName);
      const email = escapeEmailHtml(d.customerEmail);
      const via = escapeEmailHtml(d.source);
      const subject = `New account: ${d.customerEmail}`;
      const text = [
        `${d.customerName} <${d.customerEmail}> created a Nura account (${d.source}).`,
        "",
        `Open user: ${d.adminUserUrl}`,
      ].join("\n");
      const html = layout(
        brand,
        "New account",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};"><strong>${name}</strong> (${email}) created a Nura account via <strong>${via}</strong>.</p>
         ${ctaButton(d.adminUserUrl, "Open user in admin")}`,
        "This note is for the platform admin."
      );
      return { subject, html, text };
    }
    case "admin_trial": {
      const d = data as EmailTemplateData["admin_trial"];
      const name = escapeEmailHtml(d.customerName);
      const email = escapeEmailHtml(d.customerEmail);
      const plan = escapeEmailHtml(d.planLabel);
      const amount = escapeEmailHtml(d.amount);
      const mode = escapeEmailHtml(d.mode);
      const end = d.trialEndsAt?.trim()
        ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Trial ends: ${escapeEmailHtml(d.trialEndsAt)}</p>`
        : "";
      const subject = `Trial started: ${d.planLabel} · ${d.amount} · ${d.mode}`;
      const text = [
        `${d.customerName} <${d.customerEmail}> started a ${d.planLabel} trial (${d.amount}, ${d.mode}).`,
        ...(d.trialEndsAt?.trim() ? [`Trial ends: ${d.trialEndsAt}`] : []),
        "",
        `Open user: ${d.adminUserUrl}`,
      ].join("\n");
      const html = layout(
        brand,
        "Trial started",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};"><strong>${name}</strong> (${email}) started a <strong>${plan}</strong> trial for <strong>${amount}</strong> (${mode}).</p>
         ${end}
         ${ctaButton(d.adminUserUrl, "Open user in admin")}`,
        "This note is for the platform admin."
      );
      return { subject, html, text };
    }
    case "admin_payment": {
      const d = data as EmailTemplateData["admin_payment"];
      const name = escapeEmailHtml(d.customerName);
      const email = escapeEmailHtml(d.customerEmail);
      const plan = escapeEmailHtml(d.planLabel);
      const amount = escapeEmailHtml(d.amount);
      const paidAt = escapeEmailHtml(d.paidAt);
      const subject = `Payment received: ${d.amount} · ${d.planLabel}`;
      const text = [
        `${d.customerName} <${d.customerEmail}> paid ${d.amount} for ${d.planLabel}.`,
        `Date: ${d.paidAt}`,
        "",
        `Open user: ${d.adminUserUrl}`,
      ].join("\n");
      const html = layout(
        brand,
        "Payment received",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};"><strong>${name}</strong> (${email}) paid <strong>${amount}</strong> for <strong>${plan}</strong>.</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Date: ${paidAt}</p>
         ${ctaButton(d.adminUserUrl, "Open user in admin")}`,
        "This note is for the platform admin."
      );
      return { subject, html, text };
    }
    case "admin_subscription_canceled": {
      const d = data as EmailTemplateData["admin_subscription_canceled"];
      const name = escapeEmailHtml(d.customerName);
      const email = escapeEmailHtml(d.customerEmail);
      const plan = escapeEmailHtml(d.planLabel);
      const mode = escapeEmailHtml(d.mode);
      const headline = escapeEmailHtml(d.headline);
      const accessLine = d.keepsAccess && d.accessEndsAt?.trim()
        ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Access until: ${escapeEmailHtml(d.accessEndsAt)}</p>`
        : "";
      const subject = d.keepsAccess
        ? `Cancel scheduled: ${d.planLabel} · ${d.mode}`
        : `Subscription ended: ${d.planLabel} · ${d.mode}`;
      const text = [
        d.keepsAccess
          ? `${d.customerName} <${d.customerEmail}> scheduled cancel for ${d.planLabel} (${d.mode}).`
          : `${d.customerName} <${d.customerEmail}> subscription ended (${d.planLabel}, ${d.mode}).`,
        ...(d.keepsAccess && d.accessEndsAt?.trim()
          ? [`Access until: ${d.accessEndsAt}`]
          : []),
        "",
        `Open user: ${d.adminUserUrl}`,
      ].join("\n");
      const html = layout(
        brand,
        headline,
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};"><strong>${name}</strong> (${email}) · <strong>${plan}</strong> (${mode}).</p>
         ${accessLine}
         ${ctaButton(d.adminUserUrl, "Open user in admin")}`,
        "This note is for the platform admin."
      );
      return { subject, html, text };
    }
    case "admin_subscription_resumed": {
      const d = data as EmailTemplateData["admin_subscription_resumed"];
      const name = escapeEmailHtml(d.customerName);
      const email = escapeEmailHtml(d.customerEmail);
      const plan = escapeEmailHtml(d.planLabel);
      const mode = escapeEmailHtml(d.mode);
      const renewLine = d.renewsAt?.trim()
        ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};">Renews: ${escapeEmailHtml(d.renewsAt)}</p>`
        : "";
      const subject = `Subscription kept: ${d.planLabel} · ${d.mode}`;
      const text = [
        `${d.customerName} <${d.customerEmail}> kept their ${d.planLabel} subscription (${d.mode}).`,
        ...(d.renewsAt?.trim() ? [`Renews: ${d.renewsAt}`] : []),
        "",
        `Open user: ${d.adminUserUrl}`,
      ].join("\n");
      const html = layout(
        brand,
        "Subscription kept",
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};"><strong>${name}</strong> (${email}) kept <strong>${plan}</strong> (${mode}).</p>
         ${renewLine}
         ${ctaButton(d.adminUserUrl, "Open user in admin")}`,
        "This note is for the platform admin."
      );
      return { subject, html, text };
    }
    case "admin_feedback": {
      const d = data as EmailTemplateData["admin_feedback"];
      const name = escapeEmailHtml(d.customerName);
      const email = escapeEmailHtml(d.customerEmail);
      const score = escapeEmailHtml(d.score);
      const kind = escapeEmailHtml(d.kindLabel);
      const source = escapeEmailHtml(d.source);
      const comment = escapeEmailHtml(d.comment);
      const subject = `New ${d.kindLabel}: ${d.score} — ${d.customerName}`;
      const text = [
        `${d.customerName} <${d.customerEmail}> left a ${d.kindLabel} (${d.score}).`,
        `Source: ${d.source}`,
        "",
        d.comment || "No written note.",
        "",
        `Open in admin: ${d.adminFeedbackUrl}`,
      ].join("\n");
      const html = layout(
        brand,
        `New ${kind}`,
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${inkColor};"><strong>${name}</strong> (${email}) left a <strong>${kind}</strong> with <strong>${score}</strong>.</p>
         <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:${mutedColor};">Source: ${source}</p>
         ${
           d.comment.trim()
             ? `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid ${brandColor};background:${pageBg};color:${inkColor};font-size:15px;line-height:1.6;">${comment.replace(/\n/g, "<br />")}</blockquote>`
             : `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${mutedColor};">No written note.</p>`
         }
         ${ctaButton(d.adminFeedbackUrl, "Open in admin")}`,
        "This note is for the platform admin."
      );
      return { subject, html, text };
    }
    default:
      throw new Error(`Unknown email template: ${id}`);
  }
}

export async function getAppUrl(path = ""): Promise<string> {
  const { getPublicAppUrl } = await import("@/lib/platform-settings");
  const base = await getPublicAppUrl();
  return `${base}${path}`;
}

/** @deprecated use getAppUrl */
export function appUrl(path = ""): string {
  const base = process.env.APP_URL ?? "http://localhost:3471";
  return `${base.replace(/\/$/, "")}${path}`;
}
