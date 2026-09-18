"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AudioLines, Mic, User, Volume2 } from "lucide-react";
import { LetterRevealHeading } from "./LetterRevealHeading";
import "./home-memory-sets.css";

const GUIDE_MARK = "/brand/nura-circle-variants/A-white-on-sage-128.png";

const AGENT_OPEN =
  "What are you noticing now — in your body, or in the picture?";
const USER_LINE =
  "My chest is still tight. Same as last week — that I'm not good enough.";
const AGENT_REPLY =
  "That's in your notes. Tightness in the chest. The line you wrote: I'm not good enough.";
const COMPOSER_HINT = "What are you noticing…";

const POINTS = [
  {
    title: "Write it once",
    line: "Add a note yourself, or import what you already told ChatGPT or Claude.",
  },
  {
    title: "The agent can use it",
    line: "In an AI agent-guided session the guide can draw on those notes.",
  },
  {
    title: "Yours to erase",
    line: "Delete any note, or clear them all in Settings.",
  },
] as const;

type LoadLabel = "Memory loading" | "Memory processing";

type Scene = {
  showOpen: boolean;
  draft: string;
  showUser: boolean;
  loading: LoadLabel | null;
  showReply: boolean;
  reply: string;
};

const EMPTY: Scene = {
  showOpen: false,
  draft: "",
  showUser: false,
  loading: null,
  showReply: false,
  reply: "",
};

const DONE: Scene = {
  showOpen: true,
  draft: "",
  showUser: true,
  loading: null,
  showReply: true,
  reply: AGENT_REPLY,
};

function GuideAvatar() {
  return (
    <span className="fe-memory-avatar fe-memory-avatar--guide">
      <Image src={GUIDE_MARK} alt="" width={44} height={44} />
    </span>
  );
}

function UserAvatar() {
  return (
    <span className="fe-memory-avatar fe-memory-avatar--user">
      <User size={20} strokeWidth={2.1} />
    </span>
  );
}

export function HomeMemorySets() {
  const rootRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const [scene, setScene] = useState<Scene>(EMPTY);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setScene(DONE);
      return;
    }

    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const run = async () => {
      while (!cancelled) {
        setScene({ ...EMPTY, showOpen: true });
        await wait(1600);
        if (cancelled) return;

        let typed = "";
        for (const ch of USER_LINE) {
          if (cancelled) return;
          typed += ch;
          const next = typed;
          setScene((s) => ({ ...s, draft: next }));
          await wait(52);
        }
        await wait(500);
        if (cancelled) return;

        setScene((s) => ({ ...s, draft: "", showUser: true }));
        await wait(700);
        if (cancelled) return;

        setScene((s) => ({ ...s, loading: "Memory loading" }));
        await wait(2400);
        if (cancelled) return;
        setScene((s) => ({ ...s, loading: "Memory processing" }));
        await wait(3200);
        if (cancelled) return;

        setScene((s) => ({ ...s, loading: null, showReply: true, reply: "" }));
        let reply = "";
        for (const ch of AGENT_REPLY) {
          if (cancelled) return;
          reply += ch;
          const next = reply;
          setScene((s) => ({ ...s, reply: next }));
          await wait(38);
        }
        await wait(4800);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [inView]);

  return (
    <section ref={rootRef} className="fe-memory" aria-labelledby="fe-memory-title">
      <div className="fe-container fe-memory-frame">
        <div className="fe-memory-stage fe-animate" aria-hidden>
          <div className="fe-memory-chat">
            {scene.showOpen ? (
              <div className="fe-memory-row fe-memory-row--agent">
                <GuideAvatar />
                <div className="fe-memory-bubble fe-memory-bubble--agent">
                  <p>{AGENT_OPEN}</p>
                  <span className="fe-memory-speak">
                    <Volume2 size={16} strokeWidth={2} />
                  </span>
                </div>
              </div>
            ) : null}

            {scene.showUser ? (
              <div className="fe-memory-row fe-memory-row--user">
                <div className="fe-memory-bubble fe-memory-bubble--user">
                  <p>{USER_LINE}</p>
                </div>
                <UserAvatar />
              </div>
            ) : null}

            {scene.loading ? (
              <div className="fe-memory-row fe-memory-row--agent">
                <GuideAvatar />
                <p className="fe-memory-loading">
                  <span className="fe-memory-loading-dots" />
                  {scene.loading}
                </p>
              </div>
            ) : null}

            {scene.showReply ? (
              <div className="fe-memory-row fe-memory-row--agent">
                <GuideAvatar />
                <div className="fe-memory-bubble fe-memory-bubble--agent">
                  <p>
                    {scene.reply}
                    {scene.reply.length < AGENT_REPLY.length ? (
                      <span className="fe-memory-caret" />
                    ) : null}
                  </p>
                  {scene.reply.length >= AGENT_REPLY.length ? (
                    <span className="fe-memory-speak">
                      <Volume2 size={16} strokeWidth={2} />
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="fe-memory-composer">
            <span className="fe-memory-composer-icon">
              <Mic size={20} strokeWidth={2.25} />
            </span>
            <p className={`fe-memory-composer-text${scene.draft ? " is-typing" : ""}`}>
              {scene.draft || COMPOSER_HINT}
              {scene.draft ? <span className="fe-memory-caret" /> : null}
            </p>
            <span className="fe-memory-composer-send">
              <AudioLines size={18} strokeWidth={2.25} />
            </span>
          </div>
        </div>
        <div className="fe-memory-copy">
          <p className="fe-section-kicker fe-animate">Memory</p>
          <LetterRevealHeading id="fe-memory-title" className="fe-memory-title">
            Notes you keep. The agent can use them in every session.
          </LetterRevealHeading>
          <ul className="fe-memory-points">
            {POINTS.map((point) => (
              <li key={point.title} className="fe-memory-point fe-animate">
                <p className="fe-memory-point-title">{point.title}</p>
                <p className="fe-memory-point-line">{point.line}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
