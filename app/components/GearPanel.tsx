"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpDown,
  ArrowUpRight,
  ChevronDown,
  Circle,
  Infinity as InfinityIcon,
  Palette,
  Pause,
  Play,
  Repeat2,
  Shuffle,
  Smartphone,
  Square,
  Timer,
  Vibrate,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import type {
  AnimationMode,
  AnimationPath,
  BlsSettings,
  BlsSoundId,
  RepeatPresetIndex,
  SpeedPresetIndex,
  VibrationMode,
} from "@/lib/types";
import { DEFAULT_BLS } from "@/lib/types";
import { BlsAudioEngine } from "@/lib/bls-audio";
import {
  BLS_BALL_MAX_DT_SEC,
  blsBallStep,
} from "@/lib/bls-ball-motion";
import {
  ballTravelOffset,
  flashClipPaths,
  flashPaint,
  pickRandomAnimationPath,
  resolveAnimationPath,
  type ConcreteAnimationPath,
} from "@/lib/bls-motion";
import { blsSectionDefaultPatch } from "@/lib/bls-prefs";
import {
  BLS_SPEED_MAX,
  BLS_SPEED_MIN,
  BLS_SPEED_STEP,
  clampBlsSpeed,
  getActiveSpeedHz,
} from "@/lib/bls-speed";
import {
  adjustRepeatMode,
  clampBlsRepeatsCount,
  formatRepeatsLabel,
  selectRepeatPreset,
  writeRepeatPreset,
} from "@/lib/bls-repeats";
import {
  BLS_SOUND_OPTIONS,
  blsSoundLabel,
  blsSoundOption,
  edgeSound,
  isBlsSoundId,
} from "@/lib/bls-sounds";
import { pulseVibration } from "@/lib/bls-vibrate";

type SectionId =
  | "speed"
  | "repeats"
  | "sound"
  | "animation"
  | "look"
  | "vibration";

/** Collapsible section ids, exported for the product tour. */
export type GearSectionId = SectionId;

const ANIMATION_OPTIONS: {
  value: AnimationMode;
  label: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    value: "dot",
    label: "Dot",
    hint: "Circle",
    icon: <Circle size={18} strokeWidth={2.25} />,
  },
  {
    value: "flash",
    label: "Flash",
    hint: "Side light",
    icon: <Square size={17} strokeWidth={2} />,
  },
];

const PATH_OPTIONS: { value: AnimationPath; label: string; icon: ReactNode }[] = [
  { value: "auto", label: "Screen", icon: <Smartphone size={16} strokeWidth={2} /> },
  { value: "horizontal", label: "Horizontal", icon: <ArrowLeftRight size={16} strokeWidth={2} /> },
  { value: "diagonal-up", label: "Diagonal up", icon: <ArrowUpRight size={16} strokeWidth={2} /> },
  { value: "diagonal-down", label: "Diagonal down", icon: <ArrowDownRight size={16} strokeWidth={2} /> },
  { value: "vertical", label: "Vertical", icon: <ArrowUpDown size={16} strokeWidth={2} /> },
  { value: "random", label: "Surprise", icon: <Shuffle size={16} strokeWidth={2} /> },
];

const VIBRATION_OPTIONS: { value: VibrationMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "subtle", label: "Subtle" },
  { value: "soft", label: "Soft" },
  { value: "normal", label: "Normal" },
  { value: "hard", label: "Hard" },
];

function formatHz(hz: number): string {
  return `${hz.toFixed(1)} Hz`;
}

function pathLabel(path: AnimationPath): string {
  return PATH_OPTIONS.find((option) => option.value === path)?.label ?? "Screen";
}

function vibrationLabel(mode: VibrationMode): string {
  return VIBRATION_OPTIONS.find((option) => option.value === mode)?.label ?? "Soft";
}

