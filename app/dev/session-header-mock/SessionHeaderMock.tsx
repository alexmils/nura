"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AgentOverlay } from "@/app/components/AgentOverlay";
import { CrisisHelpButton } from "@/app/components/CrisisHelpButton";
import { SessionDescription } from "@/app/components/SessionDescription";
import { SidebarNavProvider, WorkspaceMenuButton } from "@/app/components/SidebarNavContext";
import type { Message, ProtocolPhase } from "@/lib/types";

const now = new Date().toISOString();
const BASE: Message[] = [
  { id: "a1", threadId: "header-mock", role: "agent", content: "Welcome. What would you like to work on today?", createdAt: now },
  { id: "u1", threadId: "header-mock", role: "user", content: "I keep replaying an argument from work.", createdAt: now },
  { id: "a2", threadId: "header-mock", role: "agent", content: "Thank you. Before we go there, let\u2019s find a calm place you can come back to.", createdAt: now },
];
const PHASES: ProtocolPhase[] = ["intake", "grounding", "assessment", "desensitization"];

/** ?phase=grounding sets the starting phase; buttons move the phase and add a turn. */
export function SessionHeaderMock() {
  const params = useSearchParams();
  const [phase, setPhase] = useState<ProtocolPhase>((params.get("phase") as ProtocolPhase) || "intake");
  const [messages, setMessages] = useState<Message[]>(BASE);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const advance = (p: ProtocolPhase) => {
    const n = messages.length;
    setMessages((m) => [
      ...m,
      { id: `u${n}`, threadId: "header-mock", role: "user", content: "Okay.", createdAt: now },
      { id: `a${n}`, threadId: "header-mock", role: "agent", content: `Let\u2019s move on (${p}).`, createdAt: now },
    ]);
    setPhase(p);
  };
  return (
    <SidebarNavProvider>
      <main className="workspace-main flex min-h-0 flex-1 flex-col" style={{ minHeight: "100dvh" }}>
        <header className="workspace-header workspace-header--calm">
          <div className="workspace-header-row">
            <div className="workspace-header-lead">
              <WorkspaceMenuButton />
              <SessionDescription
                title={params.get("title") || "AI agent-guided session"}
                description={params.get("desc") ?? undefined}
              />
            </div>
            <div className="workspace-header-trail">
              <CrisisHelpButton />
            </div>
          </div>
        </header>
        <div className="workspace-stage relative flex min-h-0 flex-1 flex-col" style={{ justifyContent: "flex-end" }}>
          <AgentOverlay
            messages={messages}
            hidden={false}
            autoVoice={false}
            sessionMode="idle"
            phase={phase}
            userDisplayName="Alex"
            onReply={() => undefined}
            onPlayLine={() => undefined}
          />
        </div>
        <div style={{ position: "fixed", bottom: 4, right: 4, zIndex: 2100, display: "flex", gap: 4, opacity: 0.7 }}>
          {PHASES.map((p) => (
            <button key={p} type="button" data-mock-phase={p} onClick={() => advance(p)}>{p}</button>
          ))}
        </div>
      </main>
    </SidebarNavProvider>
  );
}
