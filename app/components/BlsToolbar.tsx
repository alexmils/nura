"use client";

import { forwardRef, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  Infinity as InfinityIcon,
  Minus,
  Music2,
  SlidersHorizontal,
  Square,
  Vibrate,
  VolumeX,
} from "lucide-react";
import type {
  AnimationMode,
  BlsSettings,
  SoundMode,
  SpeedPresetIndex,
  VibrationMode,
} from "@/lib/types";
import type { BlsToolbarField } from "@/lib/bls-toolbar-nav";
import {
  adjustRepeatMode,
  BLS_REPEATS_DEFAULT,
  BLS_REPEATS_MAX,
  BLS_REPEATS_MIN,
  clampBlsRepeatsCount,
} from "@/lib/bls-repeats";
import { useGamepadConnected } from "@/lib/useGamepadConnected";

interface BlsToolbarProps {
  bls: BlsSettings;
  onChange: (patch: Partial<BlsSettings>) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenGear: () => void;
  dimmed?: boolean;
  focusedField: BlsToolbarField;
  onFocusField: (field: BlsToolbarField) => void;
}

const SPEED_FIELDS: BlsToolbarField[] = ["speed0", "speed1", "speed2"];

const SOUND_OPTIONS: { value: SoundMode; label: string; icon: ReactNode }[] = [
  { value: "mute", label: "Mute", icon: <VolumeX size={16} strokeWidth={2} /> },
  { value: "click", label: "Click", icon: <CircleDot size={16} strokeWidth={2} /> },
  { value: "pulse", label: "Pulse", icon: <Activity size={16} strokeWidth={2} /> },
  { value: "tone", label: "Tone", icon: <Music2 size={16} strokeWidth={2} /> },
];

const ANIMATION_OPTIONS: {
  value: AnimationMode;
  label: string;
  icon: ReactNode;
}[] = [
  { value: "dot", label: "Dot", icon: <Circle size={16} strokeWidth={2.5} /> },
  {
    value: "flash",
    label: "Flash",
    icon: <Square size={15} strokeWidth={2} />,
  },
];

const VIBRATION_OPTIONS: {
  value: VibrationMode;
  label: string;
  icon: ReactNode;
}[] = [
  { value: "none", label: "Off", icon: <Minus size={16} strokeWidth={2.25} /> },
  {
    value: "soft",
    label: "Soft",
    icon: <Vibrate size={15} strokeWidth={2} />,
  },
  {
    value: "hard",
    label: "Hard",
    icon: <Vibrate size={17} strokeWidth={2.5} />,
  },
];

function BlsGroup({
  label,
  focused,
  children,
  field,
}: {
  label: string;
  focused?: boolean;
  children: ReactNode;
  /** Tour anchor for this control group. */
  field?: string;
}) {
  return (
    <div
      className={`bls-group ${focused ? "bls-group-focused" : ""}`}
      data-guide-field={field}
    >
      <div className="bls-seg" role="group" aria-label={label}>
        {children}
      </div>
      <span className="bls-group-label">{label}</span>
    </div>
  );
}

function SegBtn({
  selected,
  focused,
  ariaLabel,
  title,
  onClick,
  children,
}: {
  selected?: boolean;
  focused?: boolean;
  ariaLabel: string;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title ?? ariaLabel}
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={onClick}
      className={`bls-seg-btn ${selected ? "bls-seg-btn-active" : ""} ${
        focused ? "bls-seg-btn-focused" : ""
      }`}
    >
      {children}
    </button>
  );
}

