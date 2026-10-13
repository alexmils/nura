"use client";

import { forwardRef, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  Circle,
  Infinity as InfinityIcon,
  Minus,
  SlidersHorizontal,
  Square,
  Vibrate,
  Volume2,
  VolumeX,
} from "lucide-react";
import type {
  AnimationMode,
  BlsSettings,
  RepeatPresetIndex,
  SpeedPresetIndex,
  VibrationMode,
} from "@/lib/types";
import type { BlsToolbarField } from "@/lib/bls-toolbar-nav";
import { selectRepeatPreset } from "@/lib/bls-repeats";
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
  /** Product tour: show the vibration group even with no controller on. */
  previewVibration?: boolean;
}

const SPEED_FIELDS: BlsToolbarField[] = ["speed0", "speed1", "speed2"];

const SOUND_OPTIONS: { muted: boolean; label: string; icon: ReactNode }[] = [
  { muted: true, label: "Mute", icon: <VolumeX size={16} strokeWidth={2} /> },
  { muted: false, label: "On", icon: <Volume2 size={16} strokeWidth={2} /> },
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
  { value: "off", label: "Off", icon: <Minus size={16} strokeWidth={2.25} /> },
  { value: "subtle", label: "Subtle", icon: <Vibrate size={13} strokeWidth={1.75} /> },
  { value: "soft", label: "Soft", icon: <Vibrate size={15} strokeWidth={2} /> },
  { value: "normal", label: "Normal", icon: <Vibrate size={17} strokeWidth={2.5} /> },
];

function BlsGroup({
  label,
  focused,
  children,
  field,
  flag,
}: {
  label: string;
  focused?: boolean;
  children: ReactNode;
  /** Tour anchor for this control group. */
  field?: string;
  /** Small status chip next to the label (e.g. Disconnected). */
  flag?: ReactNode;
}) {
  return (
    <div
      className={`bls-group ${focused ? "bls-group-focused" : ""}`}
      data-guide-field={field}
    >
      <div className="bls-seg" role="group" aria-label={label}>
        {children}
      </div>
      <span className="bls-group-meta">
        <span className="bls-group-label">{label}</span>
        {flag}
      </span>
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
      previewVibration = false,
    },
    ref
  ) {
    const gamepadConnected = useGamepadConnected();
    const showVibration = gamepadConnected || previewVibration;

    const selectSpeed = (index: SpeedPresetIndex) => {
      onFocusField(SPEED_FIELDS[index]);
      onChange({ activeSpeedPreset: index });
    };

    const selectRepeat = (index: RepeatPresetIndex) => {
      onFocusField("repeats");
      onChange(selectRepeatPreset(bls.repeatPresets, index));
    };

    const selectSound = (muted: boolean) => {
      onFocusField("sound");
      onChange({ soundMuted: muted });
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
              {bls.repeatPresets.map((preset, index) => {
                const i = index as RepeatPresetIndex;
                const unlimited = preset === "infinity";
                return (
                  <SegBtn
                    key={i}
                    selected={bls.activeRepeatPreset === i}
                    focused={focusedField === "repeats" && bls.activeRepeatPreset === i}
                    ariaLabel={
                      unlimited
                        ? `Repeat preset ${i + 1}, unlimited`
                        : `Repeat preset ${i + 1}, ${preset}`
                    }
                    onClick={() => selectRepeat(i)}
                  >
                    {unlimited ? (
                      <InfinityIcon size={16} strokeWidth={2} />
                    ) : (
                      preset
                    )}
                  </SegBtn>
                );
              })}
            </BlsGroup>

            <BlsGroup label="Stereo sound" field="sound" focused={focusedField === "sound"}>
              {SOUND_OPTIONS.map((opt) => (
                <SegBtn
                  key={opt.label}
                  selected={bls.soundMuted === opt.muted}
                  focused={focusedField === "sound" && bls.soundMuted === opt.muted}
                  ariaLabel={opt.muted ? "Mute sound" : "Stereo sound on"}
                  onClick={() => selectSound(opt.muted)}
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

            {showVibration ? (
              <BlsGroup
                label="Vibrations"
                field="vibration"
                focused={focusedField === "vibration"}
                flag={
                  gamepadConnected ? null : (
                    <span className="bls-group-flag">Disconnected</span>
                  )
                }
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
