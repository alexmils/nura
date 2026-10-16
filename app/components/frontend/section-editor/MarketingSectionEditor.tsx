"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import {
  getSectionDef,
  mediaNames,
  type Field,
  type ItemField,
  type ListField,
  type MediaFieldDef,
  type ScalarField,
  type SectionConfig,
  type SectionItem,
} from "@/lib/marketing-sections";
import { EditorLayer } from "./EditorLayer";
import { commitSectionDraft, useEditorDraft } from "./section-draft";

export function MarketingSectionEditor({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const def = getSectionDef(id);
  const [config, setConfig] = useState<SectionConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEditorDraft(id, config);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/marketing-sections/${id}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as {
          config?: SectionConfig;
          error?: string;
        } | null;
        if (!res.ok || !body?.config) {
          throw new Error(body?.error || "Could not load this section.");
        }
        if (!cancelled) setConfig(body.config);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load this section.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing-sections/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error || "Could not save.");
      commitSectionDraft(id);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (!def) return null;
  const groups = fieldGroups(def.fields);

  return (
    <EditorLayer className="fe-editor-layer" role="dialog" aria-modal="true" aria-label="Edit section">
      <div className="fe-editor-drawer" data-lenis-prevent>
        <header className="fe-editor-head">
          <h2>Edit section</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <div className="fe-editor-body">
          {!config ? (
            <p>{error ?? "Loading…"}</p>
          ) : (
            groups.map((group, index) => {
              const expanded = open[group.key] ?? index === 0;
              return (
                <section key={group.key} className="fe-editor-acc">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() =>
                      setOpen((current) => ({ ...current, [group.key]: !expanded }))
                    }
                  >
                    <ChevronDown size={16} className={expanded ? "is-open" : ""} aria-hidden />
                    {group.label}
                  </button>
                  {expanded ? (
                    <div className="fe-editor-acc-body">
                      {group.kind === "copy"
                        ? group.fields.map((field) => (
                            <ScalarControl
                              key={field.key}
                              field={field}
                              value={String(config[field.key] ?? "")}
                              onChange={(value) =>
                                setConfig((current) =>
                                  current ? { ...current, [field.key]: value } : current
                                )
                              }
                            />
                          ))
                        : null}
                      {group.kind === "media" ? (
                        <MediaControls
                          field={group.field}
                          values={config}
                          onChange={(patch) =>
                            setConfig((current) => (current ? { ...current, ...patch } : current))
                          }
                        />
                      ) : null}
                      {group.kind === "list" ? (
                        <ListEditor
                          field={group.field}
                          items={(config[group.field.key] as SectionItem[]) ?? []}
                          onChange={(items) =>
                            setConfig((current) =>
                              current ? { ...current, [group.field.key]: items } : current
                            )
                          }
                        />
                      ) : null}
                    </div>
                  ) : null}
                </section>
              );
            })
          )}
        </div>
        <footer className="fe-editor-foot">
          {error && config ? <p>{error}</p> : <span />}
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={!config || saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </footer>
      </div>
    </EditorLayer>
  );
}

type EditorGroup =
  | { key: string; label: string; kind: "copy"; fields: ScalarField[] }
  | { key: string; label: string; kind: "media"; field: MediaFieldDef }
  | { key: string; label: string; kind: "list"; field: ListField };

function fieldGroups(fields: Field[]): EditorGroup[] {
  const groups: EditorGroup[] = [];
  let copy: ScalarField[] = [];
  const flush = () => {
    if (!copy.length) return;
    groups.push({
      key: `copy-${groups.length}`,
      label: copy.length === 1 ? copy[0].label : "Copy",
      kind: "copy",
      fields: copy,
    });
    copy = [];
  };
  for (const field of fields) {
    if (field.kind === "media") {
      flush();
      groups.push({ key: field.key, label: field.label, kind: "media", field });
    } else if (field.kind === "list") {
      flush();
      groups.push({ key: field.key, label: field.label, kind: "list", field });
    } else {
      copy.push(field);
    }
  }
  flush();
  return groups;
}

