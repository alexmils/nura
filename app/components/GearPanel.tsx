"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ChevronDown,
  Circle,
  CircleDot,
  Infinity as InfinityIcon,
  Minus,
  Music2,
  Palette,
  Pause,
  Play,
  Repeat2,
  Square,
  Timer,
  Vibrate,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import type {
  AnimationMode,
  BlsSettings,
  SoundMode,
  SpeedPresetIndex,
  VibrationMode,
} from "@/lib/types";
import { DEFAULT_BLS } from "@/lib/types";
import {
  BLS_BALL_MAX_DT_SEC,
  blsBallStep,
} from "@/lib/bls-ball-motion";
import {
  BLS_SPEED_MAX,
  BLS_SPEED_MIN,
  BLS_SPEED_STEP,
  clampBlsSpeed,
  getActiveSpeedHz,
} from "@/lib/bls-speed";
import {
  adjustRepeatMode,
  BLS_REPEATS_DEFAULT,
  BLS_REPEATS_MAX,
  BLS_REPEATS_MIN,
  clampBlsRepeatsCount,
  formatRepeatsLabel,
} from "@/lib/bls-repeats";
import { useGamepadConnected } from "@/lib/useGamepadConnected";

type SectionId =
  | "speed"
  | "repeats"
  | "sound"
  | "animation"
  | "look"
  | "vibration";

/** Collapsible section ids, exported for the product tour. */
export type GearSectionId = SectionId;

const SOUND_OPTIONS: { value: SoundMode; label: string; icon: ReactNode }[] = [
  { value: "mute", label: "Mute", icon: <VolumeX size={16} strokeWidth={2} /> },
  {
    value: "click",
    label: "Click",
    icon: <CircleDot size={16} strokeWidth={2} />,
  },
  {
    value: "pulse",
    label: "Pulse",
    icon: <Activity size={16} strokeWidth={2} />,
  },
  { value: "tone", label: "Tone", icon: <Music2 size={16} strokeWidth={2} /> },
];

const ANIMATION_OPTIONS: {
  value: AnimationMode;
  label: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    value: "dot",
    label: "Dot",
    hint: "Moving ball",
    icon: <Circle size={18} strokeWidth={2.25} />,
  },
  {
    value: "flash",
    label: "Flash",
    hint: "Side highlights",
    icon: <Square size={17} strokeWidth={2} />,
  },
];

const VIBRATION_OPTIONS: {
  value: VibrationMode;
  label: string;
  icon: ReactNode;
}[] = [
  { value: "none", label: "Off", icon: <Minus size={16} strokeWidth={2.25} /> },
  { value: "soft", label: "Soft", icon: <Vibrate size={15} strokeWidth={2} /> },
  {
    value: "hard",
    label: "Hard",
    icon: <Vibrate size={17} strokeWidth={2.5} />,
  },
];

function formatHz(hz: number): string {
  return `${hz.toFixed(1)} Hz`;
}

function ChoiceChip({
  selected,
  onClick,
  ariaLabel,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={onClick}
      className={`gear-choice ${selected ? "gear-choice-active" : ""}`}
    >
      {children}
    </button>
  );
}

