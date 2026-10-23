"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Eye, Gamepad2, Volume2 } from "lucide-react";
import {
  getLandingLenis,
  scrollToLandingSection,
} from "@/lib/landing-scroll";
import {
  ModePickDemo,
  NoColdStartDemo,
  SafePlaceDemo,
} from "./GroundFirstTutorial";
import {
  CheckInDemo,
  CloseGentlyDemo,
  RHYTHM_MODES,
  RhythmDemo,
  type RhythmMode,
} from "./SessionStageDemos";
import {
  HIDDEN_ITEM_KEY,
  mediaNames,
  sectionList,
  sectionText,
  slotMedia,
  type SectionItem,
} from "@/lib/marketing-sections";
import { setEditorFocusGetter } from "./section-editor/editor-focus";
import { frameKey, storedFrameStyle } from "@/lib/image-position";
import { SectionMedia } from "./SectionMedia";
import { LetterRevealHeading } from "./LetterRevealHeading";
import { SectionEdit } from "./section-editor/SectionEdit";
import { EditablePart, HiddenSectionNote } from "./section-editor/EditablePart";
import { useSectionConfig, useSectionOn } from "./section-editor/MarketingCopy";
import { useIsPlatformAdmin } from "./section-editor/useIsPlatformAdmin";
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
  mediaKind: string;
  mediaImage: string;
  mediaVideo: string;
  mediaPoster: string;
  mediaAlt: string;
};

