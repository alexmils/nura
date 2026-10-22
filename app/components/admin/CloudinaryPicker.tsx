"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Check, ChevronRight, Folder, FolderOpen, Library, Loader2, Minus, Pencil, Plus, Tag, Trash2, Upload, X } from "lucide-react";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { labelColor } from "@/lib/media-label-colors";
import { LabelSwatches } from "@/app/components/admin/LabelSwatches";

/**
 * Stacking: homepage section editors are z-[100] drawers portalled to body;
 * the picker opens from inside them, so it portals to body too and sits above
 * at z-[150] (below the z-[200] page-transition overlay).
 */
export const CLOUDINARY_PICKER_Z = "z-[150]";

type Asset = {
  assetId?: string;
  publicId: string;
  url: string;
  thumb: string;
  width: number;
  height: number;
  etag?: string;
};

type FolderNode = { name: string; path: string; children: FolderNode[] };

type Label = { id: string; name: string; color: string; count: number; keys: string[] };

/** Labels share the folder selection state, prefixed so they never clash with a folder path. */
const LABEL = "@label:";
const DEFAULT_UPLOAD_FOLDER = "unsorted";

function inLabel(label: Label, asset: Asset): boolean {
  return label.keys.includes(`pid:${asset.publicId}`)
    || (asset.assetId ? label.keys.includes(asset.assetId) : false)
    || (asset.etag ? label.keys.includes(`etag:${asset.etag}`) : false);
}

type UploadItem = { id: string; name: string; progress: number; error?: string; done?: boolean };

function uploadWithProgress(file: File, folder: string, onProgress: (p: number) => void) {
  return new Promise<{ url: string; publicId: string; assetId?: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/cloudinary/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(0.95, e.loaded / e.total));
    };
    xhr.onload = () => {
      let body: { url?: string; publicId?: string; assetId?: string; error?: string } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.url && body.publicId) {
        resolve({ url: body.url, publicId: body.publicId, assetId: body.assetId });
      } else reject(new Error(body?.error || "Upload failed."));
    };
    xhr.onerror = () => reject(new Error("Upload failed (network)."));
    const form = new FormData();
    form.set("file", file);
    form.set("folder", folder);
    xhr.send(form);
  });
}

/**
 * True when this library file is already the cover or already in the gallery.
 * Matches the delivered URL and the public id inside a transformed URL.
 */
export function cloudinaryAssetInUse(publicId: string, url: string, used: string[]): boolean {
  return used.some((item) => {
    if (!item) return false;
    if (item === url || item === publicId) return true;
    return item.includes(`/${publicId}.`) || item.endsWith(`/${publicId}`) || item.includes(`/${publicId}/`);
  });
}

function flatten(nodes: FolderNode[], depth = 0): { node: FolderNode; depth: number }[] {
  return nodes.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)]);
}

type PageBody = { assets?: Asset[]; nextCursor?: string | null; error?: string } | null;

