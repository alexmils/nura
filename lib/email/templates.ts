import { BRAND_COLORS, BRAND_SPOKEN, chromeBrandName } from "@/lib/brand";
import { EMAIL_LOGO_PATH, EMAIL_LOGO_WIDTH } from "@/lib/brand-assets";
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
};

const brandColor = BRAND_COLORS.earth;
const mutedColor = BRAND_COLORS.olive;
const inkColor = BRAND_COLORS.ink;
const pageBg = "#EDF9ED";
const cardBg = "#F7FDF7";
const borderColor = "#B8D4A8";

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
  // A fixed-width cell is the only thing every client agrees on: it holds the
  // logo to size even where inline styles are stripped, and `align="left"`
  // keeps it flush with the copy below instead of floating off-centre. The
  // bottom padding does the spacing, because table `margin` is unreliable.
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="left" style="border-collapse:collapse;">
                <tr>
                  <td width="${EMAIL_LOGO_WIDTH}" align="left" style="width:${EMAIL_LOGO_WIDTH}px;padding:0 0 20px;">
                    <a href="${origin}" style="display:block;text-decoration:none;border:0;">
                      <img src="${origin}${EMAIL_LOGO_PATH}" alt="${safeName}" width="${EMAIL_LOGO_WIDTH}" height="${height}" style="display:block;width:${EMAIL_LOGO_WIDTH}px;max-width:${EMAIL_LOGO_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;" />
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
