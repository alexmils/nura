"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { CloudinaryPicker } from "@/app/components/admin/CloudinaryPicker";

function isCloudinary(src: string): boolean {
  return src.includes("res.cloudinary.com");
}

/** Two circular arrows: "replace this media". Centered on hover/focus. */
function ReplaceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 3.5V8h4.5" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 20.5V16h-4.5" />
    </svg>
  );
}

/** Hover Replace. Local files offer Import to Cloudinary. No pasted URL. */
export function ReplaceableThumb({
  src,
  alt = "",
  mediaType = "image",
  onReplace,
}: {
  src: string;
  alt?: string;
  mediaType?: "image" | "video";
  onReplace: (url: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canImport = Boolean(src) && src.startsWith("/") && !isCloudinary(src);
  const isEmbed = mediaType === "video" && /youtube|youtu\.be|vimeo/i.test(src);

  useEffect(() => {
    if (!menu) return;
    const onDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setMenu(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menu]);

  async function send(form: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/marketing-media", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !body?.url) throw new Error(body?.error || "Upload failed.");
      onReplace(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={boxRef} className="fe-replace">
      <button type="button" className={`fe-replace-thumb fe-replace-thumb--${mediaType}`} aria-haspopup="menu" aria-expanded={menu} aria-label={
          src
            ? mediaType === "video" ? "Replace video" : "Replace image"
            : mediaType === "video" ? "Upload video" : "Upload image"
        } onClick={() => setMenu((open) => !open)}>
        {src && mediaType === "video" ? (
          isEmbed ? (
            <span className="fe-replace-embed">
              <Play size={16} aria-hidden /> Video link
            </span>
          ) : (
            <video src={src} muted playsInline />
          )
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} />
        ) : (
          <span>Add</span>
        )}
        <span className="fe-replace-hover" aria-hidden>
          <span className="fe-replace-hover-icon">
            <ReplaceIcon />
          </span>
        </span>
      </button>
      {menu ? (
        <div className="fe-replace-menu" role="menu">
          {canImport ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                const form = new FormData();
                form.set("source", src);
                void send(form);
              }}
            >
              Import to Cloudinary
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              setPicker(true);
            }}
          >
            From Cloudinary
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              fileRef.current?.click();
            }}
          >
            Upload
          </button>
          {src ? (
            <button
              type="button"
              role="menuitem"
              className="fe-replace-remove"
              onClick={() => {
                setMenu(false);
                onReplace("");
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        hidden
        accept={mediaType === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp,image/gif"}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const form = new FormData();
          form.set("file", file);
          void send(form);
        }}
      />
      {busy ? <small>Uploading…</small> : null}
      {error ? <small>{error}</small> : null}
      {picker ? (
        <CloudinaryPicker
          used={[]}
          single
          mediaType={mediaType}
          current={src}
          onClose={() => setPicker(false)}
          onImport={(urls) => {
            if (urls[0]) onReplace(urls[0]);
            setPicker(false);
          }}
        />
      ) : null}
    </div>
  );
}
