import { NextResponse } from "next/server";
import { speechToTextConfigured, transcribeSpeech } from "@/lib/llm";
import { getLlmRuntimeConfig } from "@/lib/platform-settings";
import { withAuth } from "@/lib/api-auth";

/** ~60 s of compressed speech is far below this; anything larger is not one utterance. */
const MAX_BYTES = 8 * 1024 * 1024;

/** Whether the server STT path is available (voice mode picks its engine). */
export async function GET() {
  return withAuth(async () => {
    const settings = await getLlmRuntimeConfig();
    return NextResponse.json({ available: speechToTextConfigured(settings) });
  });
}

export async function POST(request: Request) {
  return withAuth(async () => {
    const settings = await getLlmRuntimeConfig();
    if (!speechToTextConfigured(settings)) {
      return NextResponse.json({ error: "Voice transcription is not configured." }, { status: 503 });
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Expected multipart audio." }, { status: 400 });
    }
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json({ error: "Missing audio." }, { status: 400 });
    }
    if (audio.size > MAX_BYTES) {
      return NextResponse.json({ error: "Audio too long." }, { status: 413 });
    }
    const lang = form.get("lang");
    const filename = audio instanceof File && audio.name ? audio.name : "speech.webm";
    try {
      const out = await transcribeSpeech(settings, audio, {
        filename,
        language: typeof lang === "string" ? lang : null,
      });
      if (!out) {
        return NextResponse.json({ error: "Voice transcription is not configured." }, { status: 503 });
      }
      return NextResponse.json({ text: out.text }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      console.error("[voice/transcribe]", err);
      return NextResponse.json({ error: "Could not transcribe." }, { status: 502 });
    }
  });
}
