import { NextResponse } from "next/server";
import { requirePlatformSettingsAccess, isAuthContext } from "@/lib/api-auth";
import { synthesizeSpeech } from "@/lib/llm";
import { getLlmRuntimeConfig } from "@/lib/platform-settings";
import { isValidElevenLabsVoiceId } from "@/lib/provider-catalog";

const PREVIEW_TEXT =
  "Hi. This is a short sample of this voice for Nura sessions.";

/** Simple in-memory cooldown per process (best-effort against click spam). */
const lastPreviewAt = new Map<string, number>();
const PREVIEW_COOLDOWN_MS = 1200;

export async function POST(request: Request) {
  const auth = await requirePlatformSettingsAccess();
  if (!isAuthContext(auth)) return auth;

  try {
    const body = (await request.json()) as {
      voiceId?: unknown;
      text?: unknown;
    };
    const voiceId =
      typeof body.voiceId === "string" ? body.voiceId.trim() : "";
    if (!voiceId) {
      return NextResponse.json({ error: "Missing voice ID" }, { status: 400 });
    }
    if (!isValidElevenLabsVoiceId(voiceId)) {
      return NextResponse.json({ error: "Invalid voice ID" }, { status: 400 });
    }

    // Ignore client-supplied text — fixed sample only (quota / abuse).
    void body.text;

    const cooldownKey = auth.user.id;
    const now = Date.now();
    const prev = lastPreviewAt.get(cooldownKey) ?? 0;
    if (now - prev < PREVIEW_COOLDOWN_MS) {
      return NextResponse.json(
        { error: "Wait a moment before another preview." },
        { status: 429 }
      );
    }
    lastPreviewAt.set(cooldownKey, now);

    const settings = await getLlmRuntimeConfig();
    const audio = await synthesizeSpeech(settings, PREVIEW_TEXT, {
      voiceId,
      userId: auth.user.id,
    });
    if (!audio) {
      return NextResponse.json(
        { error: "Could not generate preview. Check the Voice API key." },
        { status: 502 }
      );
    }

    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    console.error("[admin/ai/voice-preview] failed");
    return NextResponse.json(
      { error: "Voice preview failed" },
      { status: 500 }
    );
  }
}
