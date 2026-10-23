"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AgentOverlay } from "@/app/components/AgentOverlay";
import type { VoicePhase } from "@/app/components/useGuidedVoiceMode";
import type { Message } from "@/lib/types";

const now = new Date().toISOString();
const THREAD: Message[] = [
  { id: "a1", threadId: "mock", role: "agent", content: "Welcome. Let\u2019s find a calm place to start. What would you like to work on today?", createdAt: now },
  { id: "u1", threadId: "mock", role: "user", content: "I keep replaying an argument from work.", createdAt: now },
  { id: "a2", threadId: "mock", role: "agent", content: "Thank you for sharing that. When you bring it to mind now, what do you notice in your body?", createdAt: now },
  { id: "u2", threadId: "mock", role: "user", content: "Tight chest, and my shoulders are up.", createdAt: now },
];

const VOICE_PHASES: VoicePhase[] = ["listening", "thinking", "speaking"];

/**
 * Stand-in for the AI agent-guided session: the real AgentOverlay with mock
 * messages. ?mode=text|voice, ?typing=0, ?phase=thinking, ?start=0 (prompt view).
 */
export function ThinkingMock() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"text" | "voice">(params.get("mode") === "voice" ? "voice" : "text");
  const [typing, setTyping] = useState(params.get("typing") !== "0");
  const [voicePhase, setVoicePhase] = useState<VoicePhase>((params.get("phase") as VoicePhase) || "thinking");
  const messages = params.get("start") === "0" ? [] : THREAD;
  const wave = () => 0.5 + 0.45 * Math.sin(performance.now() / 180);
  // Client-only: the composer reads browser speech support, which the server can't know.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <div style={{ position: "relative", minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "var(--bg, #fbfcf4)" }}>
      <AgentOverlay
        messages={messages}
        hidden={false}
        autoVoice={false}
        sessionMode="idle"
        phase="assessment"
        agentTyping={typing}
        userDisplayName="Alex"
        onReply={() => setTyping(true)}
        onPlayLine={() => undefined}
        voiceAvailable
        voiceActive={mode === "voice"}
        voicePhase={mode === "voice" ? voicePhase : "off"}
        onEnterVoice={() => setMode("voice")}
        onExitVoice={() => setMode("text")}
        onToggleMuteVoice={() => undefined}
        onInterruptVoice={() => setVoicePhase("listening")}
        getVoiceInputLevel={wave}
        getVoiceOutputLevel={wave}
      />
      <div style={{ position: "fixed", top: 8, left: 8, zIndex: 2100, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" data-mock="text" onClick={() => setMode("text")}>text</button>
        <button type="button" data-mock="typing" onClick={() => setTyping((t) => !t)}>typing:{typing ? "on" : "off"}</button>
        <button type="button" data-mock="voice" onClick={() => setMode("voice")}>voice</button>
        {VOICE_PHASES.map((p) => (
          <button key={p} type="button" data-phase={p} onClick={() => { setMode("voice"); setVoicePhase(p); }}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
