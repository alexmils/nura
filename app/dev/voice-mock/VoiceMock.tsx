"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { VoiceStage } from "@/app/components/voice/VoiceStage";
import type { VoicePhase } from "@/app/components/useGuidedVoiceMode";

const PHASES: VoicePhase[] = ["listening", "thinking", "speaking", "off"];

/** Stand-in session UI so bleed-through (portrait) and text mode (landscape) are visible. */
function FakeSession() {
  return (
    <div style={{ minHeight: "160vh", background: "#fff" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 40, padding: "12px 16px", background: "#eef8ec", borderBottom: "1px solid #4a7234" }}>
        <strong>AI agent-guided session</strong>
      </header>
      <div style={{ position: "relative", zIndex: 30, transform: "translateZ(0)", margin: "40px auto", maxWidth: 520, padding: 16 }}>
        <p className="voice-mock-transcript" style={{ fontSize: 20, lineHeight: 1.5, textAlign: "center" }}>
          Welcome. Let&apos;s find a calm place to start. What would you like to work on today?
        </p>
        <div style={{ height: 120, borderRadius: 16, background: "#eef8ec" }} />
      </div>
    </div>
  );
}

export function VoiceMock() {
  const params = useSearchParams();
  const [phase, setPhase] = useState<VoicePhase>((params.get("phase") as VoicePhase) || "listening");
  const [muted, setMuted] = useState(false);
  const renderer = (params.get("orb") as "css" | "webgl" | null) ?? "auto";
  // ?orbId=shdr-13 previews one look; without it the admin's saved choice shows.
  const orbId = params.get("orbId") ?? undefined;
  const wave = () => 0.5 + 0.45 * Math.sin(performance.now() / 180);
  return (
    <>
      <FakeSession />
      {phase !== "off" ? (
        <VoiceStage
          phase={phase}
          starting={params.get("starting") === "1"}
          stalled={params.get("stalled") === "1"}
          muted={muted}
          exiting={false}
          error={params.get("error")}
          getInputLevel={wave}
          getOutputLevel={params.get("silent") === "1" ? () => 0 : wave}
          onEnd={() => setPhase("off")}
          onToggleMute={() => setMuted((m) => !m)}
          onResume={() => undefined}
          onInterrupt={() => setPhase("listening")}
          orbRenderer={renderer}
          orbId={orbId}
        />
      ) : null}
      <div data-voice-mock-controls style={{ position: "fixed", top: 8, left: 8, zIndex: 2100, display: "flex", gap: 6 }}>
        {PHASES.map((p) => (
          <button key={p} type="button" data-phase={p} onClick={() => setPhase(p)}>
            {p}
          </button>
        ))}
      </div>
    </>
  );
}