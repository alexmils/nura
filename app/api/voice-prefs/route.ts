import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getPlatformSettings } from "@/lib/platform-settings";
import { normalizeVoiceOrbId } from "@/lib/voice-orb-catalog";

/** Voice-mode look for signed-in users: which orb, and whether chimes play. No secrets. */
export async function GET() {
  return withAuth(async () => {
    const platform = await getPlatformSettings();
    return NextResponse.json({
      orbId: normalizeVoiceOrbId(platform.voiceOrbId),
      sounds: platform.voiceSounds !== false,
    });
  });
}
