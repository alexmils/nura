"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ImagePlus,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { fileToOgImageDataUrl } from "@/lib/avatar-client";

export type OgLibraryImage = {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  usedBy: string[];
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The internal OG library: every image uploaded from Admin → SEO, with the
 * same browse → preview → use flow as the Cloudinary picker, plus rename,
 * replace and delete. Delete is refused while a page still points at the
 * image, so it cannot silently break a share card.
 */
export function OgImageLibrary({
  current,
  onClose,
  onPick,
}: {
  current?: string;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [images, setImages] = useState<OgLibraryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<OgLibraryImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rename, setRename] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/og-library", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        images?: OgLibraryImage[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not load the library");
      setImages(data.images ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the library");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (preview) setPreview(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, onClose]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return images;
    return images.filter((image) => image.name.toLowerCase().includes(q));
  }, [images, query]);

  function openPreview(image: OgLibraryImage) {
    setPreview(image);
    setRename(image.name);
    setConfirmDelete(false);
    setError("");
  }

  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const dataUrl = await fileToOgImageDataUrl(file);
      const res = await fetch("/api/admin/og-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, dataUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        image?: OgLibraryImage;
        error?: string;
      };
      if (!res.ok || !data.image) {
        throw new Error(data.error ?? "Upload failed");
      }
      await load();
      openPreview(data.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveName() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/og-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: preview.id, name: rename }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        image?: OgLibraryImage;
        error?: string;
      };
      if (!res.ok || !data.image) {
        throw new Error(data.error ?? "Could not rename");
      }
      setImages((prev) =>
        prev.map((image) => (image.id === data.image!.id ? data.image! : image))
      );
      setPreview(data.image);
      setRename(data.image.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename");
    } finally {
      setBusy(false);
    }
  }

  async function replace(file: File) {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const dataUrl = await fileToOgImageDataUrl(file);
      const res = await fetch("/api/admin/og-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: preview.id, dataUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        image?: OgLibraryImage;
        error?: string;
      };
      if (!res.ok || !data.image) {
        throw new Error(data.error ?? "Could not replace the image");
      }
      setImages((prev) =>
        prev.map((image) => (image.id === data.image!.id ? data.image! : image))
      );
      setPreview(data.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not replace the image");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/og-library?id=${encodeURIComponent(preview.id)}`,
        { method: "DELETE" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not delete the image");
      setImages((prev) => prev.filter((image) => image.id !== preview.id));
      setPreview(null);
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the image");
    } finally {
      setBusy(false);
    }
  }

  async function importExisting() {
    setImporting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/og-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        imported?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not import");
      // The SEO settings were rewritten; a reload gives the editor fresh drafts.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import");
      setImporting(false);
    }
  }

  const body = (
    <div
      className="og-library-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="og-library"
        role="dialog"
        aria-modal="true"
        aria-labelledby="og-library-title"
      >
        <header className="og-library-head">
          <div>
            <h2 id="og-library-title" className="admin-panel-title">
              OG image library
            </h2>
            <p className="admin-panel-sub">
              Every image uploaded for share cards. Pick one, or manage the
              library without leaving the page.
            </p>
          </div>
          <button
            type="button"
            className="og-library-close"
            aria-label="Close library"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <div className="og-library-toolbar">
          <input
            type="search"
            className="field og-library-search"
            placeholder="Search by name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search OG images"
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={importing}
            onClick={() => void importExisting()}
            title="Move data-URL images already saved in SEO into this library"
          >
            <RefreshCw size={16} />
            {importing ? "Importing…" : "Import existing"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </div>

        {error ? <p className="og-library-error">{error}</p> : null}

        {loading ? (
          <p className="admin-panel-sub">Loading…</p>
        ) : (
          <>
            <div className="og-library-grid">
              <button
                type="button"
                className="og-library-card og-library-upload-card"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <span className="og-library-upload-icon">
                  {uploading ? (
                    <Loader2 size={22} className="animate-spin" />
                  ) : (
                    <ImagePlus size={22} />
                  )}
                </span>
                <span className="og-library-upload-title">
                  {uploading ? "Uploading…" : "Upload image"}
                </span>
                <span className="og-library-upload-hint">
                  JPEG, PNG or WebP
                </span>
              </button>
              {shown.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  className={`og-library-card${
                    image.url === current ? " is-current" : ""
                  }`}
                  onClick={() => openPreview(image)}
                >
                  <span className="og-library-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt="" loading="lazy" />
                    {image.url === current ? (
                      <span
                        className="og-library-check"
                        aria-label="Current image"
                      >
                        <Check size={14} />
                      </span>
                    ) : null}
                  </span>
                  <span className="og-library-card-meta">
                    <span className="og-library-name">{image.name}</span>
                    <span className="og-library-date">
                      {formatDate(image.createdAt)}
                    </span>
                  </span>
                  {image.usedBy.length > 0 ? (
                    <span className="og-library-badge">In use</span>
                  ) : null}
                </button>
              ))}
            </div>
            {images.length > 0 && shown.length === 0 ? (
              <p className="admin-panel-sub">No images match that search.</p>
            ) : null}
          </>
        )}

        {preview ? (
          <div
            className="og-library-preview-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPreview(null);
            }}
          >
            <div className="og-library-preview" role="dialog" aria-modal="true">
              <div className="og-library-preview-head">
                <div>
                  <p className="admin-kicker">Image</p>
                  <h3>{preview.name}</h3>
                </div>
                <button
                  type="button"
                  className="og-library-close"
                  aria-label="Close preview"
                  onClick={() => setPreview(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="og-library-preview-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.url} alt={preview.name} />
              </div>

              {preview.usedBy.length > 0 ? (
                <p className="og-library-used">
                  Used by: {preview.usedBy.join(", ")}
                </p>
              ) : (
                <p className="og-library-used">Not used anywhere yet.</p>
              )}

              <label className="admin-field-label">
                Name
                <input
                  className="field"
                  value={rename}
                  onChange={(event) => setRename(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveName();
                  }}
                />
              </label>

              <div className="og-library-preview-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    onPick(preview.url);
                    onClose();
                  }}
                >
                  Use this image
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy || rename.trim() === preview.name}
                  onClick={() => void saveName()}
                >
                  Save name
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => replaceRef.current?.click()}
                >
                  Replace image
                </button>
                <input
                  ref={replaceRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void replace(file);
                  }}
                />

                {confirmDelete ? (
                  <span className="og-library-confirm">
                    <span>Delete?</span>
                    <button
                      type="button"
                      className="og-library-delete"
                      disabled={busy}
                      onClick={() => void remove()}
                    >
                      {busy ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="og-library-delete"
                    disabled={busy || preview.usedBy.length > 0}
                    title={
                      preview.usedBy.length > 0
                        ? "Replace it on the pages that use it first"
                        : "Delete this image"
                    }
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return typeof document === "undefined" ? body : createPortal(body, document.body);
}
