"use client";

import gsap from "gsap";
import { paintedBg, siblingBoxesOf, pinnedInsideOf } from "./choreography";

/**
 * Pinned section hand-offs, ported from D:\Python\alexandermils
 * (src/components/motion/SectionHandoff.tsx, CurtainPin.tsx, ScrollBloom.tsx,
 * Aperture.tsx, HomeProcessAbout.tsx, HomeTestimonialsSection.tsx; rules in
 * .cursor/rules/transitions.mdc).
 *
 * The studio site pins the outgoing section (sticky, bottom on the viewport
 * bottom), pulls the next one up 100svh underneath/over it, and runs ONE
 * viewport of effect. Here the same picture is made without wrappers or pin
 * spacers (which would fight React and the section editor's reorder): over the
 * scroll window where the next section's top travels from the viewport bottom
 * to the top, the previous block is counter-translated by exactly the scroll
 * (so it holds perfectly still) and, for effects that need it, the next block
 * is counter-translated the other way (so it is already in place, "pinned
 * underneath"). Everything is scrubbed 1:1 with scroll (scrub: true, linear).
 *
 * Effects (one per boundary, neighbours differ):
 * - zoom     outgoing image scales up into the screen and darkens while the next slides over (SectionHandoff "zoom")
 * - iris     the next section opens through a growing circle over the held one (SectionHandoff "iris")
 * - bloom    a disc in the next section's colour grows from a focal element until it floods the held one (ScrollBloom)
 * - morph    the outgoing backdrop morphs into the next section's colour, the next one's content rises out of it
 * - slide    held frame drifts left and dims while the next is swept in from the right behind a lime edge (HomeProcessAbout slide)
 * - curtain  a straight edge with a lime rule rises and cuts the held section away, revealing the next one pinned underneath (CurtainPin)
 * - lens     the next section's image opens from a small rounded window to full bleed while the held one dims (Aperture / lens)
 *
 * Overlay layers are pointer-events none and hidden at progress 0. Desktop only;
 * callers fall back to the lighter `handoff` on phones. Nothing is built under
 * reduced motion (see useChoreography).
 */
export type PinnedEffect = "zoom" | "iris" | "bloom" | "morph" | "slide" | "curtain" | "lens";

const WASH = "rgb(14, 18, 10)";
const LIME = "#c6d67e";

function layer(host: HTMLElement, style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.className = "mo-layer";
  Object.assign(el.style, {
    position: "absolute",
    left: "0",
    right: "0",
    bottom: "0",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "60",
    visibility: "hidden",
    ...style,
  });
  host.appendChild(el);
  return el;
}

/**
 * The pair must still be neighbours: the section editor can reorder, hide or
 * insert sections, and a held block must never hold over an unrelated one.
 * Hidden siblings and thin strips (under a quarter viewport, e.g. the trust
 * row) between them are tolerated.
 */
export function adjacent(prev: Element, next: Element): boolean {
  let n = prev.nextElementSibling;
  while (n && n !== next) {
    const h = (n as HTMLElement).offsetHeight || 0;
    if (h > window.innerHeight * 0.25) return false;
    n = n.nextElementSibling;
  }
  return n === next;
}

const relative = (el: HTMLElement) => (getComputedStyle(el).position === "static" ? "relative" : undefined);
const zOf = (el: Element) => parseInt(getComputedStyle(el).zIndex, 10) || 0;

