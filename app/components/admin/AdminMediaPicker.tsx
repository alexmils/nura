"use client";

import { useCallback, useEffect, useState } from "react";

type Asset = {
  publicId: string;
  url: string;
  thumb: string;
  width: number;
  height: number;
};

/**
 * Pick an existing Cloudinary asset instead of uploading another copy.
 * Reads through `/api/admin/cloudinary/assets`, which is platform-admin only.
 */
export function AdminMediaPicker({
  kind,
  open,
  onClose,
  onPick,
}: {
  kind: "image" | "video";
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (next?: string) => {
      setBusy(true);
      setError("");
      try {
        const qs = new URLSearchParams({ type: kind });
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
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Choose from Cloudinary"
    >
      <div className="admin-modal admin-media-picker">
        <div className="admin-media-picker-head">
          <h2 className="admin-box-title">Choose from Cloudinary</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        {error ? (
          <p className="admin-mcp-wizard-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="admin-media-grid">
          {assets.map((asset) => (
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
        {!busy && !error && assets.length === 0 ? (
          <p className="admin-panel-sub">No assets yet.</p>
        ) : null}
        {cursor ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void load(cursor)}
          >
            Load more
          </button>
        ) : null}
      </div>
    </div>
  );
}