function soundSummary(bls: BlsSettings): string {
  if (bls.soundMuted) return "Muted";
  const left = blsSoundOption(bls.leftSound).short;
  const right = blsSoundOption(bls.rightSound).short;
  return left === right ? left : `${left} / ${right}`;
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

function RestoreDefaults({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="gear-restore" onClick={onClick}>
      Restore defaults
    </button>
  );
}

function GearSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="gear-switch-row">
      <span className="gear-switch-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="gear-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="gear-switch-thumb" />
      </button>
    </div>
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
    <section
      className={`gear-section ${open ? "gear-section-open" : ""}`}
      data-gear-section={id}
    >
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

function RepeatPresetEditor({
  index,
  value,
  active,
  onSelect,
  onCommit,
}: {
  index: RepeatPresetIndex;
  value: BlsSettings["repeatPresets"][number];
  active: boolean;
  onSelect: () => void;
  onCommit: (next: BlsSettings["repeatPresets"][number]) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft !== null ? draft : value === "infinity" ? "" : String(value);

  return (
    <div className={`gear-repeat-preset ${active ? "gear-repeat-preset-active" : ""}`}>
      <button
        type="button"
        className={`gear-preset-index ${active ? "gear-preset-index-active" : ""}`}
        aria-label={`Use repeat preset ${index + 1}`}
        aria-pressed={active}
        onClick={onSelect}
      >
        {index + 1}
      </button>
      <input
        inputMode="numeric"
        className="gear-number-input gear-repeat-box"
        aria-label={`Repeat preset ${index + 1}`}
        placeholder="∞"
        value={shown}
        onFocus={() => {
          onSelect();
          setDraft(value === "infinity" ? "" : String(value));
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "");
          setDraft(raw);
        }}
        onBlur={() => {
          const raw = (draft ?? "").trim();
          onCommit(raw === "" ? "infinity" : clampBlsRepeatsCount(Number(raw)));
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
            return;
          }
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          const direction = e.key === "ArrowUp" ? 1 : -1;
          const next = adjustRepeatMode(value, direction);
          setDraft(null);
          onCommit(next);
        }}
      />
    </div>
  );
}

