"use client";

/**
 * Up to 3 thumbs +N; click opens a portaled lightbox (Esc / click-away).
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MAX_VISIBLE = 3;

export function TaskImageStrip({
  urls,
  size = "sm",
  className = "",
}: {
  urls: string[];
  size?: "sm" | "md";
  className?: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const clean = urls.filter((u) => typeof u === "string" && u.trim());
  if (clean.length === 0) return null;

  const visible = clean.slice(0, MAX_VISIBLE);
  const extra = clean.length - visible.length;
  const dim = size === "md" ? "h-11 w-11" : "h-9 w-9";

  return (
    <>
      <span
        className={`inline-flex items-center gap-1 shrink-0 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {visible.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            className={`cursor-pointer ${dim} overflow-hidden rounded border border-[var(--border)] hover:border-[#84B067]`}
            title="View image"
            aria-label={`View image ${i + 1} of ${clean.length}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLightboxIndex(i);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
        {extra > 0 ? (
          <button
            type="button"
            className={`cursor-pointer ${dim} rounded border border-[var(--border)] bg-[var(--bg-page,#edf9ed)] text-[10px] font-medium text-[var(--text-secondary)] hover:border-[#84B067] hover:text-[var(--text)]`}
            title={`${extra} more`}
            aria-label={`${extra} more images`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLightboxIndex(MAX_VISIBLE);
            }}
          >
            +{extra}
          </button>
        ) : null}
      </span>
      {lightboxIndex != null ? (
        <TaskImageLightbox
          urls={clean}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </>
  );
}

export function TaskImageLightbox({
  urls,
  index,
  onIndexChange,
  onClose,
}: {
  urls: string[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const count = urls.length;
  const safeIndex = ((index % count) + count) % count;
  const src = urls[safeIndex];
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onIndexChangeRef = useRef(onIndexChange);
  onCloseRef.current = onClose;
  onIndexChangeRef.current = onIndexChange;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === "ArrowLeft" && count > 1) {
        e.preventDefault();
        onIndexChangeRef.current((safeIndex - 1 + count) % count);
      } else if (e.key === "ArrowRight" && count > 1) {
        e.preventDefault();
        onIndexChangeRef.current((safeIndex + 1) % count);
      }
    }
    // Capture phase so Esc still works when focus stayed on the thumb button
    // (row/strip handlers used to stopPropagation and swallow the bubble).
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    rootRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [count, safeIndex]);

  if (!src || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      tabIndex={-1}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {count > 1 ? (
        <button
          type="button"
          className="absolute left-3 sm:left-6 grid h-10 w-10 cursor-pointer place-items-center rounded border border-white/30 bg-black/70 text-white hover:border-[#84B067]"
          title="Previous"
          aria-label="Previous image"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((safeIndex - 1 + count) % count);
          }}
        >
          ←
        </button>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="max-h-[88vh] max-w-[min(96vw,1100px)] rounded border border-white/20 object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {count > 1 ? (
        <button
          type="button"
          className="absolute right-3 sm:right-6 grid h-10 w-10 cursor-pointer place-items-center rounded border border-white/30 bg-black/70 text-white hover:border-[#84B067]"
          title="Next"
          aria-label="Next image"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((safeIndex + 1) % count);
          }}
        >
          →
        </button>
      ) : null}
      {count > 1 ? (
        <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-xs tabular-nums text-white/70">
          {safeIndex + 1} / {count}
        </span>
      ) : null}
    </div>,
    document.body
  );
}