export function CloudinaryPicker({
  used,
  onClose,
  onImport,
  onImportAssets,
  onUpload,
  mediaType = "image",
  single: singleProp = false,
  max,
  manage = false,
  initialFiles,
  current,
  defaultFolder,
  embedded = false,
}: {
  used: string[];
  onClose: () => void;
  onImport?: (urls: string[]) => void;
  /** When set, the picker hands back the library records instead of bare URLs. */
  onImportAssets?: (assets: Asset[]) => void;
  /** Used when "All" is selected; with a folder selected the picker uploads into it. */
  onUpload?: () => void;
  /** Library mode (Media page): no "Use image" button, just browse, label, move and upload. */
  manage?: boolean;
  /** Files dropped on the Media page before the library opened: uploaded right away. */
  initialFiles?: FileList | null;
  /** "video" lists the video library and picks a single file. */
  mediaType?: "image" | "video";
  /** Pick exactly one file (e.g. replacing one image). */
  single?: boolean;
  /** Free slots left in the field: selection stops there with a visible notice. */
  max?: number;
  /** URL already in the slot. Once it appears in the library it is ticked, same as a click. */
  current?: string;
  /** Folder uploads go to when "All" is selected. Defaults to `unsorted`. */
  defaultFolder?: string;
  /** Render in the page flow (Media page) instead of as a modal. */
  embedded?: boolean;
}) {
  const single = mediaType === "video" || singleProp;
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Always opens on "All" ("" = whole library).
  const [folder, setFolder] = useState("");
  const [scope, setScope] = useState({ folder: "", filter: "" });
  const [folders, setFolders] = useState<FolderNode[] | null>(null);
  // Bumped by the Refresh button: the server caches the library for hours to save Cloudinary's hourly API budget.
  const [refreshTick, setRefreshTick] = useState(0);
  const forceRefresh = useRef(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [limitHit, setLimitHit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [moving, setMoving] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; group: Asset[] } | null>(null);
  const [labelMenu, setLabelMenu] = useState<{ x: number; y: number; id: string; confirm?: boolean } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [creating, setCreating] = useState<"sidebar" | "menu" | null>(null);
    const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [newColor, setNewColor] = useState("default");
  const [fileOver, setFileOver] = useState(false);
  const fileDepth = useRef(0);
  const dragIds = useRef<Asset[]>([]);
  const lastClicked = useRef<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scopeKey = useRef("|");
  const moreInFlight = useRef(false);
  // Picks survive folder switches, so keep the records, not just the URLs.
  const pickedMap = useRef(new Map<string, Asset>());

  useEffect(() => {
    let cancelled = false;
    fetch(refreshTick ? "/api/admin/cloudinary/folders?refresh=1" : "/api/admin/cloudinary/folders")
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { folders?: FolderNode[]; error?: string } | null;
        if (!res.ok) throw new Error(body?.error || "Could not load folders.");
        if (!cancelled) setFolders(body?.folders ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFolders([]);
          setFolderError(err instanceof Error ? err.message : "Could not load folders.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  async function loadLabels() {
    try {
      const res = await fetch(`/api/admin/media-labels?type=${mediaType}`);
      const body = (await res.json().catch(() => null)) as { labels?: Label[] } | null;
      if (res.ok) setLabels(body?.labels ?? []);
    } catch {
      /* labels are optional; the library still works */
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/media-labels?type=${mediaType}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { labels?: Label[] } | null) => {
        if (!cancelled && body?.labels) setLabels(body.labels);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mediaType]);

  // Debounced scope change (folder + name filter). Reset happens here, not in the fetch effect.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = { folder, filter: query.trim() };
      const key = `${next.folder}|${next.filter}`;
      if (key === scopeKey.current) return;
      scopeKey.current = key;
      setLoading(true);
      setError(null);
      setAssets([]);
      setCursor(null);
      scrollRef.current?.scrollTo({ top: 0 });
      setScope(next);
    }, 250); // also absorbs fast arrow-key stepping: only the folder you stop on is fetched
    return () => window.clearTimeout(handle);
  }, [query, folder, scope.folder]);

  function pageUrl(extra?: Record<string, string>) {
    if (scope.folder.startsWith(LABEL)) {
      const params = new URLSearchParams({ type: mediaType });
      if (scope.filter) params.set("q", scope.filter);
      return `/api/admin/media-labels/${encodeURIComponent(scope.folder.slice(LABEL.length))}?${params}`;
    }
    return `/api/admin/cloudinary/assets?${pageParams(extra)}`;
  }

  function pageParams(extra?: Record<string, string>) {
    // Nura's route returns the full Media-page inventory unless `paged=1`.
    const params = new URLSearchParams({ paged: "1", ...extra });
    if (scope.folder) {
      params.set("folder", scope.folder);
      if (scope.filter) params.set("q", scope.filter);
    } else if (scope.filter) {
      params.set("prefix", scope.filter);
    }
    if (mediaType === "video") params.set("type", "video");
    return params;
  }

  useEffect(() => {
    let cancelled = false;
    const refresh = forceRefresh.current && !scope.folder.startsWith(LABEL);
    forceRefresh.current = false;
    fetch(refresh ? `${pageUrl()}&refresh=1` : pageUrl())
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as PageBody;
        if (!res.ok) throw new Error(body?.error || "Could not load Cloudinary.");
        if (cancelled) return;
        setAssets((current) => {
          // Keep just-uploaded files at the top even if the search index lags.
          const fresh = body?.assets ?? [];
          const pending = current.filter((a) => !fresh.some((f) => f.publicId === a.publicId));
          return [...pending, ...fresh];
        });
        setCursor(body?.nextCursor ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load Cloudinary.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, mediaType, refreshTick]);

  async function loadMore() {
    if (!cursor || moreInFlight.current) return;
    moreInFlight.current = true;
    const forKey = scopeKey.current;
    setLoading(true);
    try {
      const res = await fetch(pageUrl({ cursor }));
      const body = (await res.json().catch(() => null)) as PageBody;
      if (!res.ok) throw new Error(body?.error || "Could not load more.");
      if (forKey !== scopeKey.current) return;
      setAssets((current) => [
        ...current,
        ...(body?.assets ?? []).filter((a) => !current.some((c) => c.publicId === a.publicId)),
      ]);
      setCursor(body?.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more.");
    } finally {
      moreInFlight.current = false;
      if (forKey === scopeKey.current) setLoading(false);
    }
  }

  useInfiniteScroll(sentinelRef, {
    root: scrollRef,
    onLoadMore: loadMore,
    hasMore: Boolean(cursor),
    loading,
    disabled: Boolean(error),
    itemCount: assets.length,
  });

  // Esc / click-away close an open menu before anything else; returns true when one was open.
  const closeMenusRef = useRef<() => boolean>(() => false);
  useEffect(() => {
    closeMenusRef.current = () => {
      const wasOpen = Boolean(menu || labelMenu || renaming || creating);
      setMenu(null);
      setLabelMenu(null);
      setRenaming(null);
      setCreating(null);
      return wasOpen;
    };
  });
  useEffect(() => {
    if (!menu && !labelMenu) return;
    function away(event: MouseEvent) {
      if ((event.target as HTMLElement | null)?.closest("[data-cld-menu]")) return;
      setMenu(null);
      setLabelMenu(null);
      if (creating === "menu") setCreating(null);
    }
    window.addEventListener("mousedown", away, true);
    return () => window.removeEventListener("mousedown", away, true);
  }, [menu, labelMenu, creating]);

  // Arrow keys walk the folder tree; latest state via a ref so the listener stays stable.
  const navRef = useRef<(key: string) => void>(() => {});
  const treeRef = useRef<HTMLElement>(null);

  // Escape closes only the picker (capture phase, before the editors' listeners).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        const t = event.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (menu || labelMenu) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        navRef.current(event.key);
        return;
      }
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      event.preventDefault();
      if (closeMenusRef.current()) return;
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, menu, labelMenu]);

  function choose(path: string) {
    setFolder(path);
    if (path && !path.startsWith(LABEL)) {
      // Expand the ancestors so the active folder is visible.
      const parts = path.split("/");
      setOpen((current) => {
        const next = { ...current };
        for (let i = 1; i < parts.length; i += 1) next[parts.slice(0, i).join("/")] = true;
        return next;
      });
    }
  }

  // Shift-click selects the range since the last click (multi-select only).
  function clickAsset(asset: Asset, index: number, event: React.MouseEvent) {
    if (event.shiftKey && !single && lastClicked.current !== null) {
      const [from, to] = [Math.min(lastClicked.current, index), Math.max(lastClicked.current, index)];
      const range = assets.slice(from, to + 1).filter((a) => !cloudinaryAssetInUse(a.publicId, a.url, used));
      for (const a of range) pickedMap.current.set(a.url, a);
      setPicked((current) => {
        const next = [...current, ...range.map((a) => a.url).filter((u) => !current.includes(u))];
        if (max !== undefined && next.length > max) {
          setLimitHit(true);
          return next.slice(0, max);
        }
        return next;
      });
      lastClicked.current = index;
      return;
    }
    lastClicked.current = index;
    toggle(asset);
  }

  function startDrag(asset: Asset, event: React.DragEvent) {
    const group = picked.includes(asset.url)
      ? picked.map((url) => pickedMap.current.get(url)).filter((a): a is Asset => Boolean(a))
      : [asset];
    dragIds.current = group;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", group.map((a) => a.publicId).join("\n"));
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 3200);
  }

  async function moveTo(target: string) {
    const group = dragIds.current;
    dragIds.current = [];
    setDropTarget(null);
    if (!target || group.length === 0) return;
    const ids = new Set(group.map((a) => a.publicId));
    const inScope = !scope.folder || scope.folder.startsWith(LABEL) || target === scope.folder || target.startsWith(`${scope.folder}/`);
    const snapshot = assets;
    // Optimistic: files leaving the folder being browsed disappear right away.
    if (!inScope) setAssets((current) => current.filter((a) => !ids.has(a.publicId)));
    setMoving(group.length);
    setError(null);
    try {
      const res = await fetch("/api/admin/cloudinary/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicIds: [...ids], folder: target, type: mediaType }),
      });
      const body = (await res.json().catch(() => null)) as
        | { moved?: { from: string; to: string; url: string | null }[]; failed?: { publicId: string; error: string }[]; error?: string }
        | null;
      if (!res.ok && !body?.moved?.length) throw new Error(body?.failed?.[0]?.error || body?.error || "Could not move the files.");
      const moved = body?.moved ?? [];
      const failed = new Set((body?.failed ?? []).map((f) => f.publicId));
      const renamed = new Map(moved.filter((m) => m.from !== m.to).map((m) => [m.from, m]));
      const fix = (a: Asset): Asset => {
        const m = renamed.get(a.publicId);
        if (!m) return a;
        const swap = (u: string) => u.split(`/${m.from}.`).join(`/${m.to}.`);
        return { ...a, publicId: m.to, url: m.url ?? swap(a.url), thumb: swap(a.thumb) };
      };
      setAssets((current) => {
        // Roll failed files back in (in their original order), apply renames.
        const back = snapshot.filter((a) => failed.has(a.publicId) && !current.some((c) => c.publicId === a.publicId));
        return [...back, ...current].map(fix);
      });
      if (renamed.size > 0) {
        setPicked((current) =>
          current.map((url) => {
            const a = pickedMap.current.get(url);
            if (!a || !renamed.has(a.publicId)) return url;
            const next = fix(a);
            pickedMap.current.delete(url);
            pickedMap.current.set(next.url, next);
            return next.url;
          }),
        );
      }
      const noun = mediaType === "video" ? "video" : "image";
      if (renamed.size > 0) void loadLabels();
      if (moved.length > 0) showToast(`Moved ${moved.length} ${noun}${moved.length === 1 ? "" : "s"} to ${target}`);
      if (failed.size > 0) setError(`${failed.size} could not be moved: ${body?.failed?.[0]?.error ?? "unknown error"}`);
    } catch (err) {
      setAssets(snapshot);
      setError(err instanceof Error ? err.message : "Could not move the files.");
    } finally {
      setMoving(0);
    }
  }

  function dropProps(path: string) {
    return {
      onDragOver: (event: React.DragEvent) => {
        if (dragIds.current.length === 0 || event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (dropTarget !== path) setDropTarget(path);
      },
      onDragLeave: () => setDropTarget((t) => (t === path ? null : t)),
      onDrop: (event: React.DragEvent) => {
        if (dragIds.current.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        if (path.startsWith(LABEL)) {
          const group = dragIds.current;
          dragIds.current = [];
          setDropTarget(null);
          void setLabelFor(path.slice(LABEL.length), group, "add");
        } else void moveTo(path);
      },
    };
  }

  /* ---------------- labels ---------------- */

  function groupFor(asset: Asset): Asset[] {
    return picked.includes(asset.url)
      ? picked.map((url) => pickedMap.current.get(url)).filter((a): a is Asset => Boolean(a))
      : [asset];
  }

  async function setLabelFor(labelId: string, group: Asset[], action: "add" | "remove") {
    const label = labels.find((l) => l.id === labelId);
    if (!label || group.length === 0) return;
    // Optimistic counts/checkmarks; reload from the DB after.
    setLabels((current) =>
      current.map((l) => {
        if (l.id !== labelId) return l;
        const keys = new Set(l.keys);
        for (const a of group) {
          const ks = [`pid:${a.publicId}`, ...(a.assetId ? [a.assetId] : []), ...(a.etag ? [`etag:${a.etag}`] : [])];
          for (const k of ks) {
            if (action === "add") keys.add(k);
            else keys.delete(k);
          }
        }
        const count = action === "add"
          ? l.count + group.filter((a) => !inLabel(l, a)).length
          : Math.max(0, l.count - group.filter((a) => inLabel(l, a)).length);
        return { ...l, keys: [...keys], count };
      }),
    );
    if (action === "remove" && folder === `${LABEL}${labelId}`) {
      const ids = new Set(group.map((a) => a.publicId));
      setAssets((current) => current.filter((a) => !ids.has(a.publicId)));
    }
    try {
      const res = await fetch("/api/admin/media-labels/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId, action, assets: group, type: mediaType }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error || "Could not update the label.");
      const noun = group.length === 1 ? (mediaType === "video" ? "video" : "image") : `${group.length} files`;
      showToast(action === "add" ? `Added ${noun} to ${label.name}` : `Removed ${noun} from ${label.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the label.");
    }
    void loadLabels();
  }

  async function createLabel(name: string, thenAdd?: Asset[]) {
    const clean = name.trim();
    if (!clean) return;
    try {
      const res = await fetch("/api/admin/media-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean, color: newColor }),
      });
      const body = (await res.json().catch(() => null)) as { label?: Label; error?: string } | null;
      if (!res.ok || !body?.label) throw new Error(body?.error || "Could not create the label.");
      const created = body.label;
      setLabels((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setCreating(null);
      setNewColor("default");
      if (thenAdd?.length) {
        const res2 = await fetch("/api/admin/media-labels/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labelId: created.id, action: "add", assets: thenAdd, type: mediaType }),
        });
        if (res2.ok) showToast(`Added to ${created.name}`);
        setMenu(null);
      } else showToast(`Label ${created.name} created`);
      void loadLabels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the label.");
    }
  }

  async function renameLabel(id: string, name: string) {
    const clean = name.trim();
    setRenaming(null);
    if (!clean || labels.find((l) => l.id === id)?.name === clean) return;
    const res = await fetch(`/api/admin/media-labels/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: clean }),
    });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) setError(body?.error || "Could not rename the label.");
    void loadLabels();
  }

  async function recolorLabel(id: string, color: string) {
    setLabels((current) => current.map((l) => (l.id === id ? { ...l, color } : l)));
    const res = await fetch(`/api/admin/media-labels/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    if (!res.ok) {
      setError("Could not change the label colour.");
      void loadLabels();
    }
  }

  async function deleteLabel(id: string) {
    setLabelMenu(null);
    const name = labels.find((l) => l.id === id)?.name ?? "label";
    setLabels((current) => current.filter((l) => l.id !== id));
    if (folder === `${LABEL}${id}`) choose("");
    const res = await fetch(`/api/admin/media-labels/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) showToast(`Label ${name} deleted. The images are still in Cloudinary.`);
    else setError("Could not delete the label.");
    void loadLabels();
  }

  /* ---------------- drop files from the computer ---------------- */


  const isFileDrag = (event: React.DragEvent) =>
    dragIds.current.length === 0 && Array.from(event.dataTransfer.types).includes("Files");

  const fallbackFolder = defaultFolder?.trim() || DEFAULT_UPLOAD_FOLDER;
  const uploadFolder = folder && !folder.startsWith(LABEL) ? folder : fallbackFolder;

  const fileDropProps = {
    onDragEnter: (event: React.DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      fileDepth.current += 1;
      setFileOver(true);
    },
    onDragOver: (event: React.DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!isFileDrag(event)) return;
      fileDepth.current = Math.max(0, fileDepth.current - 1);
      if (fileDepth.current === 0) setFileOver(false);
    },
    onDrop: (event: React.DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      fileDepth.current = 0;
      setFileOver(false);
      void uploadFiles(event.dataTransfer.files, true);
    },
  };

  function toggle(asset: Asset) {
    if (cloudinaryAssetInUse(asset.publicId, asset.url, used)) return;
    pickedMap.current.set(asset.url, asset);
    const isOn = picked.includes(asset.url);
    if (!isOn && !single && max !== undefined && picked.length >= max) {
      setLimitHit(true);
      return;
    }
    setLimitHit(false);
    setPicked((current) =>
      current.includes(asset.url)
        ? current.filter((url) => url !== asset.url)
        : single
          ? [asset.url]
          : [...current, asset.url],
    );
  }

  async function uploadFiles(files: FileList | null, dropped = false) {
    if (!files || files.length === 0) return;
    const target = dropped ? uploadFolder : folder && !folder.startsWith(LABEL) ? folder : fallbackFolder;
    const accepted = Array.from(files).filter((f) => /^(image\/(jpeg|png|webp)|video\/(mp4|webm))$/.test(f.type));
    const skipped = files.length - accepted.length;
    const list = single ? accepted.slice(0, 1) : accepted;
    if (list.length === 0) {
      setError("Only JPEG, PNG, WebP, MP4 or WebM files can be uploaded.");
      return;
    }
    const labelId = folder.startsWith(LABEL) ? folder.slice(LABEL.length) : null;
    setUploading(true);
    setError(skipped > 0 ? `${skipped} file${skipped === 1 ? "" : "s"} skipped (only JPEG, PNG, WebP, MP4, WebM).` : null);
    const batch = list.map((file, i) => ({ id: `${Date.now()}-${i}`, name: file.name, progress: 0 }));
    setUploads((current) => [...current, ...batch]);
    const patch = (id: string, change: Partial<UploadItem>) =>
      setUploads((current) => current.map((u) => (u.id === id ? { ...u, ...change } : u)));
    const added: Asset[] = [];
    let otherType = 0;
    // Two at a time: quick for a handful, gentle on the server for a big drop.
    let next = 0;
    async function worker() {
      while (next < list.length) {
        const i = next++;
        const file = list[i];
        const item = batch[i];
        const isVid = file.type.startsWith("video/");
        try {
          const body = await uploadWithProgress(file, target, (p) => patch(item.id, { progress: p }));
          patch(item.id, { progress: 1, done: true });
          if (isVid !== (mediaType === "video")) {
            otherType += 1;
            continue;
          }
          const thumb = isVid
            ? body.url.replace(/\.[a-z0-9]+$/i, ".jpg").replace("/upload/", "/upload/so_0,w_480,h_640,c_limit/")
            : body.url.replace("/upload/", "/upload/w_480,h_640,c_limit/");
          added.push({ assetId: body.assetId, publicId: body.publicId, url: body.url, thumb, width: 0, height: 0 });
        } catch (err) {
          patch(item.id, { error: err instanceof Error ? err.message : "Upload failed." });
        }
      }
    }
    await Promise.all([worker(), worker()]);
    if (added.length > 0) {
      for (const a of added) pickedMap.current.set(a.url, a);
      setAssets((current) => [...added, ...current.filter((a) => !added.some((n) => n.publicId === a.publicId))]);
      setPicked((current) => {
        if (single) return [added[0].url];
        const merged = [...current, ...added.map((a) => a.url).filter((u) => !current.includes(u))];
        if (max !== undefined && merged.length > max) {
          setLimitHit(true);
          return merged.slice(0, max);
        }
        return merged;
      });
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      // Uploading while a label is open files the new uploads under that label too.
      if (labelId) await setLabelFor(labelId, added, "add");
      else showToast(`Uploaded ${added.length} to ${target}`);
    }
    if (otherType > 0) showToast(`${otherType} ${mediaType === "video" ? "image" : "video"}${otherType === 1 ? "" : "s"} uploaded to ${target} (shown in the ${mediaType === "video" ? "image" : "video"} library)`);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    // Finished rows fade out; failed rows stay until dismissed.
    window.setTimeout(() => setUploads((current) => current.filter((u) => !u.done)), 2400);
  }

  const currentUrl = current?.trim() || "";
  const currentPrimed = useRef(false);
  useEffect(() => {
    if (!currentUrl || currentPrimed.current) return;
    const match = assets.find((asset) => cloudinaryAssetInUse(asset.publicId, asset.url, [currentUrl]));
    if (!match) return;
    currentPrimed.current = true;
    pickedMap.current.set(match.url, match);
    setPicked((existing) => (existing.includes(match.url) ? existing : single ? [match.url] : [match.url, ...existing]));
    requestAnimationFrame(() => {
      scrollRef.current?.querySelector(`[data-cld-id="${encodeURIComponent(match.publicId)}"]`)?.scrollIntoView({ block: "nearest" });
    });
  }, [assets, currentUrl, single]);

  const initialDone = useRef(false);
  useEffect(() => {
    if (initialDone.current || !initialFiles || initialFiles.length === 0) return;
    initialDone.current = true;
    void uploadFiles(initialFiles, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles]);

  const flat = folders ? flatten(folders) : [];
  const visible = folders
    ? flat.filter(({ node }) => {
        const parts = node.path.split("/");
        for (let i = 1; i < parts.length; i += 1) if (!open[parts.slice(0, i).join("/")]) return false;
        return true;
      })
    : [];

  const navigate = (key: string) => {
    const paths = ["", ...visible.map(({ node }) => node.path), ...labels.map((l) => `${LABEL}${l.id}`)];
    const idx = Math.max(0, paths.indexOf(folder));
    const node = visible.find(({ node: n }) => n.path === folder)?.node;
    if (key === "ArrowDown") choose(paths[Math.min(paths.length - 1, idx + 1)]);
    else if (key === "ArrowUp") choose(paths[Math.max(0, idx - 1)]);
    else if (key === "ArrowRight") {
      if (node && node.children.length > 0) {
        if (!open[node.path]) setOpen((c) => ({ ...c, [node.path]: true }));
        else choose(node.children[0].path);
      }
    } else if (key === "ArrowLeft") {
      if (folder.startsWith(LABEL)) return;
      if (node && node.children.length > 0 && open[node.path]) setOpen((c) => ({ ...c, [node.path]: false }));
      else if (folder) choose(folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "");
    }
  };

  useEffect(() => {
    navRef.current = navigate;
  });

  // Keep the active folder in view while stepping through the tree.
  useEffect(() => {
    const el = treeRef.current?.querySelector<HTMLElement>(`[data-folder-path="${CSS.escape(folder)}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [folder, folders]);

  function renderTree() {
    return (
      <ul className="space-y-0.5 text-[13px]">
        <li>
          <button
            type="button"
            onClick={() => choose("")}
            data-folder-path=""
            aria-current={folder === "" ? "true" : undefined}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${
              folder === "" ? "bg-[#D2FB02] font-semibold text-[#1B2F0C]" : "hover:bg-[#EAE8DD]"
            }`}
          >
            <Library size={14} /> All
          </button>
        </li>
        {visible.map(({ node, depth }) => {
          const active = folder === node.path;
          const expanded = Boolean(open[node.path]);
          return (
            <li key={node.path} className="flex items-center" style={{ paddingLeft: depth * 14 }}>
              {node.children.length > 0 ? (
                <button
                  type="button"
                  aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
                  aria-expanded={expanded}
                  onClick={() => setOpen((c) => ({ ...c, [node.path]: !expanded }))}
                  className="rounded p-0.5 text-[#3C5E19] hover:bg-[#EAE8DD]"
                >
                  <ChevronRight size={13} className={`transition-transform motion-reduce:transition-none ${expanded ? "rotate-90" : ""}`} />
                </button>
              ) : (
                <span className="w-[17px]" />
              )}
              <button
                type="button"
                {...dropProps(node.path)}
                onClick={() => choose(node.path)}
                data-folder-path={node.path}
                aria-current={active ? "true" : undefined}
                title={node.path}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left ${
                  active ? "bg-[#D2FB02] font-semibold text-[#1B2F0C]" : "hover:bg-[#EAE8DD]"
                } ${dropTarget === node.path ? "outline-dashed outline-2 outline-[#1B2F0C] bg-[#EEF9B8]" : ""}`}
              >
                {active ? <FolderOpen size={14} className="shrink-0" /> : <Folder size={14} className="shrink-0 text-[#8A6D3B]" />}
                <span className="truncate">{node.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  function renderLabels() {
    return (
      <div className="mt-5 border-t border-[#E3E0D3] pt-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#3C5E19]">Labels</p>
          <button
            type="button"
            onClick={() => {
              setCreating("sidebar");
            }}
            aria-label="New label"
            title="New label"
            className="rounded-full p-1 text-[#3C5E19] transition-colors hover:bg-[#EAE8DD] hover:text-[#1B2F0C]"
          >
            <Plus size={13} />
          </button>
        </div>
        <ul className="space-y-0.5 text-[13px]">
          {labels.map((l) => {
            const path = `${LABEL}${l.id}`;
            const active = folder === path;
            const over = dropTarget === path;
            const c = labelColor(l.color);
            if (renaming === l.id) {
              return (
                <li key={l.id}>
                  <NameInput
                    initial={l.name}
                    onSubmit={(name) => void renameLabel(l.id, name)}
                    onCancel={() => setRenaming(null)}
                  />
                </li>
              );
            }
            return (
              <li key={l.id}>
                <button
                  type="button"
                  data-folder-path={path}
                  aria-current={active ? "true" : undefined}
                  onClick={() => choose(path)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu(null);
                    setLabelMenu({ x: event.clientX, y: event.clientY, id: l.id });
                  }}
                  {...dropProps(path)}
                  style={
                    over
                      ? undefined
                      : active
                        ? { background: c.bg, borderColor: c.border, color: c.text, boxShadow: `0 0 0 3px ${c.dot}33` }
                        : undefined
                  }
                  className={`flex w-full items-center gap-2 rounded-lg border-2 px-2 py-1 text-left transition-[background-color,border-color,box-shadow] duration-300 ${
                    over
                      ? "border-[#D2FB02] bg-[#1B2F0C] text-[#D2FB02]"
                      : active
                        ? "font-semibold"
                        : "border-transparent hover:bg-[#EAE8DD]"
                  }`}
                >
                  <Tag size={13} className="shrink-0" style={over ? undefined : { color: c.key === "default" ? "#3C5E19" : c.dot, fill: `${c.dot}55` }} />
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  <span className={`text-[11px] tabular-nums ${active || over ? "" : "text-muted-foreground"}`}>{l.count}</span>
                </button>
              </li>
            );
          })}
          {creating === "sidebar" ? (
            <li>
              <NameInput
                initial=""
                placeholder="Label name, e.g. Horizontal"
                onSubmit={(name) => void createLabel(name)}
                onCancel={() => setCreating(null)}
              />
              <div className="mt-1.5 px-1">
                <LabelSwatches value={newColor} onChange={setNewColor} />
              </div>
            </li>
          ) : null}
        </ul>
        {labels.length === 0 && creating !== "sidebar" ? (
          <p className="px-2 text-[12px] leading-5 text-muted-foreground">
            Your own bookmarks. Right-click an image and choose Add to label, or press + to make one.
          </p>
        ) : null}
      </div>
    );
  }

  function renderAssetMenu() {
    if (!menu) return null;
    const group = menu.group;
    const currentLabel = folder.startsWith(LABEL) ? labels.find((l) => `${LABEL}${l.id}` === folder) : undefined;
    const x = Math.min(menu.x, window.innerWidth - 260);
    const y = Math.min(menu.y, window.innerHeight - Math.min(420, 140 + labels.length * 34));
    return (
      <div
        data-cld-menu
        role="menu"
        style={{ left: x, top: Math.max(8, y) }}
        className="fixed z-[170] w-60 overflow-hidden rounded-xl border-2 border-[#1B2F0C] bg-[#F7F6F1] text-[13px] text-[#1B2F0C] shadow-2xl"
        onContextMenu={(event) => event.preventDefault()}
      >
        <p className="border-b border-[#E3E0D3] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#3C5E19]">
          {group.length === 1 ? "Add to label" : `Add ${group.length} selected to label`}
        </p>
        <div className="max-h-64 overflow-y-auto py-1" data-lenis-prevent>
          {labels.map((l) => {
            const n = group.filter((a) => inLabel(l, a)).length;
            const state = n === 0 ? "off" : n === group.length ? "on" : "some";
            return (
              <button
                key={l.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={state === "on" ? true : state === "some" ? "mixed" : false}
                onClick={() => void setLabelFor(l.id, group, state === "on" ? "remove" : "add")}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-[#EAE8DD]"
              >
                <span
                  className={`inline-flex size-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                    state === "off" ? "border-[#8A8F7A] bg-white" : "border-[#1B2F0C] bg-[#1B2F0C] text-[#D2FB02]"
                  }`}
                >
                  {state === "on" ? <Check size={10} strokeWidth={3} /> : state === "some" ? <Minus size={10} strokeWidth={3} /> : null}
                </span>
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: labelColor(l.color).dot }} />
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{l.count}</span>
              </button>
            );
          })}
          {labels.length === 0 ? <p className="px-3 py-1.5 text-[12px] text-muted-foreground">No labels yet.</p> : null}
        </div>
        <div className="border-t border-[#E3E0D3] py-1">
          {creating === "menu" ? (
            <div className="px-2 py-1">
              <NameInput
                initial=""
                placeholder="New label name"
                onSubmit={(name) => void createLabel(name, group)}
                onCancel={() => setCreating(null)}
              />
              <div className="mt-1.5 px-1">
                <LabelSwatches value={newColor} onChange={setNewColor} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                  setCreating("menu");
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-[#EAE8DD]"
            >
              <Plus size={14} /> New label{"\u2026"}
            </button>
          )}
          {currentLabel ? (
            <button
              type="button"
              onClick={() => {
                void setLabelFor(currentLabel.id, group, "remove");
                setMenu(null);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[#8C2F1B] transition-colors hover:bg-[#F3E1DC]"
            >
              <X size={14} /> Remove from {currentLabel.name}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  function renderLabelMenu() {
    if (!labelMenu) return null;
    const l = labels.find((x) => x.id === labelMenu.id);
    if (!l) return null;
    return (
      <div
        data-cld-menu
        role="menu"
        style={{ left: Math.min(labelMenu.x, window.innerWidth - 250), top: Math.min(labelMenu.y, window.innerHeight - 200) }}
        className="fixed z-[170] w-64 overflow-hidden rounded-xl border-2 border-[#1B2F0C] bg-[#F7F6F1] py-1 text-[13px] text-[#1B2F0C] shadow-2xl"
        onContextMenu={(event) => event.preventDefault()}
      >
        {labelMenu.confirm ? (
          <div className="px-3 py-2">
            <p className="text-[13px] font-semibold">Delete {l.name}?</p>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
              Only the label goes. The {l.count} image{l.count === 1 ? "" : "s"} stay in Cloudinary.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => void deleteLabel(l.id)}
                className="rounded-lg bg-[#8C2F1B] px-3 py-1 text-[12px] font-semibold text-white hover:brightness-110"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setLabelMenu(null)}
                className="rounded-lg px-3 py-1 text-[12px] hover:bg-[#EAE8DD]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setLabelMenu(null);
                setRenaming(l.id);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-[#EAE8DD]"
            >
              <Pencil size={14} /> Rename
            </button>
            <div className="border-y border-[#E3E0D3] px-3 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#3C5E19]">Color</p>
              <LabelSwatches value={l.color} onChange={(key) => void recolorLabel(l.id, key)} />
            </div>
            <button
              type="button"
              onClick={() => setLabelMenu({ ...labelMenu, confirm: true })}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[#8C2F1B] transition-colors hover:bg-[#F3E1DC]"
            >
              <Trash2 size={14} /> Delete label
            </button>
          </>
        )}
      </div>
    );
  }

  const isVideo = mediaType === "video";
  const dialogTitle = manage
    ? "Media library"
    : single
    ? isVideo ? "Choose a video from Cloudinary" : "Choose an image from Cloudinary"
    : isVideo ? "Add videos from Cloudinary" : "Add images from Cloudinary";

  const panel = (
      <div
        role="dialog"
        aria-modal={embedded ? undefined : true}
        aria-label={dialogTitle}
        className={
          embedded
            ? "relative flex h-[76vh] min-h-[520px] w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-sm"
            : "relative flex h-[94vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-card text-foreground shadow-2xl sm:h-[92vh] sm:w-[90vw]"
        }
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{dialogTitle}</h2>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              folder.startsWith(LABEL)
                ? `Filter in ${labels.find((l) => `${LABEL}${l.id}` === folder)?.name ?? "label"}`
                : folder ? `Filter in ${folder.split("/").pop()}` : "Filter by folder or name"
            }
            aria-label="Filter by name"
            className="order-last w-full rounded-lg border-2 border-[#8FB3C9] bg-[#F1F6F9] px-3 py-1.5 text-[13px] text-[#1B2F0C] outline-none focus:border-[#4E86A8] sm:order-none sm:ml-auto sm:w-64"
          />
          {embedded ? null : (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-auto rounded-full bg-[#F3E1DC] p-1.5 text-[#8C2F1B] hover:bg-[#EBC9C0] sm:ml-0"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Mobile: folders as a dropdown. */}
        <div className="border-b border-border px-4 py-2 md:hidden">
          <label className="sr-only" htmlFor="cld-folder-select">Folder</label>
          <select
            id="cld-folder-select"
            value={folder}
            onChange={(event) => choose(event.target.value)}
            className="w-full rounded-lg border-2 border-[#1B2F0C] bg-[#D2FB02] px-3 py-1.5 text-[13px] font-semibold text-[#1B2F0C]"
          >
            <option value="">All</option>
            {flat.map(({ node, depth }) => (
              <option key={node.path} value={node.path}>
                {`${"\u00A0\u00A0".repeat(depth)}${node.name}`}
              </option>
            ))}
            {labels.length > 0 ? (
              <optgroup label="Labels">
                {labels.map((l) => (
                  <option key={l.id} value={`${LABEL}${l.id}`} style={{ color: labelColor(l.color).text }}>{`${l.name} (${l.count})`}</option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>

        <div className="relative flex min-h-0 flex-1">
          {fileOver ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#1B2F0C]/80 p-6 transition-opacity duration-300 md:left-64">
              <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#D2FB02] px-10 py-8 text-center text-[#D2FB02]">
                <Upload size={28} />
                <p className="text-[15px] font-semibold">Drop to upload to {uploadFolder}</p>
                <p className="text-[12px] text-[#EAE8DD]">
                  JPEG, PNG, WebP, MP4 or WebM
                  {folder.startsWith(LABEL) ? ` \u00B7 also added to ${labels.find((l) => `${LABEL}${l.id}` === folder)?.name ?? "this label"}` : ""}
                </p>
              </div>
            </div>
          ) : null}
          <aside ref={treeRef} className="hidden w-64 shrink-0 overflow-y-auto overscroll-contain border-r border-border bg-[#F7F6F1] p-3 md:block" data-lenis-prevent aria-label="Folders and labels (use arrow keys to move between them)">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#3C5E19]">Folders</p>
              <button
                type="button"
                onClick={() => {
                  forceRefresh.current = true;
                  setFolderError(null);
                  setFolders(null);
                  setAssets([]);
                  setLoading(true);
                  setRefreshTick((t) => t + 1);
                }}
                className="grid size-6 place-items-center rounded-full text-[#3C5E19] transition-colors hover:bg-[#3C5E19]/10"
                title="Refresh from Cloudinary (the library is cached for a few hours to save API calls)"
                aria-label="Refresh folders and images from Cloudinary"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>
            {folders === null ? (
              <p className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Loading folders…
              </p>
            ) : (
              renderTree()
            )}
            {folderError ? <p className="mt-2 px-2 text-xs text-red-600">{folderError}</p> : null}
            {renderLabels()}
          </aside>

          <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" data-lenis-prevent {...fileDropProps}>

            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            {loading && assets.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading the library…
              </p>
            ) : null}
            {!loading && !error && assets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {folder.startsWith(LABEL)
                  ? "Nothing in this label yet. Right-click images and choose Add to label, or drag them onto the label."
                  : folder ? "Nothing in this folder or its subfolders matches that." : "Nothing in Cloudinary matches that."}
              </p>
            ) : null}

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-7">
              {assets.map((asset, index) => {
                const added = cloudinaryAssetInUse(asset.publicId, asset.url, used);
                const selected = picked.includes(asset.url);
                return (
                  <button
                    key={asset.publicId}
                    data-cld-id={encodeURIComponent(asset.publicId)}
                    type="button"
                    aria-disabled={added || undefined}
                    onClick={(event) => clickAsset(asset, index, event)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setLabelMenu(null);
                      setCreating(null);
                      setMenu({ x: event.clientX, y: event.clientY, group: groupFor(asset) });
                    }}
                    draggable
                    onDragStart={(event) => startDrag(asset, event)}
                    onDragEnd={() => {
                      dragIds.current = [];
                      setDropTarget(null);
                    }}
                    title={asset.publicId}
                    className={`group relative overflow-hidden rounded-xl border text-left ${
                      added
                        ? "border-[#3C5E19] opacity-80"
                        : selected
                          ? "border-[#1B2F0C] ring-2 ring-[#1B2F0C]"
                          : "border-border"
                    }`}
                  >
                    <img src={asset.thumb} alt="" className="aspect-[3/4] w-full bg-[#EAE8DD] object-contain" />
                    {added ? (
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-[#3C5E19] px-2 py-0.5 text-[10px] font-medium text-[#EAE8DD]">
                        <Check size={10} /> Added
                      </span>
                    ) : null}
                    {!selected && !added ? (
                      <span aria-hidden className="absolute right-1.5 top-1.5 hidden size-5 rounded-full border-2 border-white bg-[#1B2F0C]/30 shadow group-hover:block" />
                    ) : null}
                    {labels.some((l) => inLabel(l, asset)) ? (
                      <span
                        title={labels.filter((l) => inLabel(l, asset)).map((l) => l.name).join(", ")}
                        className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-[#1B2F0C]/85 px-1.5 py-0.5 text-[10px] font-medium text-[#D2FB02]"
                      >
                        {labels
                          .filter((l) => inLabel(l, asset))
                          .slice(0, 5)
                          .map((l) => (
                            <span key={l.id} className="size-2 rounded-full ring-1 ring-white/70" style={{ background: labelColor(l.color).dot }} />
                          ))}
                      </span>
                    ) : null}
                    {selected ? (
                      <span className="absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-[#1B2F0C] text-[#D2FB02]">
                        <Check size={12} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div ref={sentinelRef} aria-hidden className="h-px" />
            {loading && assets.length > 0 ? (
              <p className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground" role="status">
                <Loader2 className="size-3.5 animate-spin" /> Loading…
              </p>
            ) : null}
          </div>
        </div>

        {renderAssetMenu()}
        {renderLabelMenu()}
        {uploads.length > 0 ? (
          <div role="status" className="absolute bottom-20 right-4 z-10 w-72 space-y-1.5 rounded-xl border-2 border-[#1B2F0C] bg-[#F7F6F1] p-3 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#3C5E19]">Uploading to {uploadFolder}</p>
              {uploads.every((u) => u.done || u.error) ? (
                <button type="button" aria-label="Dismiss" onClick={() => setUploads([])} className="rounded-full p-0.5 hover:bg-[#EAE8DD]">
                  <X size={12} />
                </button>
              ) : null}
            </div>
            {uploads.map((u) => (
              <div key={u.id} className="text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{u.name}</span>
                  {u.error ? (
                    <span className="text-[#8C2F1B]">Failed</span>
                  ) : u.done ? (
                    <Check size={12} className="text-[#3C5E19]" />
                  ) : (
                    <span className="tabular-nums text-muted-foreground">{Math.round(u.progress * 100)}%</span>
                  )}
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#E3E0D3]">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ease-out ${u.error ? "bg-[#8C2F1B]" : "bg-[#1B2F0C]"}`}
                    style={{ width: `${Math.max(4, u.progress * 100)}%` }}
                  />
                </div>
                {u.error ? <p className="mt-0.5 text-[11px] text-[#8C2F1B]">{u.error}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
        {toast || moving > 0 ? (
          <div role="status" className="pointer-events-none absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#1B2F0C] px-4 py-2 text-[13px] font-medium text-[#D2FB02] shadow-lg">
            {moving > 0 ? (
              <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Moving {moving}.</span>
            ) : (
              toast
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple={!single}
            accept={mediaType === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp"}
            onChange={(event) => void uploadFiles(event.target.files)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => (folder || !onUpload ? fileRef.current?.click() : onUpload())}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-[#B8743A] bg-[#FBEFE3] px-3 py-1.5 text-[13px] font-medium text-[#7A4518] hover:bg-[#F6E0CA] disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload from this computer
          </button>
          <span className="text-[12px] text-muted-foreground">
            {folder ? `into ${uploadFolder}` : !onUpload ? `into ${fallbackFolder}` : ""}
            {picked.length > 0 ? `${folder ? " · " : ""}${picked.length} selected` : ""}
            {!single && max !== undefined ? `${folder || picked.length ? " · " : ""}room for ${max}` : ""}
          </span>
          {limitHit ? (
            <span role="status" className="rounded-full bg-[#FBEFE3] px-2.5 py-1 text-[12px] font-medium text-[#7A4518]">
              Limit reached: this field takes {max} more.
            </span>
          ) : null}
          {picked.length > 0 && !single ? (
            <button
              type="button"
              onClick={() => setPicked([])}
              className="rounded-lg px-2 py-1 text-[12px] text-[#6B5B95] underline-offset-2 hover:underline"
            >
              Clear selection
            </button>
          ) : null}
          {manage ? (
            <span className="ml-auto text-[12px] text-muted-foreground">Right-click for labels {"\u00B7"} drag onto a folder to move {"\u00B7"} drop files to upload</span>
          ) : (
          <button
            type="button"
            disabled={picked.length === 0}
            onClick={() => {
              const chosen = picked
                .map((url) => pickedMap.current.get(url))
                .filter((asset): asset is Asset => Boolean(asset));
              if (onImportAssets) onImportAssets(chosen);
              else onImport?.(chosen.map((asset) => asset.url));
            }}
            className="ml-auto rounded-lg bg-[#1B2F0C] px-4 py-2 text-[13px] font-semibold text-[#D2FB02] disabled:opacity-40"
          >
            {single ? (mediaType === "video" ? "Use video" : "Use image") : picked.length > 0 ? `Add ${picked.length}` : "Add"}
          </button>
          )}
        </div>
      </div>
  );

  if (embedded) return <div className="admin-picker-embedded">{panel}</div>;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className={`fixed inset-0 ${CLOUDINARY_PICKER_Z} flex items-center justify-center bg-[#1B2F0C]/70 p-2 text-left sm:p-4`}
      onClick={onClose}
      data-lenis-prevent
    >
      {panel}
    </div>,
    document.body,
  );
}

/** Inline label name field: Enter saves, Esc cancels, blur saves. */
function NameInput({
  initial,
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial: string;
  placeholder?: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  return (
    <input
      autoFocus
      value={value}
      maxLength={60}
      placeholder={placeholder}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          done.current = true;
          if (value.trim()) onSubmit(value);
          else onCancel();
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          done.current = true;
          onCancel();
        }
      }}
      onBlur={() => {
        if (done.current) return;
        if (value.trim() && value.trim() !== initial) onSubmit(value);
        else onCancel();
      }}
      className="w-full rounded-lg border-2 border-[#1B2F0C] bg-white px-2 py-1 text-[13px] text-[#1B2F0C] outline-none focus:ring-2 focus:ring-[#D2FB02]"
    />
  );
}
