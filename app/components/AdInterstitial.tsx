"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicAdsConfig } from "@/lib/ads";
import { scheduleAdSensePush } from "@/lib/adsense-client";

type ActiveAds = Extract<PublicAdsConfig, { adsActive: true }>;

type Props = {
  open: boolean;
  config: ActiveAds | null;
  onContinue: () => void;
  onUpgrade: () => void;
};

export function AdInterstitial({
  open,
  config,
  onContinue,
  onUpgrade,
}: Props) {
  const [remaining, setRemaining] = useState(0);
  const slotRef = useRef<HTMLModElement>(null);

  const minWatch = config?.minWatchSeconds ?? 0;

  useEffect(() => {
    if (!open || !config) return;
    setRemaining(minWatch);
    if (minWatch <= 0) return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, config, minWatch]);

  useEffect(() => {
    if (!open || !config || config.provider !== "adsense") return;
    if (!config.adsenseClient || !config.adsenseSlot) return;
    return scheduleAdSensePush(slotRef.current);
  }, [open, config]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && remaining <= 0) onContinue();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, remaining, onContinue]);

  if (!open || !config) return null;

  const canContinue = remaining <= 0;
  const provider = config.provider;

  return (
    <div
      className="admin-modal-backdrop ad-interstitial-backdrop"
      role="presentation"
    >
      <div
        className="admin-modal ad-interstitial"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-interstitial-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="ad-interstitial-title" className="admin-page-title">
          Sponsored break
        </h2>
        <p className="admin-panel-sub mt-2">
          Self-guided sessions include a short ad. Upgrade anytime for an ad-free
          experience.
        </p>

        <div className="ad-interstitial-unit mt-4">
          {provider === "adsense" &&
          config.adsenseClient &&
          config.adsenseSlot ? (
            <ins
              ref={slotRef}
              className="adsbygoogle"
              style={{ display: "block", minHeight: 120 }}
              data-ad-client={config.adsenseClient}
              data-ad-slot={config.adsenseSlot}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          ) : provider === "gam" ? (
            <div className="ad-interstitial-placeholder">
              <span className="ad-interstitial-badge">Ad</span>
              <p>
                Video / rewarded ads (Google Ad Manager) — coming soon.
                Placeholder for now.
              </p>
            </div>
          ) : (
            <div className="ad-interstitial-placeholder">
              <span className="ad-interstitial-badge">Ad</span>
              <p>Your ad could show here — go ad-free with a paid plan.</p>
            </div>
          )}
        </div>

        <div className="admin-modal-actions mt-5 ad-interstitial-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onUpgrade}
          >
            Upgrade — remove ads
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!canContinue}
            onClick={onContinue}
          >
            {canContinue
              ? "Continue"
              : `Continue in ${remaining}s`}
          </button>
        </div>
      </div>
    </div>
  );
}
