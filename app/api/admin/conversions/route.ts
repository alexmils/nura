import { NextResponse } from "next/server";
import { isAuthContext, requirePlatformSettingsAccess } from "@/lib/api-auth";
import {
  conversionChannelStatus,
  loadConversionConfig,
} from "@/lib/conversions/config";
import {
  dispatchConversion,
  listRecentDispatches,
} from "@/lib/conversions/dispatch";
import type { ConversionChannel } from "@/lib/conversions/types";

export const dynamic = "force-dynamic";

const CHANNELS: ConversionChannel[] = ["ga4", "meta", "google_ads"];

function isChannel(value: unknown): value is ConversionChannel {
  return CHANNELS.includes(value as ConversionChannel);
}

/**
 * Which server-side conversion channels are configured, plus the recent
 * delivery log. Secrets are never echoed — only whether they parsed.
 */
export async function GET() {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  const config = await loadConversionConfig();

  return NextResponse.json(
    {
      channels: conversionChannelStatus(config),
      recent: await listRecentDispatches(),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

/**
 * Send one probe charge through a single channel so setup can be verified
 * before the first real purchase. It is deliberately cheap for GA4 and Meta,
 * whose test events still land in the property/dataset.
 */
export async function POST(request: Request) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  const body = (await request.json().catch(() => ({}))) as { channel?: unknown };
  if (!isChannel(body.channel)) {
    return NextResponse.json(
      { error: `channel must be one of ${CHANNELS.join(", ")}` },
      { status: 400 }
    );
  }

  const transactionId = `test_${crypto.randomUUID()}`;
  const result = await dispatchConversion({
    kind: "purchase",
    userId: auth.user.id,
    transactionId,
    valueCents: 0,
    currency: "USD",
    plan: "test",
    sourceUrl: "https://nurahelp.com/app/billing",
    channels: [body.channel],
    // Google validates the payload without recording a conversion.
    validateOnly: body.channel === "google_ads",
    probe: {
      // A GA4 client_id is `<random>.<seconds>`; the account running this probe
      // has no captured click of its own, and the channel would skip without one.
      gaClientId: `${Math.floor(Math.random() * 1e10)}.${Math.floor(Date.now() / 1000)}`,
      // Google rejects this click id on purpose. Reaching that rejection still
      // proves the developer token, OAuth token, and conversion action resolve.
      clickId: "nura_probe_click_id",
    },
  });

  return NextResponse.json(
    { transactionId, channels: result.channels },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
