import { receiptPlanLabel, formatReceiptAmount, formatReceiptDate } from "@/lib/email/purchase-receipt";

export type AdminActivityKind = "signup" | "billing";

export type AdminActivityItem = {
  id: string;
  kind: AdminActivityKind;
  title: string;
  detail: string;
  href: string;
  at: string;
};

export function activityPersonTitle(name: string | null, email: string): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  return email.split("@")[0] || email;
}

export function activitySignupSource(input: {
  detailSource: string | null;
  hasGoogle: boolean;
}): string {
  if (input.detailSource === "google_oauth" || input.detailSource === "google") {
    return "Google";
  }
  if (input.detailSource === "self_register" || input.detailSource === "email") {
    return "Email";
  }
  return input.hasGoogle ? "Google" : "Email";
}

export function formatActivitySignup(input: {
  name: string | null;
  email: string;
  source: string | null;
  hasGoogle: boolean;
  plan: string | null;
}): { title: string; detail: string } {
  const title = activityPersonTitle(input.name, input.email);
  const via = activitySignupSource({
    detailSource: input.source,
    hasGoogle: input.hasGoogle,
  });
  const plan =
    input.plan && input.plan !== "free" && input.plan !== "none"
      ? receiptPlanLabel(input.plan)
      : null;
  const detail = plan
    ? `${input.email}, ${via}, ${plan}`
    : `${input.email}, ${via}`;
  return { title, detail };
}

function modeLabel(livemode: boolean | null): string | null {
  if (livemode === true) return "Live";
  if (livemode === false) return "Sandbox";
  return null;
}

export function formatActivityBilling(input: {
  name: string | null;
  email: string;
  plan: string | null;
  amountCents: number;
  currency: string | null;
  status: string;
  livemode: boolean | null;
  trialEndsAt: string | null;
}): { title: string; detail: string } {
  const title = activityPersonTitle(input.name, input.email);
  const plan = receiptPlanLabel(input.plan);
  const amount = formatReceiptAmount(input.amountCents, input.currency);
  const mode = modeLabel(input.livemode);
  const parts: string[] = [];
  if (input.status === "trial_started") {
    parts.push(`${plan} trial`, amount);
    if (input.trialEndsAt) {
      const end = new Date(input.trialEndsAt);
      if (!Number.isNaN(end.getTime())) {
        parts.push(`ends ${formatReceiptDate(end)}`);
      }
    }
  } else if (input.status === "failed") {
    parts.push(`Payment failed`, amount, plan);
  } else if (input.status === "succeeded") {
    parts.push(`Paid ${amount}`, plan);
  } else {
    parts.push(`Checkout`, amount, plan);
  }
  if (mode) parts.push(mode);
  return { title, detail: parts.join(", ") };
}
