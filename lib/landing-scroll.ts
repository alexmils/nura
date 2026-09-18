import type Lenis from "lenis";

let landingLenis: Lenis | null = null;

/** sessionStorage key — Next soft-nav to `/#hash` often drops the fragment. */
export const PENDING_LANDING_HASH_KEY = "nura-landing-hash";

const PRELOADER_DONE_EVENT = "fe-preloader-done";

/** Register Lenis from the home landing motion hook. */
export function setLandingLenis(instance: Lenis | null) {
  landingLenis = instance;
}

/** Active Lenis instance on the home landing (null off-home). */
export function getLandingLenis(): Lenis | null {
  return landingLenis;
}

export function notifyLandingPreloaderDone() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PRELOADER_DONE_EVENT));
}

/** Stash section id before navigating to `/` from another route. */
export function stashPendingLandingHash(id: string) {
  if (typeof sessionStorage === "undefined") return;
  const clean = id.replace(/^#/, "").trim();
  if (!clean || clean === "home") {
    sessionStorage.removeItem(PENDING_LANDING_HASH_KEY);
    return;
  }
  sessionStorage.setItem(PENDING_LANDING_HASH_KEY, clean);
}

/** Read + clear pending hash from sessionStorage. */
export function consumePendingLandingHash(): string {
  if (typeof sessionStorage === "undefined") return "";
  const raw = sessionStorage.getItem(PENDING_LANDING_HASH_KEY) ?? "";
  sessionStorage.removeItem(PENDING_LANDING_HASH_KEY);
  return raw.replace(/^#/, "").trim();
}

/** True when the home mint preloader is locking overflow. */
export function isLandingPreloaderActive(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("fe-preloader-active");
}

/**
 * Resolve target section id from URL hash, optional override, or pending stash.
 */
export function resolveLandingHash(preferred?: string | null): string {
  const fromPreferred = (preferred ?? "").replace(/^#/, "").trim();
  if (fromPreferred && fromPreferred !== "home") return fromPreferred;
  if (typeof window === "undefined") return fromPreferred;
  const fromUrl = window.location.hash.replace(/^#/, "").trim();
  if (fromUrl && fromUrl !== "home") return fromUrl;
  if (typeof sessionStorage !== "undefined") {
    const pending = sessionStorage.getItem(PENDING_LANDING_HASH_KEY) ?? "";
    const clean = pending.replace(/^#/, "").trim();
    if (clean && clean !== "home") return clean;
  }
  return fromPreferred === "home" ? "home" : fromUrl || "";
}

/**
 * Smooth-scroll to a landing section id (with header offset).
 * Prefers Lenis when the home page is mounted; falls back to native smooth scroll.
 */
export function scrollToLandingSection(
  hashOrId: string,
  extraOffsetPx = 0
): boolean {
  if (typeof document === "undefined") return false;
  const id = hashOrId.replace(/^#/, "");
  if (!id) return false;
  const el = document.getElementById(id);
  if (!el) return false;

  // Overflow locked — scroll would be discarded when the preloader unlocks.
  if (isLandingPreloaderActive()) return false;

  const header = document.querySelector<HTMLElement>(".frontend-header");
  const offset =
    (header ? -(header.offsetHeight + 12) : -88) + extraOffsetPx;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (landingLenis && !reduced) {
    landingLenis.scrollTo(el, {
      offset,
      duration: 1.35,
      easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    });
  } else {
    const top = el.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  }
  return true;
}

type ScheduleOpts = {
  /** Prefer this id over URL / stash. */
  hash?: string | null;
  /** Consume sessionStorage pending hash after a successful resolve. */
  consumePending?: boolean;
};

/**
 * Scroll to landing hash once the preloader is gone and the section exists.
 * Retries across Lenis mount + layout; syncs `#id` into the URL when needed.
 */
export function scheduleScrollToLandingHash(opts: ScheduleOpts = {}): () => void {
  if (typeof window === "undefined") return () => {};

  let cancelled = false;
  let timer = 0;
  let attempt = 0;
  const maxAttempts = 40;
  let lockedId =
    (opts.hash ?? "").replace(/^#/, "").trim() ||
    resolveLandingHash() ||
    (opts.consumePending ? consumePendingLandingHash() : "");

  const syncUrl = (id: string) => {
    if (!id || id === "home") {
      if (window.location.hash) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
      }
      return;
    }
    const next = `#${id}`;
    if (window.location.hash !== next) {
      window.history.replaceState(null, "", next);
    }
  };

  const tick = () => {
    if (cancelled) return;

    if (isLandingPreloaderActive()) {
      attempt += 1;
      if (attempt < maxAttempts) {
        timer = window.setTimeout(tick, 100);
      }
      return;
    }

    if (!lockedId) {
      lockedId = resolveLandingHash(opts.hash);
    }
    if (!lockedId) return;

    if (lockedId === "home") {
      syncUrl("home");
      scrollToLandingSection("home");
      return;
    }

    const ok = scrollToLandingSection(lockedId);
    if (ok) {
      if (opts.consumePending) {
        sessionStorage.removeItem(PENDING_LANDING_HASH_KEY);
      }
      syncUrl(lockedId);
      return;
    }

    attempt += 1;
    if (attempt < maxAttempts) {
      timer = window.setTimeout(tick, 80);
    }
  };

  const onPreloaderDone = () => {
    if (cancelled) return;
    window.clearTimeout(timer);
    attempt = 0;
    timer = window.setTimeout(tick, 40);
  };

  window.addEventListener(PRELOADER_DONE_EVENT, onPreloaderDone);
  // First try shortly after mount (covers reduced-motion / no preloader).
  timer = window.setTimeout(tick, 50);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
    window.removeEventListener(PRELOADER_DONE_EVENT, onPreloaderDone);
  };
}
