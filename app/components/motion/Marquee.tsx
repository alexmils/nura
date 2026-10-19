"use client";

import type { ReactNode } from "react";
import "./marquee.css";

type MarqueeProps = {
  children: ReactNode;
  /** Seconds for one full loop. */
  duration?: number;
  reverse?: boolean;
  /** Pause the loop on hover (default true). */
  pauseOnHover?: boolean;
  className?: string;
};

/**
 * Infinite horizontal marquee. Duplicates its children once and translates the
 * track by -50%, so the loop is seamless. Reduced motion leaves a still row.
 */
export function Marquee({
  children,
  duration = 42,
  reverse = false,
  pauseOnHover = true,
  className,
}: MarqueeProps) {
  return (
    <div
      className={`mo-marquee${pauseOnHover ? " mo-marquee--hover-pause" : ""}${
        className ? ` ${className}` : ""
      }`}
      style={{ ["--mo-marquee-dur" as string]: `${duration}s` }}
    >
      <div
        className={`mo-marquee-track${reverse ? " mo-marquee-track--reverse" : ""}`}
        aria-hidden="true"
      >
        <div className="mo-marquee-group">{children}</div>
        <div className="mo-marquee-group">{children}</div>
      </div>
    </div>
  );
}
