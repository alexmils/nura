/**
 * Data for the "winback" email template (Admin → Email → Automation).
 *
 * Pure (no DB, no Stripe) so the admin preview, the test send, the real send
 * and the tests all build the exact same values. The copy that depends on the
 * path a redeemed link takes (paying member: next payment moves; lapsed:
 * free trial through checkout) is pre-worded here, so an edited template in
 * Admin → Email can still say the right thing through {{offerLine}} and
 * {{howItWorks}} without needing conditionals.
 */

export type WinbackTemplateMode = "trial" | "extend";

export type WinbackTemplateData = {
  name: string;
  reactivateUrl: string;
  expiresAt: string;
  days: string;
  mode: WinbackTemplateMode;
  offerLine: string;
  howItWorks: string;
  ctaLabel: string;
  /** Admin's personal note, plain text ("" when none). */
  note: string;
  /** The same note as an escaped HTML paragraph ("" when none). */
  noteHtml: string;
};

export const WINBACK_NOTE_MAX = 1000;

/** Trim, drop control characters, cap the length. Empty means "no note". */
export function cleanWinbackNote(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, WINBACK_NOTE_MAX);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function winbackNoteHtml(note: string): string {
  if (!note) return "";
  const body = escapeHtml(note).replace(/\n/g, "<br />");
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#2A3020;font-style:italic;">${body}</p>`;
}

export function formatWinbackExpiry(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function winbackTemplateData(input: {
  name?: string | null;
  link: string;
  expiresAt: Date;
  mode: WinbackTemplateMode;
  days?: number;
  brand?: string;
  note?: unknown;
}): WinbackTemplateData {
  const brand = input.brand ?? "Nura";
  const days = input.days ?? 30;
  const first = input.name?.trim().split(/\s+/)[0] || "there";
  const until = formatWinbackExpiry(input.expiresAt);
  const note = cleanWinbackNote(input.note);
  const extend = input.mode === "extend";
  return {
    name: first,
    reactivateUrl: input.link,
    expiresAt: until,
    days: String(days),
    mode: extend ? "extend" : "trial",
    offerLine: extend
      ? `To make up for it, your next ${days} days of ${brand} are on us. Open your personal link to add them (it works once and is valid until ${until}).`
      : `To make up for it, we would like to give you ${days} days of ${brand} free. Use your personal link to start (it works once and is valid until ${until}).`,
    howItWorks: extend
      ? `Your plan stays as it is: we simply move your next payment ${days} days later. No checkout, no card details, nothing to pay.`
      : `You add a card at checkout, but nothing is charged for ${days} days, and you can cancel anytime before then.`,
    ctaLabel: extend ? `Add my ${days} free days` : `Start my ${days} free days`,
    note,
    noteHtml: winbackNoteHtml(note),
  };
}

/** Default subject (the built-in template; Admin → Email can change it). */
export function defaultWinbackSubject(mode: WinbackTemplateMode, days = 30, brand = "Nura"): string {
  return mode === "extend" ? `Your next ${days} days of ${brand} are on us` : `${days} days of ${brand} on us`;
}

/** A one-line subject the admin typed: no line breaks, bounded. */
export function cleanWinbackSubject(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}
