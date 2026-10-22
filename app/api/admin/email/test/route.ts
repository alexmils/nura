import { NextResponse } from "next/server";
import {
  requirePlatformSettingsAccess,
  isAuthContext,
} from "@/lib/api-auth";
import { getAppUrl, sendTemplateEmail } from "@/lib/email";
import type { EmailTemplateId } from "@/lib/email/templates";
import { isEmailTemplateId } from "@/lib/email/template-labels";
import { BRAND_SUPPORT_EMAIL } from "@/lib/brand";
import { clientIp, writeAuditEvent } from "@/lib/audit-log";

export async function POST(request: Request) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  try {
    const { to, templateId } = (await request.json()) as {
      to?: string;
      templateId?: EmailTemplateId;
    };

    if (!to?.trim()) {
      return NextResponse.json({ error: "Recipient is required" }, { status: 400 });
    }

    const id = templateId && isEmailTemplateId(templateId) ? templateId : "welcome";
    const sample = {
      name: "Test User",
      resetUrl: await getAppUrl("/app/reset-password?token=test"),
      createPasswordUrl: await getAppUrl("/app/create-password?token=test"),
      loginUrl: await getAppUrl("/app/login"),
      homeUrl: await getAppUrl("/"),
      supportEmail: BRAND_SUPPORT_EMAIL,
      expiresIn: "72 hours",
    };

    if (id === "password_reset") {
      await sendTemplateEmail(to.trim(), id, {
        name: sample.name,
        resetUrl: sample.resetUrl,
        expiresIn: sample.expiresIn,
      });
    } else if (id === "welcome_invite") {
      await sendTemplateEmail(to.trim(), id, {
        name: sample.name,
        createPasswordUrl: sample.createPasswordUrl,
        expiresIn: sample.expiresIn,
      });
    } else if (id === "password_changed") {
      await sendTemplateEmail(to.trim(), id, {
        name: sample.name,
        loginUrl: sample.loginUrl,
      });
    } else if (id === "account_deleted") {
      await sendTemplateEmail(to.trim(), id, {
        name: sample.name,
        supportEmail: sample.supportEmail,
        homeUrl: sample.homeUrl,
        billingNote: "Your subscription was canceled.",
      });
    } else if (id === "payment_receipt") {
      await sendTemplateEmail(to.trim(), id, {
        name: sample.name,
        planLabel: "Monthly",
        amount: "$14.99",
        paidAt: new Date().toISOString().slice(0, 10),
        manageBillingUrl: await getAppUrl("/app/billing"),
        supportEmail: sample.supportEmail,
      });
    } else if (id === "trial_started") {
      await sendTemplateEmail(to.trim(), id, {
        name: sample.name,
        planLabel: "Monthly",
        amount: "$14.99",
        trialEndsAt: "October 22, 2026",
        manageBillingUrl: await getAppUrl("/app/billing"),
        supportEmail: sample.supportEmail,
      });
    } else if (id === "payment_failed") {
      await sendTemplateEmail(to.trim(), id, {
        name: sample.name,
        amount: "$14.99",
        manageBillingUrl: await getAppUrl("/app/billing"),
        supportEmail: sample.supportEmail,
      });
    } else if (id === "trial_charge_reminder") {
      await sendTemplateEmail(to.trim(), id, {
        name: sample.name,
        planLabel: "Monthly",
        amount: "$14.99",
        chargeDate: "October 22, 2026",
        manageBillingUrl: await getAppUrl("/app/billing"),
      });
    } else if (id === "trial_feedback") {
      await sendTemplateEmail(to.trim(), id, {
        name: sample.name,
        feedbackUrl: await getAppUrl("/app/feedback?source=review"),
      });
    } else if (id === "subscription_canceled") {
      await sendTemplateEmail(to.trim(), id, {
        name: sample.name,
        accessEndsAt: "October 22, 2026",
        homeUrl: sample.homeUrl,
        supportEmail: sample.supportEmail,
        billingNote: "Your plan will not renew.",
        keepsAccess: false,
      });
    } else if (id === "admin_signup") {
      await sendTemplateEmail(to.trim(), id, {
        customerName: sample.name,
        customerEmail: "sam@example.com",
        source: "Google",
        adminUserUrl: await getAppUrl("/admin/users/u1"),
      });
    } else if (id === "admin_trial") {
      await sendTemplateEmail(to.trim(), id, {
        customerName: sample.name,
        customerEmail: "sam@example.com",
        planLabel: "Weekly",
        amount: "$0",
        trialEndsAt: "October 22, 2026",
        mode: "Live",
        adminUserUrl: await getAppUrl("/admin/users/u1"),
      });
    } else if (id === "admin_payment") {
      await sendTemplateEmail(to.trim(), id, {
        customerName: sample.name,
        customerEmail: "alex@example.com",
        planLabel: "Monthly",
        amount: "$14.99",
        paidAt: "September 21, 2026",
        adminUserUrl: await getAppUrl("/admin/users/u1"),
      });
    } else if (id === "admin_subscription_canceled") {
      await sendTemplateEmail(to.trim(), id, {
        customerName: sample.name,
        customerEmail: "alex@example.com",
        planLabel: "Monthly",
        accessEndsAt: "October 22, 2026",
        keepsAccess: true,
        mode: "Live",
        headline: "Subscription cancel scheduled",
        adminUserUrl: await getAppUrl("/admin/users/u1"),
      });
    } else if (id === "admin_subscription_resumed") {
      await sendTemplateEmail(to.trim(), id, {
        customerName: sample.name,
        customerEmail: "alex@example.com",
        planLabel: "Monthly",
        renewsAt: "October 22, 2026",
        mode: "Live",
        adminUserUrl: await getAppUrl("/admin/users/u1"),
      });
    } else {
      await sendTemplateEmail(to.trim(), "welcome", {
        name: sample.name,
        loginUrl: sample.loginUrl,
      });
    }

    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "email.test_sent",
      detail: { to: to.trim(), templateId: id },
      ip: clientIp(request),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/email/test]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 503 }
    );
  }
}
