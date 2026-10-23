import { NextResponse } from "next/server";
import {
  requirePlatformSettingsAccess,
  isAuthContext,
} from "@/lib/api-auth";
import {
  getPlatformSettings,
  savePlatformSettings,
} from "@/lib/platform-settings";
import { clientIp, writeAuditEvent } from "@/lib/audit-log";
import {
  normalizeVoiceOrbId,
  parseVoiceOrbUpdate,
  VOICE_ORB_OPTIONS,
} from "@/lib/voice-orb-catalog";

/** Admin -> Platform -> Voice orb: the saved orb look and chime toggle. */
export async function GET() {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;
  try {
    const settings = await getPlatformSettings();
    return NextResponse.json({
      orbId: normalizeVoiceOrbId(settings.voiceOrbId),
      sounds: settings.voiceSounds,
      options: VOICE_ORB_OPTIONS,
    });
  } catch (err) {
    console.error("[admin/voice-orb GET]", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

/** Body: { orbId?: allowlisted id, sounds?: boolean }. Unknown ids are a 400. */
export async function PUT(request: Request) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseVoiceOrbUpdate(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const current = await getPlatformSettings();
    const next = await savePlatformSettings({
      ...current,
      voiceOrbId: parsed.update.orbId ?? current.voiceOrbId,
      voiceSounds: parsed.update.sounds ?? current.voiceSounds,
    });
    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "settings.voice_orb_updated",
      detail: {
        fromOrbId: current.voiceOrbId,
        orbId: next.voiceOrbId,
        sounds: next.voiceSounds,
      },
      ip: clientIp(request),
    });
    return NextResponse.json({ orbId: next.voiceOrbId, sounds: next.voiceSounds });
  } catch (err) {
    console.error("[admin/voice-orb PUT]", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