function GearSection({
  id,
  title,
  icon,
  open,
  onToggle,
  summary,
  children,
}: {
  id: SectionId;
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  summary?: string;
  children: ReactNode;
}) {
  const panelId = useId();
  return (
    <section className={`gear-section ${open ? "gear-section-open" : ""}`}>
      <button
        type="button"
        className="gear-section-head"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="gear-section-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="gear-section-title">{title}</span>
        {summary && !open ? (
          <span className="gear-section-summary">{summary}</span>
        ) : null}
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={`gear-section-chevron ${open ? "gear-section-chevron-open" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div id={panelId} className="gear-section-body" data-section={id}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

function PreviewStage({ bls, playing }: { bls: BlsSettings; playing: boolean }) {
  const [pos, setPos] = useState(0.5);
  const posRef = useRef(0.5);
  const dirRef = useRef(1);
  const speed = getActiveSpeedHz(bls);
  const previewSize = Math.max(18, Math.round(bls.ballSize * 0.45));

  useEffect(() => {
    if (!playing) {
      posRef.current = 0.5;
      dirRef.current = 1;
      setPos(0.5);
      return;
    }

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), BLS_BALL_MAX_DT_SEC);
      last = now;
      const step = blsBallStep(Math.max(0.1, speed), dt);
      let next = posRef.current + dirRef.current * step;
      if (next >= 1) {
        next = 1;
        dirRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        dirRef.current = 1;
      }
      posRef.current = next;
      setPos(next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  return (
    <div
      className="gear-preview-stage"
      style={{ background: bls.background }}
      aria-hidden="true"
    >
      {bls.animation === "flash" && playing ? (
        <>
          <div
            className="gear-preview-flash gear-preview-flash-left"
            style={{ opacity: pos < 0.5 ? 1 : 0.12 }}
          />
          <div
            className="gear-preview-flash gear-preview-flash-right"
            style={{ opacity: pos >= 0.5 ? 1 : 0.12 }}
          />
        </>
      ) : null}
      {bls.animation === "dot" && playing ? (
        <div
          className="gear-preview-ball"
          style={{
            width: previewSize,
            height: previewSize,
            background: bls.ballColor,
            left: `calc(${pos * 100}% - ${previewSize / 2}px)`,
          }}
        />
      ) : null}
      {!playing ? (
        <div className="gear-preview-idle">
          <span
            className="gear-preview-idle-dot"
            style={{ background: bls.ballColor, width: previewSize, height: previewSize }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function GearPanel({
  bls,
  onChange,
  onClose,
  expandSection,
}: {
  bls: BlsSettings;
  onChange: (patch: Partial<BlsSettings>) => void;
  onClose: () => void;
  /** Guide request: open this section. A new object re-opens it. */
  expandSection?: { id: GearSectionId; nonce: number } | null;
}) {
  const gamepadConnected = useGamepadConnected();
  const [playing, setPlaying] = useState(false);
  const [openSection, setOpenSection] = useState<SectionId | null>("speed");

  // Only the open section renders its body, so the tour cannot point at it
  // until it is expanded.
  useEffect(() => {
    if (expandSection) setOpenSection(expandSection.id);
  }, [expandSection]);

  const toggleSection = (id: SectionId) => {
    setOpenSection((current) => (current === id ? null : id));
  };

  const setSpeedPreset = (index: SpeedPresetIndex, value: number) => {
    const next = [...bls.speedPresets] as [number, number, number];
    next[index] = clampBlsSpeed(value);
    onChange({ speedPresets: next, activeSpeedPreset: index });
  };

  const resetAll = () => {
    onChange({ ...DEFAULT_BLS });
    setPlaying(false);
  };

  return (
    <div
      className="gear-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Adjustments"
      onClick={onClose}
    >
      <div className="gear-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="gear-header">
          <button
            type="button"
            className="btn-icon-sm gear-close"
            aria-label="Close adjustments"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
          <h2 className="gear-title">Adjustments</h2>
          <button type="button" className="gear-reset-link" onClick={resetAll}>
            Reset
          </button>
        </header>

        <div className="gear-scroll">
          <section className="gear-preview-block">
            <div className="gear-preview-label-row">
              <span className="gear-eyebrow">Live preview</span>
              <span className="gear-preview-meta">
                {formatHz(getActiveSpeedHz(bls))}
                {" · "}
                {formatRepeatsLabel(bls.repeats)}
              </span>
            </div>

            <div className="gear-preview-card">
              <PreviewStage bls={bls} playing={playing} />
              <button
                type="button"
                className="gear-preview-play"
                aria-label={playing ? "Pause preview" : "Play preview"}
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? (
                  <Pause size={18} strokeWidth={2.25} />
                ) : (
                  <Play size={18} strokeWidth={2.25} className="gear-play-icon" />
                )}
              </button>
            </div>

            <div className="gear-quick">
              <div className="gear-quick-group">
                <div className="gear-quick-seg" role="group" aria-label="Speed preset">
                  {bls.speedPresets.map((hz, index) => {
                    const i = index as SpeedPresetIndex;
                    return (
                      <ChoiceChip
                        key={i}
                        selected={bls.activeSpeedPreset === i}
                        ariaLabel={`Use speed ${formatHz(hz)}`}
                        onClick={() => onChange({ activeSpeedPreset: i })}
                      >
                        {Number.isInteger(hz) ? String(hz) : hz.toFixed(1)}
                      </ChoiceChip>
                    );
                  })}
                </div>
                <span className="gear-quick-label">Speed</span>
              </div>
              <div className="gear-quick-group">
                <div className="gear-quick-seg" role="group" aria-label="Repeats">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={BLS_REPEATS_MIN}
                    max={BLS_REPEATS_MAX}
                    step={1}
                    className={`gear-choice gear-repeats-input ${
                      bls.repeats !== "infinity" ? "gear-choice-active" : ""
                    }`}
                    aria-label="Repeat count"
                    value={
                      typeof bls.repeats === "number"
                        ? bls.repeats
                        : BLS_REPEATS_DEFAULT
                    }
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                        e.preventDefault();
                        e.stopPropagation();
                        const direction = e.key === "ArrowUp" ? 1 : -1;
                        const base =
                          bls.repeats === "infinity"
                            ? BLS_REPEATS_DEFAULT
                            : bls.repeats;
                        onChange({
                          repeats: adjustRepeatMode(base, direction),
                        });
                      }
                    }}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      onChange({ repeats: clampBlsRepeatsCount(n) });
                    }}
                    onFocus={() => {
                      if (bls.repeats === "infinity") {
                        onChange({ repeats: BLS_REPEATS_DEFAULT });
                      }
                    }}
                  />
                  <ChoiceChip
                    selected={bls.repeats === "infinity"}
                    ariaLabel="Unlimited repeats"
                    onClick={() => onChange({ repeats: "infinity" })}
                  >
                    <InfinityIcon size={15} strokeWidth={2} />
                  </ChoiceChip>
                </div>
                <span className="gear-quick-label">Repeats</span>
              </div>
              <div className="gear-quick-group">
                <div className="gear-quick-seg" role="group" aria-label="Animation">
                  {ANIMATION_OPTIONS.map((opt) => (
                    <ChoiceChip
                      key={opt.value}
                      selected={bls.animation === opt.value}
                      ariaLabel={`Animation ${opt.label}`}
                      onClick={() => onChange({ animation: opt.value })}
                    >
                      {opt.icon}
                    </ChoiceChip>
                  ))}
                </div>
                <span className="gear-quick-label">Motion</span>
              </div>
            </div>
          </section>

          <div className="gear-details-label">Details</div>

          <div className="gear-accordion">
            <GearSection
              id="speed"
              title="Speed"
              icon={<Zap size={16} strokeWidth={2} />}
              open={openSection === "speed"}
              onToggle={() => toggleSection("speed")}
              summary={formatHz(getActiveSpeedHz(bls))}
            >
              <p className="gear-help">
                Three quick presets on the toolbar. Drag to fine-tune each one.
              </p>
              {bls.speedPresets.map((hz, index) => {
                const i = index as SpeedPresetIndex;
                const active = bls.activeSpeedPreset === i;
                return (
                  <label key={i} className="gear-slider-row">
                    <button
                      type="button"
                      className={`gear-preset-index ${active ? "gear-preset-index-active" : ""}`}
                      aria-label={`Select preset ${i + 1}`}
                      onClick={() => onChange({ activeSpeedPreset: i })}
                    >
                      {i + 1}
                    </button>
                    <input
                      type="range"
                      min={BLS_SPEED_MIN}
                      max={BLS_SPEED_MAX}
                      step={BLS_SPEED_STEP}
                      value={hz}
                      onChange={(e) =>
                        setSpeedPreset(i, parseFloat(e.target.value))
                      }
                      className="gear-range"
                      aria-label={`Preset ${i + 1} speed`}
                    />
                    <span className="gear-slider-value">{formatHz(hz)}</span>
                  </label>
                );
              })}
            </GearSection>

            <GearSection
              id="repeats"
              title="Repeats & duration"
              icon={<Repeat2 size={16} strokeWidth={2} />}
              open={openSection === "repeats"}
              onToggle={() => toggleSection("repeats")}
              summary={
                bls.repeats === "infinity"
                  ? `∞ · ${bls.setLengthSec}s`
                  : `${bls.repeats} · ${bls.setLengthSec}s`
              }
            >
              <div className="gear-choice-row" role="group" aria-label="Repeat mode">
                <label className="gear-repeats-field">
                  <span className="gear-inline-label">Passes</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={BLS_REPEATS_MIN}
                    max={BLS_REPEATS_MAX}
                    step={1}
                    className="gear-number-input"
                    aria-label="Repeat count"
                    value={
                      typeof bls.repeats === "number"
                        ? bls.repeats
                        : BLS_REPEATS_DEFAULT
                    }
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                        e.preventDefault();
                        e.stopPropagation();
                        const direction = e.key === "ArrowUp" ? 1 : -1;
                        const base =
                          bls.repeats === "infinity"
                            ? BLS_REPEATS_DEFAULT
                            : bls.repeats;
                        onChange({
                          repeats: adjustRepeatMode(base, direction),
                        });
                      }
                    }}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      onChange({ repeats: clampBlsRepeatsCount(n) });
                    }}
                    onFocus={() => {
                      if (bls.repeats === "infinity") {
                        onChange({ repeats: BLS_REPEATS_DEFAULT });
                      }
                    }}
                  />
                </label>
                <ChoiceChip
                  selected={bls.repeats === "infinity"}
                  ariaLabel="Unlimited repeats"
                  onClick={() => onChange({ repeats: "infinity" })}
                >
                  <InfinityIcon size={15} strokeWidth={2} /> Unlimited
                </ChoiceChip>
              </div>
              <label className="gear-slider-row gear-slider-row-solo">
                <span className="gear-inline-label">
                  <Timer size={14} strokeWidth={2} aria-hidden="true" />
                  Cap
                </span>
                <input
                  type="range"
                  min={20}
                  max={60}
                  value={bls.setLengthSec}
                  onChange={(e) =>
                    onChange({ setLengthSec: parseInt(e.target.value, 10) })
                  }
                  className="gear-range"
                  aria-label="Set length in seconds"
                />
                <span className="gear-slider-value">{bls.setLengthSec}s</span>
              </label>
              <p className="gear-help">
                A set ends when either the repeat count or this time cap is
                reached.
              </p>
            </GearSection>

            <GearSection
              id="sound"
              title="Sound"
              icon={<Volume2 size={16} strokeWidth={2} />}
              open={openSection === "sound"}
              onToggle={() => toggleSection("sound")}
              summary={bls.sound}
            >
              <div className="gear-choice-row" role="group" aria-label="Sound mode">
                {SOUND_OPTIONS.map((opt) => (
                  <ChoiceChip
                    key={opt.value}
                    selected={bls.sound === opt.value}
                    ariaLabel={opt.label}
                    onClick={() => onChange({ sound: opt.value })}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </ChoiceChip>
                ))}
              </div>
            </GearSection>

            <GearSection
              id="animation"
              title="Animation"
              icon={<Circle size={16} strokeWidth={2} />}
              open={openSection === "animation"}
              onToggle={() => toggleSection("animation")}
              summary={bls.animation}
            >
              <div className="gear-choice-row" role="group" aria-label="Animation mode">
                {ANIMATION_OPTIONS.map((opt) => (
                  <ChoiceChip
                    key={opt.value}
                    selected={bls.animation === opt.value}
                    ariaLabel={opt.label}
                    onClick={() => onChange({ animation: opt.value })}
                  >
                    {opt.icon}
                    <span className="gear-choice-stack">
                      <strong>{opt.label}</strong>
                      <small>{opt.hint}</small>
                    </span>
                  </ChoiceChip>
                ))}
              </div>
            </GearSection>

            <GearSection
              id="look"
              title="Look"
              icon={<Palette size={16} strokeWidth={2} />}
              open={openSection === "look"}
              onToggle={() => toggleSection("look")}
              summary={`${bls.ballSize}px`}
            >
              <div className="gear-look-grid">
                <label className="gear-color-field">
                  <span>Ball</span>
                  <input
                    type="color"
                    value={bls.ballColor}
                    onChange={(e) => onChange({ ballColor: e.target.value })}
                    className="gear-color-input"
                  />
                </label>
                <label className="gear-color-field">
                  <span>Background</span>
                  <input
                    type="color"
                    value={bls.background}
                    onChange={(e) => onChange({ background: e.target.value })}
                    className="gear-color-input"
                  />
                </label>
              </div>
              <label className="gear-slider-row gear-slider-row-solo">
                <span className="gear-inline-label">Size</span>
                <input
                  type="range"
                  min={24}
                  max={80}
                  value={bls.ballSize}
                  onChange={(e) =>
                    onChange({ ballSize: parseInt(e.target.value, 10) })
                  }
                  className="gear-range"
                  aria-label="Ball size"
                />
                <span className="gear-slider-value">{bls.ballSize}px</span>
              </label>
            </GearSection>

            {gamepadConnected ? (
              <GearSection
                id="vibration"
                title="Controller rumble"
                icon={<Vibrate size={16} strokeWidth={2} />}
                open={openSection === "vibration"}
                onToggle={() => toggleSection("vibration")}
                summary={bls.vibration}
              >
                <div
                  className="gear-choice-row"
                  role="group"
                  aria-label="Vibration intensity"
                >
                  {VIBRATION_OPTIONS.map((opt) => (
                    <ChoiceChip
                      key={opt.value}
                      selected={bls.vibration === opt.value}
                      ariaLabel={opt.label}
                      onClick={() => onChange({ vibration: opt.value })}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </ChoiceChip>
                  ))}
                </div>
                <p className="gear-help">
                  Rumble fires when the ball reaches each edge (gamepad only).
                </p>
              </GearSection>
            ) : null}
          </div>
        </div>

        <footer className="gear-footer">
          <button type="button" className="btn-primary gear-done" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
