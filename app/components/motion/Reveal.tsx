"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import { useMotion } from "./MotionProvider";
import { MOTION_DURATION, getRevealConfig, type EntranceEffect } from "@/lib/motion";
import "./motion.css";

type RevealProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /** Seconds. */
  delay?: number;
  /** Override the preset's entrance effect for this element. */
  entry?: EntranceEffect;
  /** Override vertical travel (px). */
  y?: number;
  /** Play every time it scrolls in (default: once). */
  once?: boolean;
  style?: CSSProperties;
  id?: string;
};

/**
 * The standard in-view reveal: opacity + travel (+ optional scale / blur),
 * driven by the active motion preset. Replaces ad-hoc GSAP `.fe-animate`
 * fades and keeps every entrance on the same tokens.
 */
export function Reveal({
  children,
  className,
  as: Tag = "div",
  delay = 0,
  entry,
  y,
  once = true,
  style,
  id,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const { preset, entry: presetEntry, config } = useMotion();

  const effect = entry ?? presetEntry;
  const base = entry && entry !== presetEntry ? getRevealConfig(preset, effect) : config;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!config.enabled) {
      el.classList.add("is-in");
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      el.classList.add("is-in");
      return;
    }

    const observer = new IntersectionObserver(
      ([entryObj]) => {
        if (!entryObj) return;
        if (entryObj.isIntersecting) {
          el.classList.add("is-in");
          if (once) observer.disconnect();
        } else if (!once) {
          el.classList.remove("is-in");
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [config.enabled, once]);

  const travelY = y ?? base.y;
  const vars: CSSProperties & Record<string, string> = {
    "--mo-x": `${base.x}px`,
    "--mo-y": `${travelY}px`,
    "--mo-scale": `${base.scale ?? 1}`,
    "--mo-blur": `${base.blurPx ?? 0}px`,
    "--mo-dur": `${MOTION_DURATION.base}s`,
    "--mo-delay": `${delay}s`,
    "--mo-ease": `cubic-bezier(${base.ease.join(", ")})`,
    ...(style as Record<string, string> | undefined),
  };

  return (
    <Tag
      ref={ref}
      id={id}
      className={`mo-reveal${className ? ` ${className}` : ""}`}
      style={vars}
      data-motion-preset={preset}
    >
      {children}
    </Tag>
  );
}
