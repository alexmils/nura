"use client";

import { useEffect, useState } from "react";
import {
  notifyLandingPreloaderDone,
  resolveLandingHash,
} from "@/lib/landing-scroll";
import { AnimatedBrandWave } from "@/app/components/frontend/AnimatedBrandWave";
import "./animated-brand-wave.css";
import "./frontend-preloader.css";

/** Jumping percent steps — always ends at 100. */
function buildSteps(): number[] {
  const steps: number[] = [0];
  let n = 0;
  while (n < 100) {
    const bump = 6 + Math.floor(Math.random() * 14);
    n = Math.min(100, n + bump);
    steps.push(n);
  }
  if (steps[steps.length - 1] !== 100) steps.push(100);
  return steps;
}

function shouldSkipPreloader(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  // Pending home section hash — skip so overflow-lock does not eat the scroll.
  if (resolveLandingHash()) return true;
  return false;
}

export function FrontendPreloader() {
  const [fill, setFill] = useState(0);
  // Always "run" on the first render, on the server and the client alike: a
  // lazy initial state that read matchMedia / the URL hash rendered nothing on
  // the client but the overlay on the server (a hydration mismatch, the dev
  // overlay's "1 Issue", for reduced-motion visitors and /#section links).
  // The effect below skips it right after hydration; CSS hides it meanwhile
  // under reduced motion.
  const [phase, setPhase] = useState<"run" | "out" | "gone">("run");

  useEffect(() => {
    if (shouldSkipPreloader()) {
      document.documentElement.classList.remove("fe-preloader-active");
      setPhase("gone");
      notifyLandingPreloaderDone();
      return;
    }

    document.documentElement.classList.add("fe-preloader-active");

    const steps = buildSteps();
    let i = 0;
    let timer = 0;

    const tick = () => {
      i += 1;
      if (i >= steps.length) {
        setFill(100);
        timer = window.setTimeout(() => {
          setPhase("out");
          timer = window.setTimeout(() => {
            document.documentElement.classList.remove("fe-preloader-active");
            setPhase("gone");
            notifyLandingPreloaderDone();
          }, 700);
        }, 380);
        return;
      }
      setFill(steps[i]!);
      timer = window.setTimeout(tick, 95 + Math.floor(Math.random() * 110));
    };

    timer = window.setTimeout(tick, 120);

    return () => {
      window.clearTimeout(timer);
      document.documentElement.classList.remove("fe-preloader-active");
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className={`fe-preloader${phase === "out" ? " is-out" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={`Loading ${fill} percent`}
    >
      <div className="fe-preloader-inner">
        <AnimatedBrandWave size="lg" fill={fill} className="fe-preloader-logo" />
        <p className="fe-preloader-count">
          <span className="fe-preloader-num">{fill}</span>
          <span className="fe-preloader-pct" aria-hidden>
            %
          </span>
        </p>
      </div>
    </div>
  );
}