export const BlsToolbar = forwardRef<HTMLDivElement, BlsToolbarProps>(
  function BlsToolbar(
    {
      bls,
      onChange,
      collapsed,
      onToggleCollapse,
      onOpenGear,
      dimmed,
      focusedField,
      onFocusField,
    },
    ref
  ) {
    const gamepadConnected = useGamepadConnected();
    const [repeatsDraft, setRepeatsDraft] = useState(
      typeof bls.repeats === "number" ? bls.repeats : BLS_REPEATS_DEFAULT
    );

    useEffect(() => {
      if (typeof bls.repeats === "number") {
        setRepeatsDraft(bls.repeats);
      }
    }, [bls.repeats]);

    const selectSpeed = (index: SpeedPresetIndex) => {
      onFocusField(SPEED_FIELDS[index]);
      onChange({ activeSpeedPreset: index });
    };

    const commitRepeatsCount = (raw: number) => {
      const next = clampBlsRepeatsCount(raw);
      setRepeatsDraft(next);
      onFocusField("repeats");
      onChange({ repeats: next });
    };

    const selectInfinity = () => {
      onFocusField("repeats");
      onChange({ repeats: "infinity" });
    };

    const onRepeatsKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        const direction = e.key === "ArrowUp" ? 1 : -1;
        const base =
          bls.repeats === "infinity" ? repeatsDraft : bls.repeats;
        const next = adjustRepeatMode(base, direction);
        if (typeof next === "number") {
          setRepeatsDraft(next);
          onChange({ repeats: next });
        }
        onFocusField("repeats");
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        // Keep caret movement local; do not bubble to dock field nav.
        e.stopPropagation();
      }
    };

    const selectSound = (value: SoundMode) => {
      onFocusField("sound");
      onChange({ sound: value });
    };

    const selectAnimation = (value: AnimationMode) => {
      onFocusField("animation");
      onChange({ animation: value });
    };

    const selectVibration = (value: VibrationMode) => {
      onFocusField("vibration");
      onChange({ vibration: value });
    };

    if (collapsed) {
      return (
        <div ref={ref} className="bls-dock bls-dock--collapsed">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="bls-expand-btn pointer-events-auto"
            aria-label="Show controls"
            aria-expanded={false}
          >
            <ChevronUp size={14} strokeWidth={2} />
            Controls
          </button>
        </div>
      );
    }

    const repeatsFinite = bls.repeats !== "infinity";

    return (
      <div
        ref={ref}
        className={`bls-dock ${dimmed ? "pointer-events-none opacity-40" : ""}`}
      >
        <div className="bls-bar">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="bls-collapse-btn"
            aria-label="Hide controls"
            aria-expanded={true}
          >
            <ChevronDown size={16} strokeWidth={2} />
          </button>

          <div className="bls-panel">
            <BlsGroup
              label="Speed"
              field="speed"
              focused={SPEED_FIELDS.includes(focusedField)}
            >
              {bls.speedPresets.map((hz, index) => {
                const i = index as SpeedPresetIndex;
                const field = SPEED_FIELDS[index];
                return (
                  <SegBtn
                    key={field}
                    selected={bls.activeSpeedPreset === i}
                    focused={focusedField === field}
                    ariaLabel={`Speed ${hz.toFixed(1)} Hz`}
                    onClick={() => selectSpeed(i)}
                  >
                    {Number.isInteger(hz) ? String(hz) : hz.toFixed(1)}
                  </SegBtn>
                );
              })}
            </BlsGroup>

            <BlsGroup label="Repeats" field="repeats" focused={focusedField === "repeats"}>
              <input
                type="number"
                inputMode="numeric"
                min={BLS_REPEATS_MIN}
                max={BLS_REPEATS_MAX}
                step={1}
                value={repeatsDraft}
                aria-label="Repeat count"
                title="Repeat count"
                className={`bls-seg-btn bls-repeats-input ${
                  repeatsFinite ? "bls-seg-btn-active" : ""
                } ${
                  focusedField === "repeats" && repeatsFinite
                    ? "bls-seg-btn-focused"
                    : ""
                }`}
                onFocus={() => {
                  onFocusField("repeats");
                  if (bls.repeats === "infinity") {
                    onChange({ repeats: clampBlsRepeatsCount(repeatsDraft) });
                  }
                }}
                onKeyDown={onRepeatsKeyDown}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return;
                  const n = Number(raw);
                  if (!Number.isFinite(n)) return;
                  commitRepeatsCount(n);
                }}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  commitRepeatsCount(
                    Number.isFinite(n) ? n : repeatsDraft
                  );
                }}
              />
              <SegBtn
                selected={bls.repeats === "infinity"}
                focused={
                  focusedField === "repeats" && bls.repeats === "infinity"
                }
                ariaLabel="Infinite repeats"
                onClick={selectInfinity}
              >
                <InfinityIcon size={16} strokeWidth={2} />
              </SegBtn>
            </BlsGroup>

            <BlsGroup label="Stereo sound" field="sound" focused={focusedField === "sound"}>
              {SOUND_OPTIONS.map((opt) => (
                <SegBtn
                  key={opt.value}
                  selected={bls.sound === opt.value}
                  focused={focusedField === "sound" && bls.sound === opt.value}
                  ariaLabel={`Sound ${opt.label}`}
                  onClick={() => selectSound(opt.value)}
                >
                  {opt.icon}
                </SegBtn>
              ))}
            </BlsGroup>

            <BlsGroup label="Animation" field="animation" focused={focusedField === "animation"}>
              {ANIMATION_OPTIONS.map((opt) => (
                <SegBtn
                  key={opt.value}
                  selected={bls.animation === opt.value}
                  focused={
                    focusedField === "animation" && bls.animation === opt.value
                  }
                  ariaLabel={`Animation ${opt.label}`}
                  onClick={() => selectAnimation(opt.value)}
                >
                  {opt.icon}
                </SegBtn>
              ))}
            </BlsGroup>

            {gamepadConnected ? (
              <BlsGroup
                label="Vibrations"
                field="vibration"
                focused={focusedField === "vibration"}
              >
                {VIBRATION_OPTIONS.map((opt) => (
                  <SegBtn
                    key={opt.value}
                    selected={bls.vibration === opt.value}
                    focused={
                      focusedField === "vibration" &&
                      bls.vibration === opt.value
                    }
                    ariaLabel={`Vibration ${opt.label}`}
                    onClick={() => selectVibration(opt.value)}
                  >
                    {opt.icon}
                  </SegBtn>
                ))}
              </BlsGroup>
            ) : null}

            <BlsGroup label="Adjustments" field="adjustments">
              <SegBtn ariaLabel="Ball adjustments" onClick={onOpenGear}>
                <SlidersHorizontal size={16} strokeWidth={2} />
              </SegBtn>
            </BlsGroup>
          </div>
        </div>
      </div>
    );
  }
);
