"use client";

import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Is this element visibly painting something (media, background or text)? */
function paints(el: Element): boolean {
  if (/^(img|video|canvas|svg|picture|iframe)$/i.test(el.tagName)) return true;
  const cs = getComputedStyle(el);
  if (cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
  if (cs.backgroundImage !== "none") return true;
  const bg = cs.backgroundColor;
  if (bg && bg !== "transparent" && !/,\s*0\)$/.test(bg)) return true;
  for (const node of el.childNodes) if (node.nodeType === 3 && node.textContent?.trim()) return true;
  return false;
}

/**
 * Walk the hit stack top-down: the first element that actually paints decides
 * whether the chip's own section is what the visitor sees there. A pinned
 * section can be on top but transparent while another section shows through.
 */
export function paintedBy(stack: Element[], host: Element): boolean {
  for (const el of stack) {
    if (el === document.documentElement || el === document.body) break;
    if (el.closest(".fe-editor-layer")) return true;
    // The page behind a transparent section (an ancestor) is still that section.
    if (!paints(el)) continue;
    if (el !== host && el.contains(host)) return true;
    return host.contains(el);
  }
  return true;
}

/**
 * Shown only while its own section is on screen and actually painted under
 * the chip. Pinned/sticky hosts (e.g. the How it works stepper) stay "in the
 * viewport" during long scroll choreography while other sections slide over
 * or show through them, so a plain absolute chip would float over those.
 */
function useChipInView(ref: React.RefObject<HTMLDivElement | null>) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const chip = ref.current;
    const host = chip?.parentElement;
    if (!chip || !host) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      const r = host.getBoundingClientRect();
      const cr = chip.getBoundingClientRect();
      let on = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
      on = on && cr.bottom > r.top && cr.top < r.bottom;
      if (on) {
        const x = Math.min(Math.max(cr.left + cr.width / 2, 0), window.innerWidth - 1);
        const y = Math.min(Math.max(cr.top + cr.height / 2, 0), window.innerHeight - 1);
        const prev = chip.style.pointerEvents;
        chip.style.pointerEvents = "none";
        const stack = document.elementsFromPoint(x, y);
        chip.style.pointerEvents = prev;
        on = paintedBy(stack, host);
      }
      setShown(on);
    };
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Scroll-driven panels also change without a scroll event (transitions).
    const timer = window.setInterval(schedule, 700);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.clearInterval(timer);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [ref]);
  return shown;
}

export function AdminSectionChip({
  name,
  id,
  onEdit,
  lift = false,
}: {
  name: string;
  id: string;
  onEdit: () => void;
  lift?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const shown = useChipInView(ref);
  return (
    <div
      ref={ref}
      data-admin-chip
      data-offscreen={shown ? undefined : ""}
      className={lift ? "fe-section-chip fe-section-chip--lift" : "fe-section-chip"}
    >
      <span className="fe-section-chip-name">{name}</span>
      <span aria-hidden className="fe-section-chip-dot">
        {"\u00b7"}
      </span>
      <code className="fe-section-chip-id">{id}</code>
      <button type="button" onClick={onEdit} aria-label={`Edit section: ${name}`} tabIndex={shown ? undefined : -1}>
        <Pencil size={14} aria-hidden />
        Edit
      </button>
    </div>
  );
}
