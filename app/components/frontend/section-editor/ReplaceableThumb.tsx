"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { CloudinaryPicker } from "@/app/components/admin/CloudinaryPicker";

function isCloudinary(src: string): boolean {
  return src.includes("res.cloudinary.com");
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
      <button type="button" className="fe-replace-thumb" aria-haspopup="menu" aria-expanded={menu} aria-label={src ? "Change media" : "Upload media"} onClick={() => setMenu((open) => !open)}>
        {src && mediaType === "video" ? (
          <video src={src} muted playsInline />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} />
        ) : (
          <span>Add</span>
        )}
        <span className="fe-replace-hover" aria-hidden>
          <Pencil size={18} />
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