function ScalarControl({
  field,
  value,
  onChange,
}: {
  field: ScalarField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.kind === "image") {
    return (
      <ImageSlot label={field.label} hint={field.hint} value={value} onChange={onChange} />
    );
  }
  return (
    <label className="fe-editor-field">
      <span>{field.label}</span>
      {field.kind === "textarea" ? (
        <textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
      {field.hint ? <small>{field.hint}</small> : null}
    </label>
  );
}

function ImageSlot({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="fe-editor-field">
      <span>{label}</span>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary upload or URL
        <img className="fe-editor-preview" src={value} alt="" />
      ) : null}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="https:// or /path" />
      <UploadButton accept="image/*" onUrl={onChange} />
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function MediaControls({
  field,
  values,
  onChange,
}: {
  field: MediaFieldDef;
  values: Record<string, string | SectionItem[]>;
  onChange: (patch: Record<string, string>) => void;
}) {
  const names = mediaNames(field.key);
  const read = (key: string) => (typeof values[key] === "string" ? values[key] : "");
  const kind = read(names.kind) === "video" ? "video" : "image";
  return (
    <div className="fe-editor-media">
      <div className="fe-editor-media-toggle" role="radiogroup" aria-label={`${field.label}: media type`}>
        {(["image", "video"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={kind === mode}
            className={kind === mode ? "is-on" : ""}
            onClick={() => onChange({ [names.kind]: mode })}
          >
            {mode === "image" ? "Image" : "Video"}
          </button>
        ))}
      </div>
      {kind === "image" ? (
        <ImageSlot
          label="Image"
          hint={field.hint}
          value={read(names.image)}
          onChange={(url) => onChange({ [names.image]: url })}
        />
      ) : (
        <>
          <div className="fe-editor-field">
            <span>Video</span>
            {read(names.video) && !read(names.video).includes("youtube") && !read(names.video).includes("vimeo") ? (
              <video className="fe-editor-preview" src={read(names.video)} muted playsInline />
            ) : null}
            <input
              value={read(names.video)}
              placeholder="MP4, WebM, YouTube, or Vimeo"
              onChange={(event) => onChange({ [names.video]: event.target.value })}
            />
            <UploadButton accept="video/mp4,video/webm" onUrl={(url) => onChange({ [names.video]: url })} />
          </div>
          <ImageSlot
            label="Poster"
            hint={field.hint}
            value={read(names.poster) || read(names.image)}
            onChange={(url) => onChange({ [names.poster]: url })}
          />
        </>
      )}
      <label className="fe-editor-field">
        <span>Alt text</span>
        <input value={read(names.alt)} onChange={(event) => onChange({ [names.alt]: event.target.value })} />
      </label>
    </div>
  );
}

function UploadButton({
  accept,
  onUrl,
}: {
  accept: string;
  onUrl: (url: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/admin/marketing-media", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !body?.url) throw new Error(body?.error || "Upload failed.");
      onUrl(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="fe-editor-upload">
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => void upload(event.target.files?.[0] ?? null)}
      />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? "Uploading…" : "Upload"}
      </button>
      {error ? <small>{error}</small> : null}
    </div>
  );
}

function ListEditor({
  field,
  items,
  onChange,
}: {
  field: ListField;
  items: SectionItem[];
  onChange: (items: SectionItem[]) => void;
}) {
  const [open, setOpen] = useState(0);

  function patch(index: number, key: string, value: string) {
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function patchItem(index: number, next: Record<string, string>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...next } : item)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    const [row] = next.splice(index, 1);
    if (!row) return;
    next.splice(target, 0, row);
    onChange(next);
    setOpen(target);
  }

  function add() {
    if (items.length >= field.max) return;
    const blank: SectionItem = {};
    for (const child of field.fields) {
      if (child.kind === "media") {
        const names = mediaNames(child.key);
        blank[names.kind] = "image";
        blank[names.image] = "";
        blank[names.video] = "";
        blank[names.poster] = "";
        blank[names.alt] = "";
      } else {
        blank[child.key] = "";
      }
    }
    onChange([...items, blank]);
    setOpen(items.length);
  }

  return (
    <div className="fe-editor-list">
      {items.map((item, index) => {
        const expanded = open === index;
        const title =
          item.nav || item.title || item.name || item.q || item.label || `${field.itemLabel} ${index + 1}`;
        return (
          <article key={item.id || index} className="fe-editor-item">
            <div className="fe-editor-item-bar">
              <button
                type="button"
                className="fe-editor-item-toggle"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? -1 : index)}
              >
                <ChevronDown size={16} className={expanded ? "is-open" : ""} aria-hidden />
                <strong>{title}</strong>
              </button>
              <div>
                <button type="button" onClick={() => move(index, -1)} aria-label="Move up">
                  Up
                </button>
                <button type="button" onClick={() => move(index, 1)} aria-label="Move down">
                  Down
                </button>
                {field.fixed ? null : (
                  <button
                    type="button"
                    onClick={() => onChange(items.filter((_, i) => i !== index))}
                    aria-label="Remove"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            {expanded
              ? field.fields.map((child) => (
                  <ItemFieldControl
                    key={child.kind === "media" ? child.key : child.key}
                    field={child}
                    item={item}
                    onPatch={(key, value) => patch(index, key, value)}
                    onPatchItem={(next) => patchItem(index, next)}
                  />
                ))
              : null}
          </article>
        );
      })}
      {field.fixed || items.length >= field.max ? null : (
        <button type="button" onClick={add}>
          Add {field.itemLabel.toLowerCase()}
        </button>
      )}
    </div>
  );
}

function ItemFieldControl({
  field,
  item,
  onPatch,
  onPatchItem,
}: {
  field: ItemField;
  item: SectionItem;
  onPatch: (key: string, value: string) => void;
  onPatchItem: (patch: Record<string, string>) => void;
}) {
  if (field.kind === "media") {
    return <MediaControls field={field} values={item} onChange={onPatchItem} />;
  }
  return (
    <ScalarControl
      field={field}
      value={item[field.key] ?? ""}
      onChange={(value) => onPatch(field.key, value)}
    />
  );
}
