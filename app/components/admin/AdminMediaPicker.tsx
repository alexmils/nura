"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Asset = {
  publicId: string;
  url: string;
  thumb: string;
  width: number;
  height: number;
};

/**
 * The whole Cloudinary library in a card: filter, paged grid, and an upload
 * from this computer in the footer. Picking a file returns its URL and closes.
 */
export function AdminMediaPicker({
  kind,
  open,
  onClose,
  onPick,
  folder = "nura/admin",
}: {
  kind: "image" | "video";
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
  folder?: string;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (next?: string) => {
      setBusy(true);
      setError("");
      try {
        const qs = new URLSearchParams({ paged: "1", type: kind });
        if (next) qs.set("cursor", next);
        const res = await fetch(`/api/admin/cloudinary/assets?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load media.");
        setAssets((prev) =>
          next ? [...prev, ...(data.assets ?? [])] : (data.assets ?? [])
        );
        setCursor(data.nextCursor ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load media.");
      } finally {
        setBusy(false);
      }
    },
    [kind]
  );

  useEffect(() => {
    if (open) {
      setFilter("");
      void load();
    }
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await fetch("/api/admin/cloudinary/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      const url = String(data.url ?? "");
      if (!url) throw new Error("Upload returned no URL.");
      onPick(url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) => asset.publicId.toLowerCase().includes(q));
  }, [assets, filter]);

  if (!open) return null;

  return (
    <div
      className="admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Choose media"
    >
      <div className="admin-modal admin-media-picker">
        <div className="admin-media-picker-head">
          <h2 className="admin-box-title">
            {kind === "video" ? "Choose a video" : "Choose an image"}
          </h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <input
          className="field"
          value={filter}
          placeholder="Filter by file name"
          onChange={(e) => setFilter(e.target.value)}
        />

        {error ? (
          <p className="admin-mcp-wizard-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="admin-media-grid">
          {visible.map((asset) => (
            <button
              key={asset.publicId}
              type="button"
              className="admin-media-tile"
              onClick={() => {
                onPick(asset.url);
                onClose();
              }}
            >
              {kind === "video" ? (
                <video src={asset.thumb || asset.url} muted preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.thumb || asset.url} alt="" loading="lazy" />
              )}
              <span>{asset.publicId.split("/").pop()}</span>
            </button>
          ))}
        </div>

        {busy ? <p className="admin-panel-sub">Loading…</p> : null}
        {!busy && !error && visible.length === 0 ? (
          <p className="admin-panel-sub">
            {assets.length === 0 ? "No assets yet." : "No match."}
          </p>
        ) : null}

        <div className="admin-media-picker-foot">
          <button
            type="button"
            className="btn-secondary"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Upload from your computer"}
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept={kind === "video" ? "video/mp4,video/webm" : "image/*"}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
          <span className="admin-panel-sub">
            {kind === "video" ? "MP4 or WebM" : "JPEG, PNG, WebP, or GIF"}
          </span>
          {cursor ? (
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => void load(cursor)}
            >
              Load more
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
