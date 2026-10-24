"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SESSION_LANGUAGES,
  detectSessionLanguage,
  isWelcomeOpening,
} from "@/lib/session-languages";

/** How long each language stays on screen before the opening line swaps. */
const ROTATE_MS = 2400;

export interface RotatingWelcomeState {
  /** True when the agent line is the opening welcome and may be localized. */
  swap: boolean;
  /** Line to render right now (localized when `swap` is true). */
  line: string;
  /** Key for the swap animation: changes on every language change. */
  key: string;
}

/**
 * App UI is always English (product decision 2026-10-24), so the opening line
 * no longer cycles through languages: this always returns the stored line as
 * is. The hook keeps its signature so callers need no change.
 */
const ROTATE_WELCOME = false;

/*
 * Previous behaviour (kept behind ROTATE_WELCOME): the first agent line cycled
 * through major languages until the person wrote something, then locked to the
 * language of the composer draft.
 */
export function useRotatingWelcome(opts: {
  text: string;
  enabled: boolean;
  /** Composer draft. Typing in a language locks the greeting to it. */
  draft: string;
}): RotatingWelcomeState {
  const { text, enabled, draft } = opts;
  const localizable = ROTATE_WELCOME && enabled && isWelcomeOpening(text);
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const locked = useMemo(
    () => (localizable ? detectSessionLanguage(draft) : null),
    [localizable, draft]
  );

  useEffect(() => {
    if (!localizable || locked || reducedMotion) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % SESSION_LANGUAGES.length),
      ROTATE_MS
    );
    return () => window.clearInterval(id);
  }, [localizable, locked, reducedMotion]);

  return useMemo(() => {
    if (!localizable) {
      return { swap: false, line: text, key: "static" };
    }
    const current =
      locked ?? SESSION_LANGUAGES[index % SESSION_LANGUAGES.length];
    return { swap: true, line: current.welcome, key: current.code };
  }, [localizable, locked, index, text]);
}
