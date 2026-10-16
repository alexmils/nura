"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Asset = {
  url: string;
  publicId: string;
  resource: "image" | "video";
};

export function CloudinaryPicker({
  mediaType,
  onClose,
  onPick,
}: {
  mediaType: "image" | "video";
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/cloudinary/assets")
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { assets?: Asset[]; error?: string } | null;
        if (!res.ok) throw new Error(body?.error || "Could not open Cloudinary.");
        if (!cancelled) setAssets((body?.assets ?? []).filter((item) => item.resource === mediaType));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open Cloudinary.");
      });
    return () => {
      cancelled = true;
    };
  }, [mediaType]);

  return (
    <div className="fe-cld-layer" role="dialog" aria-modal="true" aria-label="Cloudinary">
      <div className="fe-cld-panel">
        <header>
          <h3>From Cloudinary</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        {error ? <p>{error}</p> : null}
        {!assets && !error ? <p>Loading…</p> : null}
        {assets && assets.length === 0 ? <p>Nothing in Cloudinary yet. Upload a file first.</p> : null}
        <div className="fe-cld-grid">
          {assets?.map((asset) => (
            <button key={asset.publicId} type="button" onClick={() => onPick(asset.url)}>
              {asset.resource === "video" ? (
                <video src={asset.url} muted playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.url} alt="" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
