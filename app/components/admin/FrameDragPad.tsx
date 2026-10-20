"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { FRAME_DRAG, type FrameDrag } from "@/app/components/admin/frame-drag";
import { setSectionDraft, useSectionDraft } from "@/app/components/frontend/section-editor/section-draft";
import { clampZoom } from "@/lib/image-position";

/** Ported from alexandermils FrameDragPad. Nura's editor drawer is `.fe-editor-drawer`. */
const PANEL = ".fe-editor-drawer";

function paint(key: string, x: number, y: number, zoom: number) {
  const at = `${x}% ${y}%`;
  document.querySelectorAll<HTMLElement>(`[data-frame-key="${CSS.escape(key)}"]`).forEach((el) => {
    el.style.objectPosition = at;
    el.style.transformOrigin = at;
    el.style.transform = `scale(${zoom})`;
  });
}

function panelLeft() {
  const panel = document.querySelector<HTMLElement>(PANEL);
  return panel ? panel.getBoundingClientRect().left : window.innerWidth;
}

/** The photo has to be on screen, left of the drawer. */
function shown(el: HTMLElement) {
  let n: HTMLElement | null = el;
  while (n && n !== document.body) {
    const s = getComputedStyle(n);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    n = n.parentElement;
  }
  const r = el.getBoundingClientRect();
  const limit = panelLeft();
  const left = Math.max(0, r.left);
  const right = Math.min(r.right, limit - 8);
  const top = Math.max(0, r.top);
  const bottom = Math.min(r.bottom, window.innerHeight);
  return right - left > 80 && bottom - top > 80;
}

const hintStyle = {
  position: "absolute",
  bottom: 16,
  left: 16,
  padding: "4px 12px",
  borderRadius: 999,
  background: "rgba(20, 48, 31, 0.82)",
  color: "#e7f5c8",
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  pointerEvents: "none",
} as const;

/** While Edit is on, the photograph on the left can be dragged and wheel-zoomed. The drawer stays usable. */
export function FrameDragPad() {
  const drag = useSectionDraft<FrameDrag>(FRAME_DRAG);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const padRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const active = drag != null && !drag.done;
  useEffect(() => {
    const root = document.documentElement;
    if (active) root.dataset.frameDrag = "";
    else delete root.dataset.frameDrag;
    return () => {
      delete root.dataset.frameDrag;
    };
  }, [active]);

  const dragKey = active ? drag?.key : undefined;
  useEffect(() => {
    if (!dragKey) {
      setBox(null);
      return;
    }
    const place = () => {
      const nodes = [...document.querySelectorAll<HTMLElement>(`[data-frame-key="${CSS.escape(dragKey)}"]`)];
      const el = nodes.find(shown) ?? null;
      if (!el) {
        setBox(null);
        return;
      }
      // The frame (parent) is the visible window; the image itself may be scaled.
      const r = (el.parentElement ?? el).getBoundingClientRect();
      const limit = panelLeft();
      const right = Math.min(r.right, limit - 8);
      const top = Math.max(0, r.top);
      const bottom = Math.min(r.bottom, window.innerHeight);
      const next = { left: Math.max(0, r.left), top, width: Math.max(0, right - Math.max(0, r.left)), height: Math.max(0, bottom - top) };
      setBox((cur) => (cur && cur.left === next.left && cur.top === next.top && cur.width === next.width && cur.height === next.height ? cur : next));
    };
    place();
    window.addEventListener("resize", place);
    const id = window.setInterval(place, 400);
    return () => {
      window.removeEventListener("resize", place);
      window.clearInterval(id);
    };
  }, [dragKey]);

  useEffect(() => {
    const el = padRef.current;
    if (!el || !dragKey) return;
    const onWheel = (e: WheelEvent) => {
      const current = dragRef.current;
      if (!current) return;
      e.preventDefault();
      e.stopPropagation();
      const step = Math.max(-0.15, Math.min(0.15, -e.deltaY * 0.0015));
      if (!step) return;
      const zoom = clampZoom(current.zoom + step);
      const next = { ...current, zoom };
      dragRef.current = next;
      paint(current.key, current.x, current.y, zoom);
      setSectionDraft(FRAME_DRAG, next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [dragKey, box]);

  if (!drag || !active) return null;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;
    const start = dragRef.current ?? drag;
    const origin = { x: start.x, y: start.y };
    const zoom = start.zoom;
    const sx = e.clientX;
    const sy = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const span = 100 / zoom;
      const x = Math.min(100, Math.max(0, Math.round(origin.x - ((ev.clientX - sx) / rect.width) * span)));
      const y = Math.min(100, Math.max(0, Math.round(origin.y - ((ev.clientY - sy) / rect.height) * span)));
      paint(start.key, x, y, zoom);
      const next = { key: start.key, url: start.url, x, y, zoom };
      dragRef.current = next;
      setSectionDraft(FRAME_DRAG, next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const hint = <span style={hintStyle}>Drag to move &middot; scroll to zoom</span>;
  const common = {
    ref: padRef,
    "data-lenis-prevent": true,
    "data-frame-pad": true,
    onPointerDown,
  };
  const pad =
    box && box.width > 8 ? (
      <div
        {...common}
        className="fe-frame-pad"
        style={{ position: "fixed", zIndex: 130, cursor: "grab", touchAction: "none", left: box.left, top: box.top, width: box.width, height: box.height, outline: "2px dashed rgba(198, 214, 126, 0.9)", outlineOffset: -2 }}
      >
        {hint}
      </div>
    ) : (
      // The photo is off screen: drag a preview of it instead.
      <div
        {...common}
        className="fe-frame-pad"
        style={{ position: "fixed", zIndex: 130, cursor: "grab", touchAction: "none", left: 24, top: 96, bottom: 24, right: `calc(100vw - ${panelLeft()}px + 16px)`, overflow: "hidden", borderRadius: 8, background: "#14301f" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={drag.url}
          alt=""
          draggable={false}
          style={{ pointerEvents: "none", width: "100%", height: "100%", objectFit: "cover", objectPosition: `${drag.x}% ${drag.y}%`, transform: `scale(${drag.zoom})`, transformOrigin: `${drag.x}% ${drag.y}%` }}
        />
        {hint}
      </div>
    );

  return createPortal(pad, document.body);
}
