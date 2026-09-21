export type ConversionChannel = "ga4" | "meta" | "google_ads";

export type ChannelResult = {
  channel: ConversionChannel;
  status: "sent" | "skipped" | "failed";
  detail?: string;
};

export function skipped(
  channel: ConversionChannel,
  detail: string
): ChannelResult {
  return { channel, status: "skipped", detail };
}

export function sent(channel: ConversionChannel, detail?: string): ChannelResult {
  return { channel, status: "sent", detail };
}

export function failed(
  channel: ConversionChannel,
  detail: string
): ChannelResult {
  return { channel, status: "failed", detail: detail.slice(0, 500) };
}

/** One-line summary for logs and the admin status view. */
export function summarizeResults(results: ChannelResult[]): string {
  return results
    .map((r) => `${r.channel}:${r.status}${r.detail ? ` (${r.detail})` : ""}`)
    .join(", ");
}
