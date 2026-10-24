"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Rendered email in an iframe that grows to the email's full height, so the
 * whole message (logo to footer) is visible with no inner scrollbar.
 * Same-origin sandbox without scripts: the parent can measure the document and
 * cancel link clicks, but nothing in the email can run.
 */
export function EmailPreviewFrame(props: {
  html: string;
  title: string;
  /** CSS width of the frame (e.g. "100%" or 390). */
  width?: number | string;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState(480);

  const measure = useCallback(() => {
    const doc = ref.current?.contentDocument;
    const root = doc?.documentElement;
    if (!doc || !root) return;
    // The html element is auto height, so its box is the content height even
    // when the frame is taller (scrollHeight would never shrink).
    const h = Math.ceil(
      Math.max(root.getBoundingClientRect().height, doc.body?.getBoundingClientRect().height ?? 0)
    );
    if (h > 0) setHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);

  const onLoad = useCallback(() => {
    const frame = ref.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;
    doc.addEventListener("click", (click) => {
      const target = click.target as Element | null;
      if (target?.closest("a")) click.preventDefault();
    });
    observer.current?.disconnect();
    const RO =
      (frame.contentWindow as (Window & { ResizeObserver?: typeof ResizeObserver }) | null)?.ResizeObserver ??
      window.ResizeObserver;
    if (RO) {
      const ro = new RO(() => measure());
      ro.observe(doc.documentElement);
      if (doc.body) ro.observe(doc.body);
      observer.current = ro;
    }
    doc.querySelectorAll("img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", measure, { once: true });
    });
    measure();
  }, [measure]);

  useEffect(() => () => observer.current?.disconnect(), []);
  // Width changes (Desktop/Mobile) reflow the email.
  useEffect(() => {
    const t = window.setTimeout(measure, 50);
    return () => window.clearTimeout(t);
  }, [props.width, measure]);

  return (
    <iframe
      ref={ref}
      title={props.title}
      srcDoc={props.html}
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      scrolling="no"
      onLoad={onLoad}
      className={`email-frame${props.className ? ` ${props.className}` : ""}`}
      style={{ width: props.width ?? "100%", height }}
      data-testid={props.testId}
    />
  );
}

/** Full-viewport view of the same rendered email, Desktop/Mobile widths. Esc closes. */
export function EmailPreviewOverlay(props: {
  html: string;
  subject: string;
  onClose: () => void;
}) {
  const { onClose } = props;
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="email-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Email preview, full screen"
      data-testid="email-preview-overlay"
    >
      <div className="email-overlay__bar">
        <p className="email-overlay__subject">
          <span>Subject</span> {props.subject || "(empty subject)"}
        </p>
        <div className="email-overlay__modes" role="group" aria-label="Preview width">
          {(["desktop", "mobile"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              className={mode === m ? "is-active" : ""}
              onClick={() => setMode(m)}
            >
              {m === "desktop" ? "Desktop" : "Mobile"}
            </button>
          ))}
        </div>
        <button ref={closeRef} type="button" className="email-overlay__close" onClick={onClose}>
          Close <kbd>Esc</kbd>
        </button>
      </div>
      <div className="email-overlay__stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className={`email-overlay__device${mode === "mobile" ? " is-mobile" : ""}`}>
          <EmailPreviewFrame
            html={props.html}
            title="Email preview, full screen"
            width={mode === "mobile" ? 390 : "100%"}
            testId="email-preview-overlay-frame"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
