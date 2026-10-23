"use client";

import { useState } from "react";
import { GearPanel } from "@/app/components/GearPanel";
import { DEFAULT_BLS, type BlsSettings } from "@/lib/types";

export function GearMock() {
  const [bls, setBls] = useState<BlsSettings>({
    ...DEFAULT_BLS,
    speedPresets: [...DEFAULT_BLS.speedPresets],
    repeatPresets: [...DEFAULT_BLS.repeatPresets],
  });
  return (
    <GearPanel
      bls={bls}
      onChange={(patch) => setBls((b) => ({ ...b, ...patch }))}
      onClose={() => {}}
      expandSection={{ id: "sound", nonce: 1 }}
    />
  );
}