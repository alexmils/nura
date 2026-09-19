import type { AuditAction } from "@/lib/audit-log";

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMoney(cents: number, currency = "USD") {
  const fractionDigits = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export {
  formatUsdMicros,
  formatTokenCount,
} from "@/lib/admin-llm-format";

const ACTION_LABELS: Record<AuditAction, string> = {
  "user.login": "Signed in",
  "user.logout": "Signed out",
  "user.invited": "Invited",
  "user.created": "Created",
  "user.updated": "Updated",
  "user.deleted": "Deleted",
  "user.password_set": "Password set",
  "user.password_reset_requested": "Password reset link sent",
  "user.disabled": "Disabled",
  "user.enabled": "Enabled",
  "settings.platform_updated": "Platform settings updated",
  "settings.seo_updated": "SEO settings updated",
  "settings.email_updated": "Email settings updated",
  "settings.stripe_updated": "Stripe settings updated",
  "settings.stripe_synced": "Stripe prices synced",
  "email.test_sent": "Test email sent",
  "email.broadcast_sent": "Broadcast sent",
  "blog.post_created": "Blog guide created",
  "blog.post_updated": "Blog guide updated",
  "blog.post_deleted": "Blog guide deleted",
  "mcp.token_generated": "MCP token generated",
  "mcp.token_revoked": "MCP token revoked",
  "mcp.settings_updated": "MCP settings updated",
};

export function actionLabel(action: AuditAction | string) {
  return ACTION_LABELS[action as AuditAction] ?? action;
}

export {
  paymentStatusLabel,
  describeInvoicePayment,
} from "@/lib/billing-event-format";
