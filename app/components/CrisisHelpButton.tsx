"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BRAND_SPOKEN } from "@/lib/brand";
import {
  FIND_A_HELPLINE_URL,
  safeDefaultCrisisResources,
  type CountryCrisisResources,
} from "@/lib/emergency-by-country";

type CrisisResourcesPayload = CountryCrisisResources & {
  source?: string;
};

/**
 * Always-available crisis resources in session UI (separate from product Help).
 * Starts with a dialable US/CA 988 default; upgrades from geo when available.
 */
export function CrisisHelpButton() {
  const [open, setOpen] = useState(false);
  const [resources, setResources] = useState<CrisisResourcesPayload>(() =>
    safeDefaultCrisisResources()
  );
  const [localized, setLocalized] = useState(false);
  const panelId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open || localized) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/crisis-resources", {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as CrisisResourcesPayload;
        if (cancelled) return;
        setResources({
          ...data,
          // Never trust outbound URLs from JSON.
          findHelplineUrl: FIND_A_HELPLINE_URL,
        });
        setLocalized(true);
      } catch {
        /* keep safe default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, localized]);

  const countryLabel = resources.countryName ?? null;
  const emergency = resources.emergency ?? null;
  const crisis = resources.crisis ?? null;

  return (
    <div className="crisis-help">
      <button
        ref={btnRef}
        type="button"
        className="crisis-help-btn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="crisis-help-btn-label crisis-help-btn-label--full">
          I need help now
        </span>
        <span className="crisis-help-btn-label crisis-help-btn-label--short">
          Need help
        </span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          className="crisis-help-panel"
          role="dialog"
          aria-label="Crisis resources"
        >
          <p className="crisis-help-lead">
            {BRAND_SPOKEN} is not crisis care and does not provide emergency
            services.
          </p>
          <ul className="crisis-help-list">
            {crisis ? (
              <li>
                <a href={`tel:${crisis.dial}`} className="crisis-help-call">
                  {countryLabel
                    ? `${countryLabel} — ${crisis.display}`
                    : crisis.note.includes("US / Canada")
                      ? `US / Canada — ${crisis.display}`
                      : crisis.display}
                </a>
                <span>
                  {crisis.note}
                  {": "}
                  <a href={`tel:${crisis.dial}`}>call</a>
                  {crisis.smsDial ? (
                    <>
                      {" or "}
                      <a href={`sms:${crisis.smsDial}`}>
                        text {crisis.display}
                      </a>
                    </>
                  ) : null}
                </span>
              </li>
            ) : null}
            <li>
              {emergency ? (
                <>
                  <a
                    href={`tel:${emergency.dial}`}
                    className="crisis-help-call"
                  >
                    {countryLabel
                      ? `Emergency — ${countryLabel}`
                      : "Emergency"}{" "}
                    {emergency.display}
                  </a>
                  <span> Local emergency services</span>
                </>
              ) : (
                <>
                  <strong>Emergency</strong>
                  <span>
                    {" "}
                    Call your local emergency number (often 112 or 911)
                  </span>
                </>
              )}
            </li>
            <li>
              <strong>More helplines</strong>
              <span>
                {" "}
                <a
                  href={FIND_A_HELPLINE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Find a local helpline
                </a>
              </span>
            </li>
          </ul>
          <button
            type="button"
            className="crisis-help-close"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