function PreviewStage({
  bls,
  playing,
  onEdge,
}: {
  bls: BlsSettings;
  playing: boolean;
  onEdge: (side: "left" | "right") => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const flashARef = useRef<HTMLDivElement>(null);
  const flashBRef = useRef<HTMLDivElement>(null);
  const blsRef = useRef(bls);
  const onEdgeRef = useRef(onEdge);
  const surpriseRef = useRef<ConcreteAnimationPath>("horizontal");
  blsRef.current = bls;
  onEdgeRef.current = onEdge;

  useEffect(() => {
    if (!playing) {
      const ball = ballRef.current;
      if (ball) ball.style.transform = "translate3d(-50%, -50%, 0)";
      return;
    }

    let raf = 0;
    let last = performance.now();
    let pos = 0.5;
    let dir = 1;
    surpriseRef.current = pickRandomAnimationPath();

    const paint = () => {
      const stage = stageRef.current;
      const ball = ballRef.current;
      const flashA = flashARef.current;
      const flashB = flashBRef.current;
      const current = blsRef.current;
      if (!stage) return;
      const showDot = current.animation === "dot";
      const size = Math.max(18, Math.round(current.ballSize * 0.45));
      const travelX = Math.max(0, stage.clientWidth - size);
      const travelY = Math.max(0, stage.clientHeight - size);
      const path = resolveAnimationPath(
        current.animationPath,
        stage.clientWidth,
        stage.clientHeight,
        surpriseRef.current
      );
      if (ball) ball.style.visibility = showDot ? "visible" : "hidden";
      if (flashA) flashA.style.visibility = showDot ? "hidden" : "visible";
      if (flashB) flashB.style.visibility = showDot ? "hidden" : "visible";
      if (showDot && ball) {
        const offset = ballTravelOffset(path, pos, travelX, travelY);
        ball.style.width = `${size}px`;
        ball.style.height = `${size}px`;
        ball.style.background = current.ballColor;
        ball.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
      }
      if (!showDot) {
        const clips = flashClipPaths(path);
        const start = flashPaint(
          current.brightenFlashes,
          current.flashColor,
          pos < 0.5,
          current.background
        );
        const end = flashPaint(
          current.brightenFlashes,
          current.flashColor,
          pos >= 0.5,
          current.background
        );
        if (flashA) {
          flashA.style.clipPath = clips.start;
          flashA.style.background = start.color;
          flashA.style.opacity = start.opacity;
        }
        if (flashB) {
          flashB.style.clipPath = clips.end;
          flashB.style.background = end.color;
          flashB.style.opacity = end.opacity;
        }
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), BLS_BALL_MAX_DT_SEC);
      last = now;
      const speed = Math.max(0.1, getActiveSpeedHz(blsRef.current));
      const step = blsBallStep(speed, dt);
      let next = pos + dir * step;
      if (next >= 1 || next <= 0) {
        const side = next >= 1 ? "right" : "left";
        next = side === "right" ? 1 : 0;
        dir = side === "right" ? -1 : 1;
        if (blsRef.current.animationPath === "random") {
          surpriseRef.current = pickRandomAnimationPath();
        }
        onEdgeRef.current(side);
      }
      pos = next;
      paint();
      raf = requestAnimationFrame(loop);
    };

    paint();
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const previewSize = Math.max(18, Math.round(bls.ballSize * 0.45));

  return (
    <div
      ref={stageRef}
      className="gear-preview-stage"
      style={{ background: bls.background }}
      aria-hidden="true"
    >
      {playing ? (
        <>
          <div
            ref={flashARef}
            className="gear-preview-flash gear-preview-flash-full"
            style={{
              visibility: bls.animation === "flash" ? "visible" : "hidden",
              background: bls.flashColor,
            }}
          />
          <div
            ref={flashBRef}
            className="gear-preview-flash gear-preview-flash-full"
            style={{
              visibility: bls.animation === "flash" ? "visible" : "hidden",
              background: bls.flashColor,
            }}
          />
          <div
            ref={ballRef}
            className="gear-preview-ball"
            style={{
              width: previewSize,
              height: previewSize,
              background: bls.ballColor,
              left: 0,
              top: 0,
              visibility: bls.animation === "dot" ? "visible" : "hidden",
            }}
          />
        </>
      ) : null}
      {!playing ? (
        <div className="gear-preview-idle">
          <span
            className="gear-preview-idle-dot"
            style={{
              background: bls.animation === "flash" ? bls.flashColor : bls.ballColor,
              width: previewSize,
              height: previewSize,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function SoundSelect({
  id,
  label,
  value,
  onChange,
  onPreview,
}: {
  id: BlsSoundId;
  label: string;
  value: BlsSoundId;
  onChange: (next: BlsSoundId) => void;
  onPreview: (id: BlsSoundId) => void;
}) {
  const groups = ["Tones", "Percussion"] as const;
  return (
    <div className="gear-sound-row">
      <span className="gear-inline-label">{label}</span>
      <select
        className="gear-sound-select"
        aria-label={`${label} sound`}
        value={value}
        onChange={(e) => {
          if (isBlsSoundId(e.target.value)) onChange(e.target.value);
        }}
      >
        {groups.map((group) => (
          <optgroup key={group} label={group}>
            {BLS_SOUND_OPTIONS.filter((option) => option.group === group).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <button
        type="button"
        className="gear-sound-play"
        aria-label={`Play ${blsSoundLabel(id)}`}
        onClick={() => onPreview(id)}
      >
        <Play size={15} strokeWidth={2.25} className="gear-play-icon" />
      </button>
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
  const [playing, setPlaying] = useState(false);
  const [openSection, setOpenSection] = useState<SectionId | null>("speed");
  const audioRef = useRef<BlsAudioEngine | null>(null);
  const blsRef = useRef(bls);
  blsRef.current = bls;

  useEffect(() => {
    const engine = new BlsAudioEngine();
    audioRef.current = engine;
    return () => {
      engine.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (expandSection) setOpenSection(expandSection.id);
  }, [expandSection]);

  const toggleSection = (id: SectionId) => {
    setOpenSection((current) => (current === id ? null : id));
  };

  const previewSound = (id: BlsSoundId) => {
    audioRef.current?.resume();
    audioRef.current?.play(id, 0);
  };

  const onPreviewEdge = (side: "left" | "right") => {
    const current = blsRef.current;
    audioRef.current?.resume();
    if (!current.soundMuted) {
      const edge = edgeSound(
        side,
        current.leftSound,
        current.rightSound,
        current.reverseStereo
      );
      audioRef.current?.play(edge.id, edge.pan);
    }
    pulseVibration(current.vibration);
  };

  const setSpeedPreset = (index: SpeedPresetIndex, value: number) => {
    const next = [...bls.speedPresets] as [number, number, number];
    next[index] = clampBlsSpeed(value);
    onChange({ speedPresets: next, activeSpeedPreset: index });
  };

  const resetAll = () => {
    onChange({
      ...DEFAULT_BLS,
      speedPresets: [...DEFAULT_BLS.speedPresets],
      repeatPresets: [...DEFAULT_BLS.repeatPresets],
    });
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
              <PreviewStage bls={bls} playing={playing} onEdge={onPreviewEdge} />
              <button
                type="button"
                className="gear-preview-play"
                aria-label={playing ? "Pause preview" : "Play preview"}
                onClick={() => {
                  audioRef.current?.resume();
                  setPlaying((p) => !p);
                }}
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
                <div className="gear-quick-seg" role="group" aria-label="Repeat presets">
                  {bls.repeatPresets.map((preset, index) => {
                    const i = index as RepeatPresetIndex;
                    return (
                      <ChoiceChip
                        key={i}
                        selected={bls.activeRepeatPreset === i}
                        ariaLabel={
                          preset === "infinity"
                            ? `Use repeat preset ${i + 1}, unlimited`
                            : `Use repeat preset ${i + 1}, ${preset}`
                        }
                        onClick={() => onChange(selectRepeatPreset(bls.repeatPresets, i))}
                      >
                        {preset === "infinity" ? (
                          <InfinityIcon size={15} strokeWidth={2} />
                        ) : (
                          preset
                        )}
                      </ChoiceChip>
                    );
                  })}
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
                <span className="gear-quick-label">Animation</span>
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
              <p className="gear-help">Three presets. Drag to tune each one.</p>
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
                      onChange={(e) => setSpeedPreset(i, parseFloat(e.target.value))}
                      className="gear-range"
                      aria-label={`Preset ${i + 1} speed`}
                    />
                    <span className="gear-slider-value">{formatHz(hz)}</span>
                  </label>
                );
              })}
              <RestoreDefaults onClick={() => onChange(blsSectionDefaultPatch("speed"))} />
            </GearSection>

            <GearSection
              id="repeats"
              title="Repeats"
              icon={<Repeat2 size={16} strokeWidth={2} />}
              open={openSection === "repeats"}
              onToggle={() => toggleSection("repeats")}
              summary={
                bls.repeats === "infinity"
                  ? `∞ · ${bls.setLengthSec}s`
                  : `${bls.repeats} · ${bls.setLengthSec}s`
              }
            >
              <div className="gear-repeat-presets">
                {bls.repeatPresets.map((preset, index) => {
                  const i = index as RepeatPresetIndex;
                  return (
                    <RepeatPresetEditor
                      key={i}
                      index={i}
                      value={preset}
                      active={bls.activeRepeatPreset === i}
                      onSelect={() => onChange(selectRepeatPreset(bls.repeatPresets, i))}
                      onCommit={(next) => onChange(writeRepeatPreset(bls.repeatPresets, i, next))}
                    />
                  );
                })}
              </div>
              <p className="gear-help">Leave a box blank for unlimited repeats.</p>
              <label className="gear-slider-row gear-slider-row-solo">
                <span className="gear-inline-label">
                  <Timer size={14} strokeWidth={2} aria-hidden="true" />
                  Time cap
                </span>
                <input
                  type="range"
                  min={20}
                  max={60}
                  value={bls.setLengthSec}
                  onChange={(e) => onChange({ setLengthSec: parseInt(e.target.value, 10) })}
                  className="gear-range"
                  aria-label="Set length in seconds"
                />
                <span className="gear-slider-value">{bls.setLengthSec}s</span>
              </label>
              <p className="gear-help">The set also stops at this time.</p>
              <RestoreDefaults onClick={() => onChange(blsSectionDefaultPatch("repeats"))} />
            </GearSection>

            <GearSection
              id="sound"
              title="Stereo sound"
              icon={<Volume2 size={16} strokeWidth={2} />}
              open={openSection === "sound"}
              onToggle={() => toggleSection("sound")}
              summary={soundSummary(bls)}
            >
              <p className="gear-help">
                The left sound plays at the start of a pass. The right sound plays at the far side.
              </p>
              <SoundSelect
                id={bls.leftSound}
                label="Left"
                value={bls.leftSound}
                onChange={(leftSound) => onChange({ leftSound })}
                onPreview={previewSound}
              />
              <SoundSelect
                id={bls.rightSound}
                label="Right"
                value={bls.rightSound}
                onChange={(rightSound) => onChange({ rightSound })}
                onPreview={previewSound}
              />
              <GearSwitch
                checked={bls.soundMuted}
                label="Mute"
                onChange={(soundMuted) => onChange({ soundMuted })}
              />
              <GearSwitch
                checked={bls.reverseStereo}
                label="Reverse left/right"
                onChange={(reverseStereo) => onChange({ reverseStereo })}
              />
              <p className="gear-help">Mute silences the set. Preview still plays.</p>
              <RestoreDefaults onClick={() => onChange(blsSectionDefaultPatch("sound"))} />
            </GearSection>

            <GearSection
              id="animation"
              title="Animation"
              icon={<Circle size={16} strokeWidth={2} />}
              open={openSection === "animation"}
              onToggle={() => toggleSection("animation")}
              summary={`${bls.animation === "dot" ? "Dot" : "Flash"} · ${pathLabel(bls.animationPath)}`}
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
              <div className="gear-path-row" role="group" aria-label="Animation path">
                {PATH_OPTIONS.map((opt) => (
                  <ChoiceChip
                    key={opt.value}
                    selected={bls.animationPath === opt.value}
                    ariaLabel={opt.label}
                    onClick={() => onChange({ animationPath: opt.value })}
                  >
                    {opt.icon}
                  </ChoiceChip>
                ))}
              </div>
              <p className="gear-help">
                Screen follows how you hold the phone. Surprise picks a new path at each end.
              </p>
              <p className="gear-inline-label">Brighten flashes</p>
              <div className="gear-choice-row" role="group" aria-label="Brighten flashes">
                <ChoiceChip
                  selected={bls.brightenFlashes === "off"}
                  ariaLabel="Brighten flashes off"
                  onClick={() => onChange({ brightenFlashes: "off" })}
                >
                  Off
                </ChoiceChip>
                <ChoiceChip
                  selected={bls.brightenFlashes === "standard"}
                  ariaLabel="Brighten flashes standard"
                  onClick={() => onChange({ brightenFlashes: "standard", animation: "flash" })}
                >
                  Standard
                </ChoiceChip>
              </div>
              <p className="gear-help">
                Standard brightens the flash color. Off uses it as you set it.
              </p>
              <RestoreDefaults onClick={() => onChange(blsSectionDefaultPatch("animation"))} />
            </GearSection>

            <GearSection
              id="vibration"
              title="Vibrations"
              icon={<Vibrate size={16} strokeWidth={2} />}
              open={openSection === "vibration"}
              onToggle={() => toggleSection("vibration")}
              summary={vibrationLabel(bls.vibration)}
            >
              <div className="gear-choice-row" role="group" aria-label="Vibration intensity">
                {VIBRATION_OPTIONS.map((opt) => (
                  <ChoiceChip
                    key={opt.value}
                    selected={bls.vibration === opt.value}
                    ariaLabel={opt.label}
                    onClick={() => onChange({ vibration: opt.value })}
                  >
                    <span>{opt.label}</span>
                  </ChoiceChip>
                ))}
              </div>
              <p className="gear-help">
                Android phones and a connected controller can vibrate. iPhone Safari cannot.
              </p>
              <RestoreDefaults onClick={() => onChange(blsSectionDefaultPatch("vibration"))} />
            </GearSection>

            <GearSection
              id="look"
              title="Colors"
              icon={<Palette size={16} strokeWidth={2} />}
              open={openSection === "look"}
              onToggle={() => toggleSection("look")}
              summary={`${bls.ballSize}px`}
            >
              <div className="gear-look-grid">
                <label className="gear-color-field">
                  <span>Circle</span>
                  <input
                    type="color"
                    value={bls.ballColor}
                    onChange={(e) => onChange({ ballColor: e.target.value, animation: "dot" })}
                    className="gear-color-input"
                    aria-label="Circle color"
                  />
                </label>
                <label className="gear-color-field">
                  <span>Flashes</span>
                  <input
                    type="color"
                    value={bls.flashColor}
                    onChange={(e) => onChange({ flashColor: e.target.value, animation: "flash" })}
                    className="gear-color-input"
                    aria-label="Flash color"
                  />
                </label>
                <label className="gear-color-field">
                  <span>Background</span>
                  <input
                    type="color"
                    value={bls.background}
                    onChange={(e) => onChange({ background: e.target.value })}
                    className="gear-color-input"
                    aria-label="Background color"
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
                  onChange={(e) => onChange({ ballSize: parseInt(e.target.value, 10) })}
                  className="gear-range"
                  aria-label="Circle size"
                />
                <span className="gear-slider-value">{bls.ballSize}px</span>
              </label>
              <p className="gear-help">Choosing a color shows that animation in the preview.</p>
              <RestoreDefaults onClick={() => onChange(blsSectionDefaultPatch("look"))} />
            </GearSection>
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
