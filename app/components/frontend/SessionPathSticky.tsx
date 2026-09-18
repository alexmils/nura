"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { appPath } from "@/lib/app-base";
import {
  getLandingLenis,
  scrollToLandingSection,
} from "@/lib/landing-scroll";
import { LetterRevealHeading } from "./LetterRevealHeading";
import { SessionLoopKit } from "./SessionLoopKit";
import "./session-path-sticky.css";

type StageId = "ground" | "rhythm" | "checkin" | "close";

type Stage = {
  id: StageId;
  nav: string;
  /** Bold lead — Attio “Your team, amplified.” slot (same row as nav). */
  lead: string;
  /** Continues on the same line after the lead. */
  line: string;
  mediaLabel: string;
};

const STAGES: Stage[] = [
  {
    id: "ground",
    nav: "Ground first",
    // Attio right ≠ left nav (“Your team, amplified.” vs “Build pipeline”)
    lead: "From ground to close — one calm loop.",
    line: "Intake, feet on the floor, a calm place — no set starts cold. You settle first, then the session opens at your pace, not the clock’s.",
    mediaLabel: "Image or video",
  },
  {
    id: "rhythm",
    nav: "Choose your rhythm",
    lead: "Eyes, ears, or hands — same rhythm.",
    line: "Pick how you feel the left–right pulse — visual sets, stereo cues, or a gamepad — one calm loop, three ways in.",
    mediaLabel: "Image or video",
  },
  {
    id: "checkin",
    nav: "Check in",
    lead: "Pause after each set.",
    line: "SUD and a body scan with the agent — name what shifted, then decide if another set belongs here or if you stop.",
    mediaLabel: "Image or video",
  },
  {
    id: "close",
    nav: "Close gently",
    lead: "End when you’re ready.",
    line: "Closure and grounding out — you leave with both feet on the floor, not mid-set. Enough is enough when you say so.",
    mediaLabel: "Image or video",
  },
];

const RHYTHM_CARDS = [
  { label: "Eyes", hint: "Visual sets" },
  { label: "Ears", hint: "Audio cues" },
  { label: "Hands", hint: "Gamepad" },
] as const;

/** Attio dual cards under the main stage visual (ground only). */
const GROUND_PAIR = [
  {
    title: "Safe place first.",
    line: "Feet on the floor before anything heavy.",
    mediaLabel: "Image or video",
  },
  {
    title: "No cold starts.",
    line: "Intake and breath — then the set.",
    mediaLabel: "Image or video",
  },
] as const;

function MediaPlaceholder({
  label,
  compact,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact ? "fe-spath-media fe-spath-media--card" : "fe-spath-media"
      }
      role="img"
      aria-label={label}
    >
      <span className="fe-spath-media-label">{label}</span>
    </div>
  );
}

function ScreenPlaceholder() {
  return (
    <div
      className="fe-spath-screen"
      role="img"
      aria-label="App screen placeholder"
    >
      <span className="fe-spath-screen-chrome" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="fe-spath-media-label">Add your screen image here</span>
    </div>
  );
}

function centerChipInNav(list: HTMLUListElement | null, id: StageId) {
  if (!list) return;
  const nav = list.closest(".fe-spath-nav");
  const btn = list.querySelector<HTMLElement>(`[data-spath-chip="${id}"]`);
  if (!nav || !btn) return;
  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const navMid = navRect.left + navRect.width / 2;
  const btnMid = btnRect.left + btnRect.width / 2;
  const matrix = new DOMMatrix(getComputedStyle(list).transform);
  const next = matrix.m41 + (navMid - btnMid);
  list.style.transform = `translate3d(${next}px, 0, 0)`;
}