export function pinnedHandoff(
  prevIn: HTMLElement | null,
  nextIn: HTMLElement | null,
  effect: PinnedEffect,
  opts: { origin?: () => Element | null; image?: Element | null; content?: Element | null } = {}
): PinnedEffect | null {
  if (!prevIn || !nextIn) return null;
  const [prev, next] = siblingBoxesOf(prevIn, nextIn);
  if (!prev || prev === next || !adjacent(prev, next)) return null;
  const vh = () => window.innerHeight;
  const vw = () => window.innerWidth;
  const nextBg = paintedBg(next);
  const prevStill = !pinnedInsideOf(prev);
  const nextStill = !pinnedInsideOf(next) && next.offsetHeight >= window.innerHeight * 0.95;
  nextIn.setAttribute("data-mo-handoff", effect);

  // Layering: the covering block above the covered one.
  const base = Math.max(1, zOf(prev));
  const nextOnTop = effect !== "curtain";
  gsap.set(prev, { position: relative(prev), zIndex: nextOnTop ? base : base + 1 });
  gsap.set(next, { position: relative(next), zIndex: nextOnTop ? base + 1 : base });
  if (getComputedStyle(next).backgroundColor.match(/rgba\(0, 0, 0, 0\)|transparent/) && getComputedStyle(next).backgroundImage === "none") {
    gsap.set(next, { backgroundColor: nextBg });
  }

  const tl = gsap.timeline({
    defaults: { ease: "none", duration: 1 },
    // Measured on the previous block (its start state is untransformed); the
    // window is its bottom travelling from the viewport bottom to the top,
    // i.e. exactly the next block's top doing the same.
    scrollTrigger: { trigger: prev, start: "bottom bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true },
  });
  const holdPrev = () => {
    if (prevStill) tl.fromTo(prev, { y: 0 }, { y: () => vh() }, 0);
  };
  const holdNext = () => {
    if (nextStill) tl.fromTo(next, { y: () => -vh() }, { y: 0 }, 0);
    return nextStill;
  };
  const wash = (to: number, at = 0) => {
    const w = layer(prev, { background: WASH });
    tl.fromTo(w, { autoAlpha: 0 }, { autoAlpha: to }, at);
  };

  switch (effect) {
    case "zoom": {
      holdPrev();
      const target = opts.image ?? prev;
      tl.fromTo(target, { scale: 1, transformOrigin: "50% 55%" }, { scale: 1.45 }, 0);
      if (opts.content) tl.fromTo(opts.content, { opacity: 1 }, { opacity: 0, duration: 0.5 }, 0);
      wash(0.7);
      tl.fromTo(next, { borderTopLeftRadius: 48, borderTopRightRadius: 48 }, { borderTopLeftRadius: 0, borderTopRightRadius: 0 }, 0);
      break;
    }
    case "iris": {
      holdPrev();
      holdNext();
      wash(0.6);
      // Grow to the viewport's corners over most of the window, then release.
      const corner = () => Math.hypot(window.innerWidth / 2, vh() / 2) + 4;
      const r = () => Math.hypot(next.offsetWidth, next.offsetHeight);
      tl.fromTo(next, { clipPath: () => `circle(0px at 50% ${vh() / 2}px)` }, { clipPath: () => `circle(${corner()}px at 50% ${vh() / 2}px)`, duration: 0.85 }, 0);
      tl.to(next, { clipPath: () => `circle(${r()}px at 50% ${vh() / 2}px)`, duration: 0.15 }, 0.85);
      break;
    }
    case "bloom": {
      holdPrev();
      const disc = layer(prev, { background: nextBg });
      const state = { p: 0 };
      const paint = () => {
        const box = disc.getBoundingClientRect();
        const o = opts.origin?.()?.getBoundingClientRect();
        const x = o ? o.left + o.width / 2 - box.left : box.width / 2;
        const y = o ? o.top + o.height / 2 - box.top : box.height / 2;
        const far = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y)) + 8;
        const e = Math.min(1, state.p / 0.8);
        disc.style.visibility = e > 0 ? "visible" : "hidden";
        disc.style.clipPath = `circle(${e <= 0 ? 0 : 36 + (far - 36) * e * e}px at ${x}px ${y}px)`;
      };
      tl.to(state, { p: 1, onUpdate: paint }, 0);
      break;
    }
    case "morph": {
      const from = paintedBg(prev);
      gsap.set(prev, { backgroundColor: from });
      tl.fromTo(prev, { backgroundColor: from }, { backgroundColor: nextBg, duration: 0.7 }, 0);
      tl.fromTo(next, { backgroundColor: from }, { backgroundColor: nextBg, duration: 0.7 }, 0);
      const content = opts.content ?? next.firstElementChild;
      if (content) tl.fromTo(content, { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0.1);
      break;
    }
    case "slide": {
      holdPrev();
      const pinned = holdNext();
      tl.fromTo(prev, { x: 0 }, { x: () => -window.innerWidth * 0.35 }, 0);
      wash(0.55);
      if (pinned) {
        tl.fromTo(next, { clipPath: "inset(0px 0px 0px 100%)" }, { clipPath: "inset(0px 0px 0px 0%)" }, 0);
        const edge = layer(next, { top: "0", bottom: "auto", height: "100vh", width: "6px", right: "auto", background: LIME, zIndex: "70" });
        tl.fromTo(edge, { autoAlpha: 1, x: () => window.innerWidth }, { x: 0 }, 0);
        tl.to(edge, { autoAlpha: 0, duration: 0.05 }, 0.95);
      }
      break;
    }
    case "curtain": {
      holdPrev();
      const pinned = holdNext();
      tl.fromTo(prev, { clipPath: "inset(0px 0px 0px 0px)" }, { clipPath: () => `inset(0px 0px ${vh()}px 0px)` }, 0);
      if (pinned) {
        const rule = layer(next, { top: "0", bottom: "auto", height: "3px", background: LIME, zIndex: "70" });
        tl.fromTo(rule, { autoAlpha: 1, y: () => vh() }, { y: 0 }, 0);
        tl.to(rule, { autoAlpha: 0, duration: 0.04 }, 0.96);
      }
      break;
    }
    case "lens": {
      holdPrev();
      const pinned = holdNext();
      wash(0.65);
      tl.fromTo(prev, { scale: 1, transformOrigin: "50% 100%" }, { scale: 0.92 }, 0);
      if (pinned) {
        // Collapsed at progress 0 (nothing floats over the block before the window).
        // Painted from a proxy: browsers normalise inset() strings (symmetric
        // sides, "round 0"), which breaks GSAP's string interpolation.
        const lens = { p: 0 };
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const paint = () => {
          const p = lens.p;
          const h = vh(), w = vw(), H = next.offsetHeight;
          // 0 -> 0.15: a small rounded window opens; 0.15 -> 1: it widens to full bleed.
          const a = Math.min(1, p / 0.15);
          const b = p <= 0.15 ? 0 : (p - 0.15) / 0.85;
          const top = p <= 0.15 ? lerp(h * 0.5, h * 0.24, a) : lerp(h * 0.24, 0, b);
          const side = p <= 0.15 ? lerp(w * 0.5, w * 0.32, a) : lerp(w * 0.32, 0, b);
          const bottom = p <= 0.15 ? lerp(H - h * 0.5, H - h * 0.76, a) : lerp(H - h * 0.76, 0, b);
          const round = p <= 0.15 ? 36 : lerp(36, 0, b);
          next.style.clipPath = p >= 1 ? "" : `inset(${top}px ${side}px ${bottom}px ${side}px round ${round}px)`;
        };
        // Recorded by the gsap.context, so its revert restores the original inline clip.
        gsap.set(next, { clipPath: "none" });
        paint();
        tl.to(lens, { p: 1, onUpdate: paint }, 0);
        if (opts.image) tl.fromTo(opts.image, { scale: 1.25 }, { scale: 1 }, 0);
      }
      break;
    }
  }
  return effect;
}