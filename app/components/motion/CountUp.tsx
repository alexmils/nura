"use client";

import { useEffect, useRef, useState } from "react";
import { MOTION_EASE, MOTION_DURATION } from "@/lib/motion";
import "./motion.css";

/** Cubic-bezier evaluator for the shared easing curve. */
function cubicBezier(t: number, [x1, y1, x2, y2]: readonly [number, number, number, number]) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
  let u = t;
  for (let i = 0; i < 6; i += 1) {
    const x = sampleX(u) - t;
    const d = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(x) < 1e-4 || Math.abs(d) < 1e-6) break;
    u -= x / d;
  }
  return sampleY(Math.min(1, Math.max(0, u)));
}

type CountUpProps = {
  to: number;
  from?: number;
  /** Seconds. */
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

/**
 * Number that counts up once when scrolled into view. Reads the same easing
 * and duration tokens as the rest of the system.
 */
export function CountUp({
  to,
  from = 0,
  duration = MOTION_DURATION.slower,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(from);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }

    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / (duration * 1000));
          const eased = cubicBezier(p, MOTION_EASE.out);
          setValue(from + (to - from) * eased);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, from, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