/** Attio-style sticky path: intro above, then sticky nav | scrolling stages. */
export function SessionPathSticky() {
  const baseId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const navListRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState<StageId>("ground");
  const [pairIn, setPairIn] = useState(false);
  const [compactNav, setCompactNav] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 859px)");
    const apply = () => setCompactNav(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const activeRef = useRef<StageId>("ground");
  const lockUntilRef = useRef(0);

  const syncActive = useCallback(() => {
    if (Date.now() < lockUntilRef.current) return;
    const root = rootRef.current;
    if (!root) return;
    const sentinels = root.querySelectorAll<HTMLElement>("[data-spath-sentinel]");
    if (!sentinels.length) return;

    const marker = window.innerHeight * 0.5;
    let next: StageId = STAGES[0]!.id;
    let best = Number.POSITIVE_INFINITY;

    sentinels.forEach((el) => {
      const id = el.getAttribute("data-spath-sentinel") as StageId | null;
      if (!id) return;
      const top = el.getBoundingClientRect().top;
      const dist = Math.abs(top - marker);
      if (top <= marker + 120 && dist < best) {
        best = dist;
        next = id;
      }
    });

    if (next !== activeRef.current) {
      activeRef.current = next;
      setActive(next);
    }

    const ground = root.querySelector<HTMLElement>(
      '[data-spath-sentinel="ground"]'
    );
    if (ground) {
      const r = ground.getBoundingClientRect();
      const local = Math.min(
        1,
        Math.max(0, (marker - r.top) / Math.max(r.height, 1))
      );
      setPairIn(next === "ground" && local > 0.35);
    } else {
      setPairIn(next === "ground");
    }
  }, []);

  useEffect(() => {
    syncActive();
    window.addEventListener("scroll", syncActive, { passive: true });
    window.addEventListener("resize", syncActive);

    let detachLenis: (() => void) | undefined;
    const bindLenis = () => {
      const lenis = getLandingLenis();
      if (!lenis || detachLenis) return;
      detachLenis = lenis.on("scroll", () => syncActive());
    };
    bindLenis();
    const retry = window.setInterval(bindLenis, 200);
    window.setTimeout(() => window.clearInterval(retry), 3000);

    return () => {
      window.removeEventListener("scroll", syncActive);
      window.removeEventListener("resize", syncActive);
      window.clearInterval(retry);
      detachLenis?.();
    };
  }, [syncActive]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nav = root.querySelector<HTMLElement>(".fe-spath-nav");
    if (!nav) return;
    const apply = () => {
      root.style.setProperty("--spath-nav-h", `${nav.offsetHeight}px`);
      centerChipInNav(navListRef.current, activeRef.current);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(nav);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      centerChipInNav(navListRef.current, active);
    }, 50);
    return () => window.clearTimeout(t);
  }, [active]);

  function goTo(id: StageId) {
    activeRef.current = id;
    setActive(id);
    lockUntilRef.current = Date.now() + 1400;
    const nav = rootRef.current?.querySelector<HTMLElement>(".fe-spath-nav");
    const extra = nav
      ? -Math.round(nav.getBoundingClientRect().height + 10)
      : 0;
    scrollToLandingSection(`session-path-${id}`, extra);
    window.setTimeout(() => {
      centerChipInNav(navListRef.current, id);
    }, 50);
  }

  return (
    <section
      ref={rootRef}
      id="how-it-works"
      className="fe-spath"
      aria-labelledby={`${baseId}-heading`}
    >
      <div className="fe-container fe-spath-intro">
        <p className="fe-spath-badge">How it works</p>
        <h2 id={`${baseId}-heading`} className="fe-spath-intro-title">
          <span className="fe-spath-intro-fade fe-spath-intro-fade--1">
            Ground first. Choose your rhythm. Check in after each set.{" "}
          </span>
          <span className="fe-spath-intro-fade fe-spath-intro-fade--2">
            Close gently when it’s enough — then Free between sessions.{" "}
          </span>
          <span className="fe-spath-intro-fade fe-spath-intro-fade--3">
            One calm loop in the app. No rush. No cold starts.
          </span>
        </h2>
      </div>

      <div className="fe-spath-track-wrap">
        <div className="fe-container fe-spath-track">
          <nav className="fe-spath-nav" aria-label="Session stages">
            <ul ref={navListRef} className="fe-spath-nav-list">
              {STAGES.map((stage) => {
                const isActive = active === stage.id;
                return (
                  <li key={stage.id}>
                    <button
                      type="button"
                      data-spath-chip={stage.id}
                      className={
                        isActive
                          ? "fe-spath-nav-btn is-active"
                          : "fe-spath-nav-btn"
                      }
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => goTo(stage.id)}
                    >
                      {stage.nav}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="fe-spath-stage-scroll">
            <div className="fe-spath-sentinels" aria-hidden>
              {STAGES.map((stage) => (
                <div
                  key={stage.id}
                  id={`session-path-${stage.id}`}
                  data-spath-sentinel={stage.id}
                  className="fe-spath-sentinel"
                />
              ))}
            </div>
          <div className="fe-spath-panels">
            {STAGES.map((stage) => (
              <article
                key={stage.id}
                data-spath-panel={stage.id}
                className={
                  active === stage.id
                    ? "fe-spath-panel is-active"
                    : "fe-spath-panel"
                }
                aria-hidden={active === stage.id ? undefined : true}
                aria-labelledby={`${baseId}-${stage.id}-title`}
              >
                <div className="fe-spath-panel-inner">
                  {/* Attio right row — smaller than section H2; lead ≠ nav label */}
                  <div className="fe-spath-panel-copy">
                    <p
                      id={`${baseId}-${stage.id}-title`}
                      className="fe-spath-panel-lead"
                    >
                      {active === stage.id && !compactNav ? (
                        <LetterRevealHeading
                          as="span"
                          eager
                          className="fe-spath-panel-lead-rise"
                        >
                          {stage.lead}
                        </LetterRevealHeading>
                      ) : (
                        <strong>{stage.lead}</strong>
                      )}{" "}
                      <span className="fe-spath-panel-line">{stage.line}</span>
                    </p>
                  </div>

                  {stage.id === "rhythm" ? (
                    <div className="fe-spath-rhythm">
                      <ul className="fe-spath-rhythm-grid">
                        {RHYTHM_CARDS.map((card) => (
                          <li key={card.label} className="fe-spath-rhythm-card">
                            <span className="fe-spath-rhythm-icon" aria-hidden />
                            {active === "rhythm" ? (
                              <LetterRevealHeading
                                as="span"
                                eager
                                className="fe-spath-rhythm-label"
                              >
                                {card.label}
                              </LetterRevealHeading>
                            ) : (
                              <span className="fe-spath-rhythm-label">
                                {card.label}
                              </span>
                            )}
                            <span className="fe-spath-rhythm-hint">
                              {card.hint}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <MediaPlaceholder label={stage.mediaLabel} />
                    </div>
                  ) : stage.id === "ground" ? (
                    <div className="fe-spath-ground">
                      <MediaPlaceholder label={stage.mediaLabel} />
                      <ul className="fe-spath-pair" data-spath-pair>
                        {GROUND_PAIR.map((card) => (
                          <li
                            key={card.title}
                            className={
                              pairIn
                                ? "fe-spath-pair-card is-in"
                                : "fe-spath-pair-card is-pending"
                            }
                          >
                            {pairIn ? (
                              <LetterRevealHeading
                                as="h4"
                                eager
                                className="fe-spath-pair-title"
                              >
                                {card.title}
                              </LetterRevealHeading>
                            ) : (
                              <h4 className="fe-spath-pair-title">{card.title}</h4>
                            )}
                            <p className="fe-spath-pair-line">{card.line}</p>
                            <MediaPlaceholder
                              label={card.mediaLabel}
                              compact
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <MediaPlaceholder label={stage.mediaLabel} />
                  )}
                </div>
              </article>
            ))}
          </div>
          </div>
        </div>
      </div>

      <div className="fe-spath-finale">
        <div className="fe-spath-finale-zoom">
        <div className="fe-container fe-spath-finale-inner">
          <p className="fe-spath-finale-kicker">Between sessions</p>
          <LetterRevealHeading as="h3" className="fe-spath-finale-title">
            Self-guided session — sets without an agent
          </LetterRevealHeading>
          <p className="fe-spath-finale-line">
            Practice in the gap, on your schedule.
          </p>
          <Link
            href={appPath("/create-account")}
            className="fe-spath-cta frontend-btn-ghost"
          >
            Start for free
          </Link>
          <ScreenPlaceholder />
        </div>
        </div>
      </div>

      <SessionLoopKit />
    </section>
  );
}
