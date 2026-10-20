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
 * - lens     the next section emerges out of an actual card of the held one (its rect and aspect) and grows to full screen (Aperture / lens)
 * - tilt     the outgoing block is held and folds away: it tips back gently in perspective into a rounded card, a light tint over it, while the next one rises over it
 *
 * Overlay layers are pointer-events none and hidden at progress 0. Desktop only;
 * callers fall back to the lighter `handoff` on phones. Nothing is built under
 * reduced motion (see useChoreography).
 */
export type PinnedEffect = "zoom" | "iris" | "bloom" | "morph" | "slide" | "curtain" | "lens" | "tilt";

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

/**
 * The section that currently follows `el` (its sibling box, skipping hidden
 * siblings and thin strips), so a hand-off can target "whatever comes next"
 * when the editor may insert a section there (e.g. the poster after the hero).
 */
export function following(el: HTMLElement | null): HTMLElement | null {
  let box: HTMLElement | null = el;
  while (box?.parentElement && box.parentElement.children.length < 2) box = box.parentElement;
  let n = box?.nextElementSibling as HTMLElement | null;
  while (n && (n.offsetHeight || 0) <= window.innerHeight * 0.25) n = n.nextElementSibling as HTMLElement | null;
  return n;
}

/** Document bottom of an element from layout, ignoring transforms. */
export function layoutBottom(el: HTMLElement): number {
  let y = 0;
  let node: HTMLElement | null = el;
  while (node) {
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return y + el.offsetHeight;
}

/** The block's painted colour, a touch deeper (fills the space around a shrinking card). */
const tintOf = (el: HTMLElement) => `color-mix(in srgb, ${paintedBg(el)} 88%, #2a3020)`;
const relative = (el: HTMLElement) => (getComputedStyle(el).position === "static" ? "relative" : undefined);
const zOf = (el: Element) => parseInt(getComputedStyle(el).zIndex, 10) || 0;

export function pinnedHandoff(
  prevIn: HTMLElement | null,
  nextIn: HTMLElement | null,
  effect: PinnedEffect,
  opts: {
    origin?: () => Element | null;
    image?: Element | null;
    content?: Element | null;
    /** lens: candidate cards the next section emerges from (nearest visible wins). */
    from?: () => HTMLElement[];
  } = {}
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

  const refreshers: Array<() => void> = [];
  const tl = gsap.timeline({
    defaults: { ease: "none", duration: 1 },
    // Measured on the previous block (its start state is untransformed); the
    // window is its bottom travelling from the viewport bottom to the top,
    // i.e. exactly the next block's top doing the same.
    scrollTrigger: {
      trigger: prev,
      // Measured from LAYOUT (offsets ignore transforms): neighbouring
      // hand-offs translate these same blocks (e.g. the iris holds the session
      // at -100vh until its own window), and a transform-skewed measurement
      // would run this window a whole viewport early, over the wrong section.
      start: () => layoutBottom(prev) - vh(),
      end: () => layoutBottom(prev),
      scrub: true,
      invalidateOnRefresh: true,
      // A refresh moves the progress without firing onUpdate; repaint proxies.
      onRefresh: () => refreshers.forEach((fn) => fn()),
    },
  });
  const holdPrev = () => {
    if (prevStill) tl.fromTo(prev, { y: 0 }, { y: () => vh() }, 0);
  };
  const holdNext = () => {
    if (nextStill) tl.fromTo(next, { y: () => -vh() }, { y: 0 }, 0);
    return nextStill;
  };
  // Proxy-painted effects follow the timeline's own progress (a spacer keeps
  // its length at 1), so they track the scrub exactly in both directions.
  const drive = (state: { p: number }, paint: () => void) => {
    tl.to({}, { duration: 1 }, 0);
    const sync = () => {
      state.p = tl.progress();
      paint();
    };
    tl.eventCallback("onUpdate", sync);
    refreshers.push(sync);
  };
  const wash = (to: number, at = 0) => {
    const w = layer(prev, { background: WASH });
    tl.fromTo(w, { autoAlpha: 0 }, { autoAlpha: to }, at);
  };

  switch (effect) {
    case "tilt": {
      holdPrev();
      if (prevStill) {
        tl.fromTo(
          prev,
          { rotateX: 0, scale: 1, transformPerspective: 1600, transformOrigin: "50% 100%", borderRadius: 0 },
          { rotateX: 7, scale: 0.92, borderRadius: 32 },
          0
        );
        // A soft spread in the card's own (slightly deepened) colour fills the
        // space it leaves (no bare page, no black). It exists ONLY inside the
        // window: a 120vmax spread left on a positioned block would paint over
        // the sections around it (it greyed out "Between sessions" above).
        gsap.set(prev, { overflow: "hidden", boxShadow: "none" });
        tl.set(prev, { boxShadow: () => `0 0 0 120vmax ${tintOf(prev)}` }, 0.002);
        tl.set(prev, { boxShadow: "none" }, 0.998);
      }
      wash(0.18);
      tl.fromTo(next, { boxShadow: "0 -40px 80px -30px rgba(42, 48, 32, 0.28)" }, { boxShadow: "0 0px 0px 0px rgba(14, 18, 10, 0)" }, 0);
      break;
    }
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
      // ONE viewport-fixed disc over both sections (no per-section box, so no
      // seam where one section ends). Nothing is held: the outgoing section
      // scrolls away normally and the disc only starts once it is mostly past
      // (35% of the window), floods the screen by 85%, then dissolves into the
      // incoming section, which by then fills the viewport underneath.
      const disc = layer(document.body, {
        position: "fixed",
        top: "0",
        bottom: "0",
        height: "auto",
        background: nextBg,
        zIndex: "98", // above every section layer (topics orb etc.), under the header (99)
      });
      const state = { p: 0 };
      const paint = () => {
        const p = state.p;
        const w = window.innerWidth;
        const h = vh();
        const o = opts.origin?.()?.getBoundingClientRect();
        const x = o ? Math.min(w, Math.max(0, o.left + o.width / 2)) : w / 2;
        const y = o ? Math.min(h, Math.max(0, o.top + o.height / 2)) : h * 0.6;
        const far = Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) + 8;
        const e = Math.min(1, Math.max(0, (p - 0.35) / 0.5));
        const fade = 1 - Math.min(1, Math.max(0, (p - 0.86) / 0.12));
        disc.style.visibility = e > 0 && fade > 0 ? "visible" : "hidden";
        disc.style.opacity = String(fade);
        disc.style.clipPath = `circle(${e <= 0 ? 0 : 24 + (far - 24) * e * e}px at ${x}px ${y}px)`;
      };
      paint();
      drive(state, paint);
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
      // Post-card emerge (Aperture / lens, re-aimed): the closing section opens
      // out of an actual blog card - from its rect and aspect ratio - and grows
      // to the full screen, while the post's own picture dissolves into the
      // CTA photo. The CTA copy only fades in once the window is (almost) full,
      // so it is never seen clipped or distorted.
      holdPrev();
      const pinned = holdNext();
      wash(0.55);
      if (pinned) {
        type Rect = { l: number; t: number; w: number; h: number; r: number; img: string };
        const state = { p: 0 };
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
        const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const ghost = layer(next, { top: "0", bottom: "auto", left: "0", right: "auto", width: "0", height: "0", zIndex: "1", overflow: "hidden" });
        Object.assign(ghost.style, { backgroundSize: "cover", backgroundPosition: "50% 30%" });
        let src: Rect | null = null;
        let shown = "";
        // The visible card nearest the middle of the screen (hidden or
        // reordered cards simply drop out of the candidates).
        const pick = (): Rect => {
          const h = vh(), w = vw();
          let best: { el: HTMLElement; r: DOMRect; d: number } | null = null;
          for (const el of opts.from?.() ?? []) {
            if (!el.offsetParent) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 40 || r.height < 40 || r.bottom < 0 || r.top > h || r.right < 0 || r.left > w) continue;
            const d = Math.hypot(r.left + r.width / 2 - w / 2, r.top + r.height / 2 - h / 2);
            if (!best || d < best.d) best = { el, r, d };
          }
          if (!best) return { l: w * 0.38, t: h * 0.3, w: w * 0.24, h: h * 0.4, r: 20, img: "" };
          const img = best.el.querySelector("img");
          return {
            l: best.r.left,
            t: best.r.top,
            w: best.r.width,
            h: best.r.height,
            r: parseFloat(getComputedStyle(best.el).borderTopLeftRadius) || 18,
            img: img?.currentSrc || img?.src || "",
          };
        };
        const paint = () => {
          const p = state.p;
          const h = vh(), w = vw(), H = next.offsetHeight;
          // Pick the card when the window opens (the held block keeps it still).
          if (p <= 0.001) src = null;
          else if (!src) src = pick();
          if (p >= 1) {
            src = null;
            next.style.clipPath = "";
            ghost.style.visibility = "hidden";
            return;
          }
          if (!src) {
            next.style.clipPath = `inset(0px 0px ${H}px 0px)`;
            ghost.style.visibility = "hidden";
            return;
          }
          const e = inOut(clamp01(p / 0.86));
          const L = lerp(src.l, 0, e);
          const T = lerp(src.t, 0, e);
          const W = lerp(src.w, w, e);
          const Hh = lerp(src.h, h, e);
          const R = lerp(src.r, 0, e);
          next.style.clipPath = `inset(${T}px ${Math.max(0, w - L - W)}px ${Math.max(0, H - T - Hh)}px ${L}px round ${R}px)`;
          const fade = 1 - clamp01((p - 0.12) / 0.4);
          ghost.style.visibility = src.img && fade > 0 && p > 0.001 ? "visible" : "hidden";
          ghost.style.opacity = String(fade);
          ghost.style.transform = `translate(${L}px, ${T}px)`;
          ghost.style.width = `${W}px`;
          ghost.style.height = `${Hh}px`;
          if (src.img && shown !== src.img) {
            shown = src.img;
            ghost.style.backgroundImage = `url("${src.img.replace(/"/g, "%22")}")`;
          }
        };
        // Recorded by the gsap.context, so its revert restores the original inline clip.
        gsap.set(next, { clipPath: "none" });
        paint();
        drive(state, paint);
        if (opts.image) tl.fromTo(opts.image, { scale: 1.14 }, { scale: 1 }, 0);
        if (opts.content) tl.fromTo(opts.content, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.16 }, 0.8);
      }
      break;
    }
  }
  return effect;
}
