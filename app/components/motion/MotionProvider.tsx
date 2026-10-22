"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  getRevealConfig,
  type EntranceEffect,
  type MotionPreset,
  type RevealConfig,
} from "@/lib/motion";

type MotionContextValue = {
  preset: MotionPreset;
  entry: EntranceEffect;
  config: RevealConfig;
};

const MotionContext = createContext<MotionContextValue>({
  preset: "soft",
  entry: "fadeUp",
  config: getRevealConfig("soft", "fadeUp"),
});

/**
 * One motion preset for the whole marketing shell. Kept deliberately simple:
 * a fixed "soft" default now, with the seam for an admin-set preset later
 * (read from settings and passed in here).
 */
export function MotionProvider({
  preset = "soft",
  entry = "fadeUp",
  children,
}: {
  preset?: MotionPreset;
  entry?: EntranceEffect;
  children: ReactNode;
}) {
  const value: MotionContextValue = {
    preset,
    entry,
    config: getRevealConfig(preset, entry),
  };
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotion(): MotionContextValue {
  return useContext(MotionContext);
}