function MediaPlaceholder({
  label,
  compact,
  kind,
  image,
  video,
  poster,
  alt,
  demo,
  demoLabel,
}: {
  label: string;
  compact?: boolean;
  kind?: string;
  image?: string;
  video?: string;
  poster?: string;
  alt?: string;
  /** Built-in animation shown while no image/video is set in the editor. */
  demo?: ReactNode;
  demoLabel?: string;
}) {
  const hasMedia = kind !== "none" && Boolean(image || video);
  if (!hasMedia && demo !== undefined) {
    return (
      <div
        className="fe-spath-media fe-spath-media--live"
        role="img"
        aria-label={demoLabel || label}
      >
        {demo}
      </div>
    );
  }
  return (
    <div
      className={
        compact ? "fe-spath-media fe-spath-media--card" : "fe-spath-media"
      }
      role={hasMedia ? undefined : "img"}
      aria-label={hasMedia ? undefined : label}
    >
      {hasMedia ? (
        <SectionMedia
          kind={kind || "image"}
          image={image || ""}
          video={video || ""}
          poster={poster || ""}
          alt={alt || label}
        />
      ) : (
        <span className="fe-spath-media-label">{label}</span>
      )}
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
  const stagesCopy = useSectionConfig("home-how-stages");
  const rhythmCopy = useSectionConfig("home-how-rhythm");
  const groundCopy = useSectionConfig("home-how-ground");
  const rhythmOn = useSectionOn("home-how-rhythm");
  const groundOn = useSectionOn("home-how-ground");
  const admin = useIsPlatformAdmin();
  const stages: Stage[] = sectionList(stagesCopy, "stages").map((stage) => ({
    id: (stage.id || "ground") as StageId,
    nav: stage.nav,
    lead: stage.lead,
    line: stage.line,
    mediaLabel: "Image or video",
    mediaKind: stage.mediaKind,
    mediaImage: stage.mediaImage,
    mediaVideo: stage.mediaVideo,
    mediaPoster: stage.mediaPoster,
    mediaAlt: stage.mediaAlt,
  }));
  // Keep each card's saved index so its icon frame key matches the editor.
  const rhythmAll = Array.isArray(rhythmCopy.rhythm) ? rhythmCopy.rhythm : [];
  const rhythm = rhythmAll
    .map((card, at) => ({ card, at }))
    .filter(({ card }) => card[HIDDEN_ITEM_KEY] !== "1");
  const rhythmNames = mediaNames("rhythmMedia");
  const rhythmKind = sectionText(rhythmCopy, rhythmNames.kind);
  const rhythmImage = sectionText(rhythmCopy, rhythmNames.image);
  const rhythmVideo = sectionText(rhythmCopy, rhythmNames.video);
  const rhythmPoster = sectionText(rhythmCopy, rhythmNames.poster);
  const rhythmAlt = sectionText(rhythmCopy, rhythmNames.alt);
  const rhythmHasMedia =
    rhythmKind !== "none" && Boolean(rhythmImage || rhythmVideo);
  const ground = sectionList(groundCopy, "ground");
  // Admin-uploaded media replaces a Ground first animation; empty = animation.
  const groundMedia = slotMedia(groundCopy, "groundMedia");
  const baseId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const navListRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState<StageId>("ground");
  const [compactNav, setCompactNav] = useState(true);
  // Rhythm demo: a hovered/clicked card pins its mode; otherwise it auto-cycles.
  const [rhythmHover, setRhythmHover] = useState<RhythmMode | null>(null);
  const [rhythmPick, setRhythmPick] = useState<RhythmMode | null>(null);
  const [rhythmShown, setRhythmShown] = useState<RhythmMode>("eyes");
  const rhythmPinned = rhythmHover ?? rhythmPick;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 859px)");
    const apply = () => setCompactNav(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const activeRef = useRef<StageId>("ground");

  // The stages Edit chip opens the editor on the stage being shown.
  const stagesRaw = stagesCopy.stages;
  useEffect(() => {
    setEditorFocusGetter("home-how-stages", () => {
      const list = Array.isArray(stagesRaw) ? (stagesRaw as SectionItem[]) : [];
      const index = list.findIndex((item) => item.id === activeRef.current);
      return index >= 0 ? { list: "stages", index } : null;
    });
    return () => setEditorFocusGetter("home-how-stages", null);
  }, [stagesRaw]);
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
    // On desktop the nav is a sticky side column as tall as the stage, so its
    // box height must not be subtracted from the scroll target; only the mobile
    // horizontal nav sits above the panels and needs the offset.
    const extra =
      nav && compactNav ? -Math.round(nav.getBoundingClientRect().height + 10) : 0;
    // After the full-screen video, the first stage's sentinel also owns the
    // hand-off viewport. Ground first's content starts one viewport lower, so
    // its nav jump must not land back on the video.
    const afterVideo = Boolean(
      rootRef.current?.previousElementSibling?.classList.contains("fe-custom--video")
    );
    const handoff =
      id === "ground" && !compactNav && afterVideo ? window.innerHeight : 0;
    scrollToLandingSection(`session-path-${id}`, extra + handoff);
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
      className="fe-spath fe-has-edit"
      data-section="home-how"
      aria-labelledby="fe-how-intro-title"
    >
      {/* Desktop hand-off after a full-screen video: a zero-height sticky hold
          so the incoming pale sheet can slide over the video without adding
          layout height or transforming the sticky stage. */}
      <span className="fe-spath-slide-hold" aria-hidden>
        <span className="fe-spath-slide-bg">
          <span className="fe-spath-slide-edge" />
        </span>
      </span>
      {/* White sweep bar: leads the incoming sheet like a curtain, then leaves
          to the left so it never sits on the stage after the slide. */}
      <span className="fe-spath-curtain-hold" aria-hidden>
        <span className="fe-spath-slide-curtain" />
      </span>
      <EditablePart id="home-how-stages">
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

                  {stage.id === "rhythm" && !rhythmOn ? (
                    admin ? <HiddenSectionNote id="home-how-rhythm" /> : null
                  ) : stage.id === "ground" && !groundOn ? (
                    admin ? <HiddenSectionNote id="home-how-ground" /> : null
                  ) : stage.id === "rhythm" ? (
                    <div
                      className={admin ? "fe-spath-rhythm fe-has-edit" : "fe-spath-rhythm"}
                      data-section={admin ? "home-how-rhythm" : undefined}
                    >
                      <SectionEdit id="home-how-rhythm" />
                      <ul className="fe-spath-rhythm-grid">
                        {rhythm.map(({ card, at }) => {
                          const mode = RHYTHM_MODES[at];
                          const DefaultIcon =
                            mode === "ears" ? Volume2 : mode === "hands" ? Gamepad2 : Eye;
                          const rhythmMediaSet =
                            rhythmHasMedia ||
                            (stage.mediaKind !== "none" &&
                              Boolean(stage.mediaImage || stage.mediaVideo));
                          const live = Boolean(mode) && !rhythmMediaSet;
                          const toggle = () =>
                            setRhythmPick((p) => (p === mode ? null : mode));
                          return (
                          <li
                            key={card.label || at}
                            className={
                              live && !compactNav && rhythmShown === mode && active === "rhythm"
                                ? "fe-spath-rhythm-card is-live"
                                : "fe-spath-rhythm-card"
                            }
                            onMouseEnter={live ? () => setRhythmHover(mode) : undefined}
                            onMouseLeave={live ? () => setRhythmHover(null) : undefined}
                            onClick={live ? toggle : undefined}
                            data-rhythm-mode={live ? mode : undefined}
                          >
                            <span
                              className={`fe-spath-rhythm-icon${card.icon ? " has-image" : ""}`}
                              aria-hidden
                            >
                              {card.icon ? (
                                // eslint-disable-next-line @next/next/no-img-element -- admin icons can be any Cloudinary or site URL
                                <img
                                  src={card.icon}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  data-frame-key={frameKey("home-how-rhythm", `rhythm.${at}.icon`)}
                                  style={storedFrameStyle(card.iconPos)}
                                />
                              ) : mode ? (
                                <DefaultIcon size={16} strokeWidth={2.1} />
                              ) : null}
                            </span>
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
                          );
                        })}
                      </ul>
                      <MediaPlaceholder
                        label={stage.mediaLabel}
                        kind={rhythmHasMedia ? rhythmKind : stage.mediaKind}
                        image={rhythmHasMedia ? rhythmImage : stage.mediaImage}
                        video={rhythmHasMedia ? rhythmVideo : stage.mediaVideo}
                        poster={rhythmHasMedia ? rhythmPoster : stage.mediaPoster}
                        alt={rhythmHasMedia ? rhythmAlt : stage.mediaAlt}
                        demoLabel="A ball moving left and right, felt with eyes, ears, or hands"
                        demo={
                          active === "rhythm" ? (
                            <RhythmDemo
                              pinned={rhythmPinned}
                              onModeChange={setRhythmShown}
                            />
                          ) : null
                        }
                      />
                    </div>
                  ) : stage.id === "ground" ? (
                    <div
                      className={admin ? "fe-spath-ground fe-has-edit" : "fe-spath-ground"}
                      data-section={admin ? "home-how-ground" : undefined}
                    >
                      <SectionEdit id="home-how-ground" />
                      <div
                        className="fe-spath-media fe-spath-media--live"
                        role="img"
                        aria-label={groundMedia?.alt || "Choose AI agent-guided or Self-guided"}
                      >
                        {groundMedia ? (
                          <SectionMedia
                            kind={groundMedia.kind}
                            image={groundMedia.image}
                            video={groundMedia.video}
                            poster={groundMedia.poster}
                            alt={groundMedia.alt}
                          />
                        ) : active === "ground" ? (
                          <ModePickDemo />
                        ) : null}
                      </div>
                      <ul className="fe-spath-pair" data-spath-pair>
                        {ground.map((card) => {
                          const cardMedia = slotMedia(card, "media");
                          return (
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
                              aria-label={cardMedia?.alt || card.title}
                            >
                              {cardMedia ? (
                                <SectionMedia
                                  kind={cardMedia.kind}
                                  image={cardMedia.image}
                                  video={cardMedia.video}
                                  poster={cardMedia.poster}
                                  alt={cardMedia.alt}
                                />
                              ) : active === "ground" ? (
                                card.id === "safe" ? (
                                  <SafePlaceDemo />
                                ) : (
                                  <NoColdStartDemo />
                                )
                              ) : null}
                            </div>
                          </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : (
                    <div className="fe-spath-stage-media fe-has-edit">
                      <SectionEdit id="home-how-stages" lift />
                      <MediaPlaceholder
                        label={stage.mediaLabel}
                        kind={stage.mediaKind}
                        image={stage.mediaImage}
                        video={stage.mediaVideo}
                        poster={stage.mediaPoster}
                        alt={stage.mediaAlt}
                        demoLabel={
                          stage.id === "checkin"
                            ? "Check-in after a set: SUD rating and a body scan"
                            : stage.id === "close"
                              ? "Closing a session with a grounding step"
                              : undefined
                        }
                        demo={
                          stage.id === "checkin" ? (
                            active === "checkin" ? <CheckInDemo /> : null
                          ) : stage.id === "close" ? (
                            active === "close" ? <CloseGentlyDemo /> : null
                          ) : undefined
                        }
                      />
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
          </div>
        </div>
      </div>
      </EditablePart>

    </section>
  );
}
