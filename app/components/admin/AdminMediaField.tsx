"use client";

import { useRef, useState } from "react";
import { Repeat } from "lucide-react";
import { AdminMediaPicker } from "@/app/components/admin/AdminMediaPicker";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** `image` or `video`; decides the preview element. */
  kind?: "image" | "video";
  /** Cloudinary folder, e.g. `nura/blog`. */
  folder?: string;
  hint?: string;
  disabled?: boolean;
};

/**
 * One asset: upload to Cloudinary, preview it, or paste a URL.
 *
 * Uploads go through `/api/admin/cloudinary/upload`, which is platform-admin
 * only and sniffs the bytes. A URL stays editable so a designer can point at
 * an asset that already lives elsewhere.
 */
export function AdminMediaField({
  label,
  value,
  onChange,
  kind = "image",
  folder = "nura/admin",
  hint,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder);
      const res = await fetch("/api/admin/cloudinary/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      const url = String(data.url ?? "");
      if (!url) throw new Error("Upload returned no URL.");
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="admin-media-field">
      <span className="admin-field-label">{label}</span>

      {value ? (
        <div className="admin-media-preview">
          {kind === "video" ? (
            <>
              <video src={value} controls preload="metadata" />
              {/* A full overlay would swallow the player controls. */}
              <button
                type="button"
                className="admin-media-replace-corner"
                disabled={disabled || busy}
                aria-label="Replace video"
                onClick={() => setPickerOpen(true)}
              >
                <Repeat size={16} />
              </button>
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="" />
              <button
                type="button"
                className="admin-media-replace"
                disabled={disabled || busy}
                onClick={() => setPickerOpen(true)}
              >
                <Repeat size={20} />
                <span>Replace</span>
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="admin-media-empty">
            {kind === "video" ? "No video selected" : "No image selected"}
          </div>
          <div className="admin-media-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? "Uploading…" : "Upload"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={disabled || busy}
              onClick={() => setPickerOpen(true)}
            >
              Cloudinary
            </button>
          </div>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        hidden
        accept={kind === "video" ? "video/mp4,video/webm" : "image/*"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      <input
        className="field"
        value={value}
        disabled={disabled || busy}
        placeholder={kind === "video" ? "or paste a video URL" : "or paste an image URL"}
        onChange={(e) => onChange(e.target.value)}
      />

      {hint ? <p className="admin-panel-sub">{hint}</p> : null}
      {error ? (
        <p className="admin-mcp-wizard-error" role="alert">
          {error}
        </p>
      ) : null}

      <AdminMediaPicker
        kind={kind}
        open={pickerOpen}
        folder={folder}
        onClose={() => setPickerOpen(false)}
        onPick={onChange}
      />
    </div>
  );
}
