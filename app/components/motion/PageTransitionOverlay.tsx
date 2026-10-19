"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import {
  DEFAULT_PAGE_TRANSITION,
  TRANSITION_TIMING,
  transitionLayers,
  type PageTransition,
  type TransitionPhase,
} from "@/lib/page-transitions";
import "./motion.css";
import "./page-transitions.css";

/**
 * Runs the active page transition on every marketing route change: cover, the
 * route swaps underneath, reveal. Dependency-free (CSS keyframes), reduced
 * motion gets the plain swap (the overlay never renders).
 *
 * Mounted in the root layout so it survives navigation — the marketing shell
 * (`FrontendShell`) is rendered per page, so it remounts and could never see a
 * pathname change. Product routes (`/app`, `/admin`) are skipped.
 */
const PRODUCT_PREFIXES = ["/app", "/admin"];

function isProductRoute(pathname: string): boolean {
  return PRODUCT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function PageTransitionOverlay({
  kind = DEFAULT_PAGE_TRANSITION,
}: {
  kind?: PageTransition;
}) {
  const pathname = usePathname();
  const prev = useRef(pathname);
  const seq = useRef(0);
  const [run, setRun] = useState<{ phase: TransitionPhase; id: number } | null>(null);

  useEffect(() => {
    const from = prev.current;
    if (from === pathname) return;
    prev.current = pathname;
    if (kind === "none") return;
    if (isProductRoute(pathname) || isProductRoute(from)) return;

    if (typeof window !== "undefined") {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (document.documentElement.getAttribute("data-a11y-motion") === "reduced") return;
    }

    const { cover, reveal } = TRANSITION_TIMING[kind];
    const id = (seq.current += 1);
    setRun({ phase: "cover", id: id });

    const toReveal = window.setTimeout(() => setRun({ phase: "reveal", id }), cover);
    const done = window.setTimeout(() => setRun(null), cover + reveal + 40);
    return () => {
      window.clearTimeout(toReveal);
      window.clearTimeout(done);
    };
  }, [pathname, kind]);

  if (!run || kind === "none") return null;

  const { cover, reveal } = TRANSITION_TIMING[kind];
  const vars = {
    "--pt-c": `${cover / 1000}s`,
    "--pt-r": `${reveal / 1000}s`,
  } as CSSProperties;

  return (
    <div className="mo-pt" data-pt={kind} data-phase={run.phase} style={vars} aria-hidden>
      {transitionLayers(kind).map((layer) => (
        <div key={layer.key} className={layer.className} style={layer.style as CSSProperties} />
      ))}
    </div>
  );
}
