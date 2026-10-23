import { useEffect, useRef, useState } from "react";

/* Shared loop helpers for the marketing mini-app demos (Ground first and the
   How it works stage demos). Plain module so client files can share it. */

export function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useInViewLoop(enabled: boolean) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(enabled);

  useEffect(() => {
    if (enabled) {
      setInView(true);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  return { rootRef, inView };
}

export function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
