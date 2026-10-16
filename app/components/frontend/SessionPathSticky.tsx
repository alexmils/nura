"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { appPath } from "@/lib/app-base";
import {
  getLandingLenis,
  scrollToLandingSection,
} from "@/lib/landing-scroll";
import {
  ModePickDemo,
  NoColdStartDemo,
  SafePlaceDemo,
} from "./GroundFirstTutorial";
import { sectionList, sectionText } from "@/lib/marketing-sections";
import { LetterRevealHeading } from "./LetterRevealHeading";
import { SessionLoopKit } from "./SessionLoopKit";
import { SectionEdit } from "./section-editor/SectionEdit";
import { useSectionConfig } from "./section-editor/MarketingCopy";
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
  const copy = useSectionConfig("home-how");
  const stages: Stage[] = sectionList(copy, "stages").map((stage) => ({
    id: (stage.id || "ground") as StageId,
    nav: stage.nav,
    lead: stage.lead,
    line: stage.line,
    mediaLabel: "Image or video",
  }));
  const rhythm = sectionList(copy, "rhythm");
  const ground = sectionList(copy, "ground");
  const baseId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const navListRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState<StageId>("ground");
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
    let next: StageId = "ground";
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

  function pinStageInView() {
    const panels = rootRef.current?.querySelector<HTMLElement>(
      ".fe-spath-panels"
    );
    if (!panels) return;
    const excess = panels.getBoundingClientRect().bottom - window.innerHeight + 16;
    if (excess <= 8) return;
    const target = window.scrollY + excess;
    const lenis = getLandingLenis();
    if (lenis) {
      lenis.scrollTo(target, { duration: 0.55 });
    } else {
      window.scrollTo({ top: target, behavior: "smooth" });
    }
  }

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
      pinStageInView();
      centerChipInNav(navListRef.current, id);
    }, 50);
    // Lenis duration ~1.35s — nudge again so tall Ground demos stay on-screen
    window.setTimeout(() => {
      pinStageInView();
      centerChipInNav(navListRef.current, id);
    }, 1450);
  }

  return (
    <section
      ref={rootRef}
      id="how-it-works"
      className="fe-spath fe-has-edit"
      data-section="home-how"
      aria-labelledby={`${baseId}-heading`}
    >
      <SectionEdit id="home-how" />
      <div className="fe-container fe-spath-intro">
        <p className="fe-spath-badge">{sectionText(copy, "badge")}</p>
        <h2 id={`${baseId}-heading`} className="fe-spath-intro-title">
          <span className="fe-spath-intro-fade fe-spath-intro-fade--1">
            {sectionText(copy, "intro1")}{" "}
          </span>
          <span className="fe-spath-intro-fade fe-spath-intro-fade--2">
            {sectionText(copy, "intro2")}{" "}
          </span>
          <span className="fe-spath-intro-fade fe-spath-intro-fade--3">
            {sectionText(copy, "intro3")}
          </span>
        </h2>
      </div>

      <div className="fe-spath-track-wrap">
        <div className="fe-container fe-spath-track">
          <nav className="fe-spath-nav" aria-label="Session stages">
            <ul ref={navListRef} className="fe-spath-nav-list">
              {stages.map((stage) => {
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
              {stages.map((stage) => (
                <div
                  key={stage.id}
                  id={`session-path-${stage.id}`}
                  data-spath-sentinel={stage.id}
                  className="fe-spath-sentinel"
                />
              ))}
            </div>
          <div className="fe-spath-panels">
            {stages.map((stage) => (
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
                        {rhythm.map((card) => (
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
                      <div
                        className="fe-spath-media fe-spath-media--live"
                        role="img"
                        aria-label="Choose AI agent-guided or Self-guided"
                      >
                        {active === "ground" ? <ModePickDemo /> : null}
                      </div>
                      <ul className="fe-spath-pair" data-spath-pair>
                        {ground.map((card) => (
                          <li
                            key={card.id}
                            className={
                              active === "ground"
                                ? "fe-spath-pair-card is-in"
                                : "fe-spath-pair-card is-pending"
                            }
                          >
                            {active === "ground" ? (
                              <LetterRevealHeading
                                as="h4"
                                eager
                                className="fe-spath-pair-title"
                              >
                                {card.title}
                              </LetterRevealHeading>
                            ) : (
                              <h4 className="fe-spath-pair-title">
                                {card.title}
                              </h4>
                            )}
                            <p className="fe-spath-pair-line">{card.line}</p>
                            <div
                              className="fe-spath-media fe-spath-media--card fe-spath-media--live"
                              role="img"
                              aria-label={card.title}
                            >
                              {active === "ground" ? (
                                card.id === "safe" ? (
                                  <SafePlaceDemo />
                                ) : (
                                  <NoColdStartDemo />
                                )
                              ) : null}
                            </div>
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
