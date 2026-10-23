"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { FrameDragPad } from "@/app/components/admin/FrameDragPad";
import { FrameEdit } from "@/app/components/admin/FrameEdit";
import { flushActiveFrameDrag, parseFrameKey, patchFramePath, readFramePath } from "@/app/components/admin/frame-drag";
import { frameKey } from "@/lib/image-position";
import { useRouter } from "next/navigation";
import { ChevronDown, RotateCcw, Undo2, X } from "lucide-react";
import {
  getSectionDef,
  BG_DECOR_KEY,
  BG_DEFAULT_OVERLAY,
  GRADIENT_DEFAULTS,
  HERO_TEMPLATE_KEY,
  fieldInTemplate,
  HIDDEN_ITEM_KEY,
  SECTION_OFF_KEY,
  mediaNames,
  type Field,
  type FieldOption,
  type ItemField,
  type ListField,
  type MediaFieldDef,
  type ScalarField,
  type SectionConfig,
  type SectionItem,
} from "@/lib/marketing-sections";
import { CloudinaryPicker } from "@/app/components/admin/CloudinaryPicker";
import { EditorLayer } from "./EditorLayer";
import { ReplaceableThumb } from "./ReplaceableThumb";
import { commitSectionDraft, setSectionDraft, useEditorDraft } from "./section-draft";
import type { EditorFocus } from "./editor-focus";
import "./editor-templates.css";

/**
 * Which section (and list item) an image belongs to, so its Edit button and
 * the photo on the page share a frame key: "<section>::<path>", where path is
 * "bgImage", "image", "mediaImage" or "<list>.<index>.<imageKey>".
 */
type FrameScope = {
  section: string;
  prefix: string;
  read: (path: string) => string;
  write: (path: string, position: unknown) => void;
};
const FrameCtx = createContext<FrameScope | null>(null);

export function MarketingSectionEditor({
  id,
  onClose,
  focus,
}: {
  id: string;
  onClose: () => void;
  /** Open on one list item (e.g. the stage the page is showing). */
  focus?: EditorFocus | null;
}) {
  const router = useRouter();
  const def = getSectionDef(id);
  const [config, setConfig] = useState<SectionConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<SectionConfig[]>([]);
  const lastEdit = useRef<{ key: string; at: number } | null>(null);
  useEditorDraft(id, config);
  const frameScope: FrameScope = {
    section: id,
    prefix: "",
    read: (path) => readFramePath(config, path),
    write: (path, position) => change(`frame:${path}`, (current) => patchFramePath(current, path, position)),
  };

  // Hero templates: only the chosen (previewed) template's own fields are shown.
  const template = String(config?.[HERO_TEMPLATE_KEY] || "default");
  const pickerFields = def ? def.fields.filter(isPicker) : [];
  const colorFields = def ? def.fields.filter(isColor) : [];
  const contentFields = def
    ? def.fields.filter((field) => !isPicker(field) && !isColor(field) && fieldInTemplate(field, template))
    : [];

  /** Applies an edit and records an undo step (typing in one field within 1s is one step). */
  function change(key: string, apply: (current: SectionConfig) => SectionConfig) {
    if (!config) return;
    const now = Date.now();
    const last = lastEdit.current;
    if (!last || last.key !== key || now - last.at > 1000) {
      setHistory((past) => [...past.slice(-79), config]);
    }
    lastEdit.current = { key, at: now };
    setConfig(apply(config));
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(history.slice(0, -1));
    lastEdit.current = null;
    setConfig(previous);
  }

  async function resetToDefault() {
    if (
      !window.confirm(
        "Reset this section to its default text and media? Saved changes for this section are removed."
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing-sections/${id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as {
        config?: SectionConfig;
        error?: string;
      } | null;
      if (!res.ok || !body?.config) throw new Error(body?.error || "Could not reset.");
      setSectionDraft(id, body.config);
      commitSectionDraft(id);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset.");
    } finally {
      setSaving(false);
    }
  }

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
    // A photo still in Edit mode keeps where it was dragged to.
    let toSave = config;
    flushActiveFrameDrag((key, position) => {
      const parsed = parseFrameKey(key);
      if (parsed?.scope === id) toSave = patchFramePath(toSave, parsed.id, position);
    });
    setSaving(true);
    setError(null);

    async function putSection() {
      const res = await fetch(`/api/admin/marketing-sections/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });
      const body = (await res.json().catch(() => null)) as {
        config?: SectionConfig;
        error?: string;
      } | null;
      if (res.ok) return body;
      const error = new Error(body?.error || "Could not save.") as Error & {
        status?: number;
      };
      error.status = res.status;
      throw error;
    }

    try {
      let body: Awaited<ReturnType<typeof putSection>> = null;
      try {
        body = await putSection();
      } catch (err) {
        const status = (err as { status?: number }).status;
        // A rolling deploy can drop one request at the gateway. Retrying a
        // PUT is safe; 4xx responses are real validation errors.
        if (status && status < 500) throw err;
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        body = await putSection();
      }
      if (!body?.config) throw new Error("The server did not confirm the save.");
      const dropped = droppedMedia(toSave, body.config);
      if (dropped.length > 0) {
        setError(
          `The server rejected the new media (${dropped.join(", ")}). Try uploading it again.`
        );
        return;
      }
      // Keep showing exactly what the server stored until the refreshed page
      // data matches it (a cached refresh must not snap back to the old copy).
      setSectionDraft(id, body.config);
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
  const split = def.name.indexOf(": ");
  const page = split > 0 ? def.name.slice(0, split) : "";
  const rawTitle = split > 0 ? def.name.slice(split + 2) : def.name;
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const on = config ? config[SECTION_OFF_KEY] !== "1" : true;

  return (
    <EditorLayer className="fe-editor-layer" role="dialog" aria-modal="true" aria-label={`Edit ${title}`}>
      <FrameCtx.Provider value={frameScope}>
      <FrameDragPad />
      <div className="fe-editor-drawer" data-lenis-prevent>
        <header className="fe-editor-head">
          <div>
            <h2>Edit {title}</h2>
            <p className="fe-editor-sub">
              {page ? `${page} \u00b7 ` : ""}
              <code>{id}</code>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <div className="fe-editor-body">
          {!config ? (
            <p>{error ?? "Loading\u2026"}</p>
          ) : (
            <>
              {def.noHide ? null : (
                <label className="fe-editor-check fe-editor-show">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(event) => {
                      const show = event.target.checked;
                      change(SECTION_OFF_KEY, (current) => {
                        const next = { ...current };
                        if (show) next[SECTION_OFF_KEY] = "0";
                        else next[SECTION_OFF_KEY] = "1";
                        return next;
                      });
                    }}
                  />
                  <span>Show this section</span>
                </label>
              )}
              {pickerFields.length ? (
                <EditorAccordion title="Layout" hint="Template and its own media." open>
                  {pickerFields.map((field) => (
                    <TemplatePicker
                      key={field.key}
                      field={field}
                      value={String(config[field.key] ?? "")}
                      onChange={(value) => change(field.key, (current) => ({ ...current, [field.key]: value }))}
                    />
                  ))}
                </EditorAccordion>
              ) : null}
              {contentFields.length ? (
                <EditorAccordion title="Content" hint="Text, media and lists." open>
                  {contentFields.map((field) => {
                    if (field.kind === "list") {
                      return (
                        <fieldset key={field.key} className="fe-editor-group">
                          <legend>{field.label}</legend>
                          <ListEditor
                            field={field}
                            focusIndex={focus?.list === field.key ? focus.index : undefined}
                            items={(config[field.key] as SectionItem[]) ?? []}
                            onChange={(items, key) =>
                              change(`${field.key}:${key}`, (current) => ({ ...current, [field.key]: items }))
                            }
                          />
                        </fieldset>
                      );
                    }
                    if (field.kind === "media") {
                      return (
                        <fieldset key={field.key} className="fe-editor-group">
                          <legend>{field.label}</legend>
                          <MediaControls
                            field={field}
                            values={config}
                            onChange={(patch) =>
                              change(`${field.key}:${Object.keys(patch).join(",")}`, (current) => ({
                                ...current,
                                ...patch,
                              }))
                            }
                          />
                        </fieldset>
                      );
                    }
                    return (
                      <ScalarControl
                        key={field.key}
                        field={field}
                        value={String(config[field.key] ?? "")}
                        onChange={(value) => change(field.key, (current) => ({ ...current, [field.key]: value }))}
                      />
                    );
                  })}
                </EditorAccordion>
              ) : null}
              <EditorAccordion title="Background" hint="Colour, image, video or gradient.">
                <BackgroundControls
                  decorations={id === "home-hero" && template === "default"}
                  values={config}
                  onChange={(patch, key) => change(`bg:${key}`, (current) => ({ ...current, ...patch }))}
                />
              </EditorAccordion>
              {colorFields.length ? (
                <EditorAccordion title="Text colours" hint="Blank keeps the design.">
                  {colorFields.map((field) => (
                    <ColorControl
                      key={field.key}
                      field={field}
                      value={String(config[field.key] ?? "")}
                      onChange={(value) => change(field.key, (current) => ({ ...current, [field.key]: value }))}
                    />
                  ))}
                </EditorAccordion>
              ) : null}
            </>
          )}
        </div>
        <footer className="fe-editor-foot">
          {error && config ? <p>{error}</p> : <span />}
          <button type="button" onClick={undo} disabled={!history.length || saving} title="Undo last change">
            <Undo2 size={14} aria-hidden /> Undo
          </button>
          <button
            type="button"
            onClick={() => void resetToDefault()}
            disabled={!config || saving}
            title="Reset this section to its default content"
          >
            <RotateCcw size={14} aria-hidden /> Reset
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={!config || saving} onClick={() => void save()}>
            {saving ? "Saving\u2026" : "Save"}
          </button>
        </footer>
      </div>
      </FrameCtx.Provider>
    </EditorLayer>
  );
}

function isPicker(field: Field): field is ScalarField {
  return field.kind !== "list" && field.kind !== "media" && Boolean(field.options?.length);
}

function isColor(field: Field): field is ScalarField {
  return field.kind !== "list" && field.kind !== "media" && Boolean(field.color);
}

/**
 * Media URLs the save response changed. A valid upload survives normalization;
 * a rejected URL comes back empty or replaced, which used to close the panel
 * and quietly show the designed image again.
 */
function droppedMedia(before: SectionConfig, after: SectionConfig): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => {
    if (!/image|video|poster/i.test(key)) return false;
    const was = before[key];
    return typeof was === "string" && was.trim() !== "" && after[key] !== was;
  });
}

/** One folded group in the drawer: a summary row and its controls. */
function EditorAccordion({
  title,
  hint,
  open = false,
  children,
}: {
  title: string;
  hint?: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="fe-editor-acc" open={open}>
      <summary>
        <span>{title}</span>
        {hint ? <small>{hint}</small> : null}
      </summary>
      <div className="fe-editor-acc-body">{children}</div>
    </details>
  );
}

/** Options in picker order, bundled by `group` (ungrouped first). */
function templateGroups(options: readonly FieldOption[]): [string, FieldOption[]][] {
  const groups = new Map<string, FieldOption[]>();
  for (const option of options) {
    const key = option.group ?? "";
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }
  return [...groups.entries()];
}

/** Compact layout picker: a dropdown plus a schematic preview of the selection. */
function TemplatePicker({
  field,
  value,
  onChange,
}: {
  field: ScalarField;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = field.options ?? [];
  const current = options.some((option) => option.value === value) ? value : options[0]?.value;
  const active = options.find((option: FieldOption) => option.value === current);
  return (
    <fieldset className="fe-editor-group fe-editor-tpl fe-editor-tpl--compact">
      <legend>{field.label}</legend>
      <div className="fe-editor-tpl-pick">
        <span className={`fe-tpl-thumb fe-tpl-thumb--${current}`} aria-hidden>
          <i className="t-media" />
          <i className="t-line t-line--1" />
          <i className="t-line t-line--2" />
          <i className="t-line t-line--3" />
          <i className="t-btn" />
          <i className="t-extra" />
        </span>
        <div className="fe-editor-tpl-pick-copy">
          <select
            aria-label={field.label}
            value={current}
            onChange={(event) => onChange(event.target.value)}
          >
            {templateGroups(options).map(([group, items]) =>
              group ? (
                <optgroup key={group} label={group}>
                  {items.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ) : (
                items.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
              )
            )}
          </select>
          {active?.hint ? <small>{active.hint}</small> : null}
        </div>
      </div>
      <small className="fe-editor-tpl-note">The page shows the picked template right away. Save keeps it; Cancel goes back. Each template keeps its own media and extras.</small>
    </fieldset>
  );
}

function ColorControl({
  field,
  value,
  onChange,
}: {
  field: ScalarField;
  value: string;
  onChange: (value: string) => void;
}) {
  const valid = /^#[0-9a-f]{6}$/i.test(value);
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  return (
    <div className="fe-editor-field fe-editor-color">
      <span>{field.label}</span>
      <div>
        <input
          type="color"
          aria-label={`${field.label}: pick`}
          value={valid ? value : "#ffffff"}
          onChange={(event) => onChange(event.target.value.toLowerCase())}
        />
        <input
          aria-label={`${field.label}: hex`}
          value={hex}
          maxLength={7}
          placeholder="As designed"
          onChange={(event) => {
            const next = event.target.value.trim();
            setHex(next);
            if (!next) onChange("");
            else if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase());
          }}
        />
        {value ? (
          <button type="button" className="fe-editor-frame-btn" onClick={() => onChange("")}>
            Clear
          </button>
        ) : null}
      </div>
      {field.hint ? <small>{field.hint}</small> : null}
    </div>
  );
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
  const [videoPicker, setVideoPicker] = useState(false);
  if (field.kind === "image") {
    return (
      <ImageSlot
        label={field.label}
        hint={field.hint}
        value={value}
        onChange={onChange}
        frameField={field.key}
        compact={field.key === "icon"}
      />
    );
  }
  return (
    <label className="fe-editor-field">
      <span>{field.label}</span>
      {field.videoPicker ? (
        <div className="fe-editor-field-row">
          <input value={value} onChange={(event) => onChange(event.target.value)} />
          <button
            type="button"
            className="fe-editor-frame-btn"
            onClick={(event) => {
              event.preventDefault();
              setVideoPicker(true);
            }}
          >
            Cloudinary
          </button>
        </div>
      ) : field.kind === "textarea" ? (
        <textarea rows={(field.max ?? 0) > 2400 ? 18 : 4} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
      {field.hint ? <small>{field.hint}</small> : null}
      {videoPicker ? (
        <CloudinaryPicker
          used={value ? [value] : []}
          mediaType="video"
          single
          current={value}
          onClose={() => setVideoPicker(false)}
          onImport={(urls) => {
            if (urls[0]) onChange(urls[0]);
            setVideoPicker(false);
          }}
        />
      ) : null}
    </label>
  );
}

function ImageSlot({
  label,
  hint,
  value,
  onChange,
  frameField,
  compact = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  /** The image's key in the section data: adds Edit (drag to move, scroll to zoom) / Done. */
  frameField?: string;
  /** Small square preview for icons instead of the compact media preview. */
  compact?: boolean;
}) {
  const scope = useContext(FrameCtx);
  const path = scope && frameField ? `${scope.prefix}${frameField}` : "";
  const stored = scope && path ? scope.read(path) : "";
  return (
    <div className={`fe-editor-field${compact ? " fe-editor-field--thumb" : ""}`}>
      <span>{label}</span>
      <ReplaceableThumb src={value} onReplace={onChange} />
      {scope && path && value ? (
        <div className="fe-editor-frame">
          <FrameEdit
            frameKey={frameKey(scope.section, path)}
            url={value}
            value={stored || undefined}
            onDone={(position) => scope.write(path, position)}
          />
          {stored ? (
            <button type="button" className="fe-editor-frame-btn" onClick={() => scope.write(path, null)}>
              Reset position
            </button>
          ) : null}
          <small>Edit, then drag the photo on the page to move it and scroll to zoom. Done keeps it.</small>
        </div>
      ) : null}
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
  const rawKind = read(names.kind);
  const kind = rawKind === "video" ? "video" : rawKind === "none" ? "none" : "image";
  // Slots with a built-in animation list it first, as "Animation" (stored as "none").
  const modes = field.defaultLabel
    ? (["none", "image", "video"] as const)
    : (["image", "video", "none"] as const);
  const noneLabel = field.defaultLabel || "None";
  return (
    <div className="fe-editor-media">
      <div className="fe-editor-media-toggle" role="radiogroup" aria-label={`${field.label}: media type`}>
        {modes.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={kind === mode}
            className={kind === mode ? "is-on" : ""}
            onClick={() => onChange({ [names.kind]: mode })}
          >
            {mode === "image" ? "Image" : mode === "video" ? "Video" : noneLabel}
          </button>
        ))}
      </div>
      {kind === "none" ? (
        <p className="fe-editor-note">
          {field.defaultLabel
            ? "Shows the built-in animation. Choose Image or Video to replace it."
            : "No media in this slot. Switch back to Image or Video to add one."}
        </p>
      ) : kind === "image" ? (
        <ImageSlot
          label="Image"
          hint={field.hint}
          value={read(names.image)}
          onChange={(url) => onChange({ [names.image]: url })}
          frameField={names.image}
        />
      ) : (
        <>
          <div className="fe-editor-field">
            <span>Video</span>
            <ReplaceableThumb
              mediaType="video"
              src={read(names.video)}
              onReplace={(url) => onChange({ [names.video]: url })}
            />
          </div>
          <label className="fe-editor-field">
            <span>Or paste a video URL</span>
            <input
              value={read(names.video)}
              placeholder="https://youtube.com/…, vimeo.com/… or .mp4"
              onChange={(event) => onChange({ [names.video]: event.target.value })}
            />
          </label>
          <ImageSlot
            label="Poster image (optional)"
            hint="Shown before the video starts and when motion is reduced."
            value={read(names.poster)}
            onChange={(url) => onChange({ [names.poster]: url })}
          />
          {field.playback ? (
            <label className="fe-editor-check">
              <input
                type="checkbox"
                checked={read(`${field.key}Autoplay`) === "1"}
                onChange={(event) =>
                  onChange({ [`${field.key}Autoplay`]: event.target.checked ? "1" : "0" })
                }
              />
              <span>Autoplay</span>
            </label>
          ) : null}
        </>
      )}
      {kind === "none" ? null : (
        <label className="fe-editor-field">
          <span>Alt text</span>
          <input value={read(names.alt)} onChange={(event) => onChange({ [names.alt]: event.target.value })} />
        </label>
      )}
    </div>
  );
}

function ListEditor({
  field,
  items,
  onChange,
  focusIndex,
}: {
  field: ListField;
  items: SectionItem[];
  onChange: (items: SectionItem[], key: string) => void;
  /** Item to open on: it stays expanded, the others start collapsed. */
  focusIndex?: number;
}) {
  function patch(index: number, key: string, value: string) {
    onChange(
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
      `${index}.${key}`
    );
  }

  function patchItem(index: number, next: Record<string, string>) {
    onChange(
      items.map((item, i) => (i === index ? { ...item, ...next } : item)),
      `${index}.${Object.keys(next).join(",")}`
    );
  }

  function duplicate(index: number) {
    const source = items[index];
    if (!source || items.length >= field.max) return;
    const copy: SectionItem = { ...source };
    delete copy.id;
    const next = items.slice();
    next.splice(index + 1, 0, copy);
    onChange(next, `dup-${Date.now()}`);
  }

  function toggleHidden(index: number) {
    const item = items[index];
    if (!item) return;
    const next: SectionItem = { ...item };
    if (next[HIDDEN_ITEM_KEY] === "1") delete next[HIDDEN_ITEM_KEY];
    else next[HIDDEN_ITEM_KEY] = "1";
    onChange(
      items.map((row, i) => (i === index ? next : row)),
      `hide-${Date.now()}`
    );
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    const [row] = next.splice(index, 1);
    if (!row) return;
    next.splice(target, 0, row);
    onChange(next, `move-${Date.now()}`);
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
    onChange([...items, blank], `add-${Date.now()}`);
  }

  const frameParent = useContext(FrameCtx);
  const itemKeyAt = (item: SectionItem, index: number) => item.id || String(index);
  const [closed, setClosed] = useState<Set<string>>(() =>
    focusIndex !== undefined && items[focusIndex]
      ? new Set(items.map(itemKeyAt).filter((_, i) => i !== focusIndex))
      : new Set()
  );
  const [flash, setFlash] = useState<number | null>(focusIndex ?? null);
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (focusIndex === undefined) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-item-index="${focusIndex}"]`);
    if (!el) return;
    const t = window.setTimeout(() => el.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
    const off = window.setTimeout(() => setFlash(null), 2400);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(off);
    };
  }, [focusIndex]);
  function toggleOpen(key: string) {
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  return (
    <div className="fe-editor-list" ref={listRef}>
      {items.map((item, index) => {
        const hidden = item[HIDDEN_ITEM_KEY] === "1";
        const itemKey = item.id || String(index);
        const open = !closed.has(itemKey);
        return (
          <article
            key={itemKey}
            data-item-index={index}
            className={`fe-editor-item${hidden ? " is-off" : ""}${flash === index ? " is-focus" : ""}`}
          >
            <div className="fe-editor-item-bar">
              <span className="fe-editor-item-title">
                <button
                  type="button"
                  className="fe-editor-item-toggle"
                  aria-expanded={open}
                  aria-label={open ? "Collapse" : "Expand"}
                  onClick={() => toggleOpen(itemKey)}
                >
                  <ChevronDown size={15} className={open ? "" : "is-closed"} aria-hidden />
                </button>
                <strong>
                  {field.itemLabel} {index + 1}
                </strong>
              </span>
              <div>
                <label className="fe-editor-check">
                  <input type="checkbox" checked={!hidden} onChange={() => toggleHidden(index)} />
                  <span>Show</span>
                </label>
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                  {"\u2191"}
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="Move down"
                >
                  {"\u2193"}
                </button>
                {field.fixed ? null : (
                  <>
                    <button
                      type="button"
                      onClick={() => duplicate(index)}
                      disabled={items.length >= field.max}
                      aria-label="Duplicate"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(items.filter((_, i) => i !== index), `rm-${Date.now()}`)}
                      aria-label="Remove"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
            {open ? (
              <FrameCtx.Provider value={frameParent ? { ...frameParent, prefix: `${field.key}.${index}.` } : null}>
                {field.fields.map((child) => (
                  <ItemFieldControl
                    key={child.key}
                    field={child}
                    item={item}
                    onPatch={(key, value) => patch(index, key, value)}
                    onPatchItem={(next) => patchItem(index, next)}
                  />
                ))}
              </FrameCtx.Provider>
            ) : null}
          </article>
        );
      })}
      {field.fixed || items.length >= field.max ? null : (
        <button type="button" className="fe-editor-add" onClick={add}>
          Add {field.itemLabel.toLowerCase()}
        </button>
      )}
    </div>
  );
}

const BG_OPTIONS = [
  { value: "", label: "Default" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "color", label: "Color" },
] as const;

/** Background for the whole section: Image, Video or Color (Default = as designed). */
function BackgroundControls({
  values,
  onChange,
  decorations = false,
}: {
  /** The section has built-in decorations (sky, sun, haze) on its Default background. */
  decorations?: boolean;
  values: SectionConfig;
  onChange: (patch: Record<string, string>, key: string) => void;
}) {
  const read = (key: string) => (typeof values[key] === "string" ? (values[key] as string) : "");
  const kind = read("bgKind");
  const color = /^#[0-9a-f]{6}$/i.test(read("bgColor")) ? read("bgColor") : "#ffffff";
  const overlay = read("bgOverlay") || String(BG_DEFAULT_OVERLAY);
  const [hex, setHex] = useState(color);
  useEffect(() => setHex(color), [color]);
  return (
    <fieldset className="fe-editor-group fe-editor-bg">
      <legend>Background</legend>
      <div className="fe-editor-media-toggle" role="radiogroup" aria-label="Background type">
        {BG_OPTIONS.map((option) => (
          <button
            key={option.value || "default"}
            type="button"
            role="radio"
            aria-checked={kind === option.value}
            className={kind === option.value ? "is-on" : ""}
            onClick={() => onChange({ bgKind: option.value }, "kind")}
          >
            {option.label}
          </button>
        ))}
      </div>
      {kind === "image" ? (
        <ImageSlot
          label="Image"
          value={read("bgImage")}
          onChange={(url) =>
            onChange(url ? { bgImage: url } : { bgImage: "", bgKind: "" }, "image")
          }
          hint="Covers the whole section."
          frameField="bgImage"
        />
      ) : null}
      {kind === "video" ? (
        <>
          <div className="fe-editor-field">
            <span>Video</span>
            <ReplaceableThumb
              mediaType="video"
              src={read("bgVideo")}
              onReplace={(url) =>
                onChange(url ? { bgVideo: url } : { bgVideo: "", bgKind: "" }, "video")
              }
            />
            <small>Plays muted, looped, behind the content.</small>
          </div>
          <ImageSlot
            label="Poster (optional)"
            value={read("bgPoster")}
            onChange={(url) => onChange({ bgPoster: url }, "poster")}
          />
        </>
      ) : null}
      {kind === "color" ? (
        <div className="fe-editor-field fe-editor-color">
          <span>Color</span>
          <div>
            <input
              type="color"
              aria-label="Pick a color"
              value={color}
              onChange={(event) => onChange({ bgColor: event.target.value }, "color")}
            />
            <input
              aria-label="Hex color"
              value={hex}
              maxLength={7}
              onChange={(event) => {
                const next = event.target.value.trim();
                setHex(next);
                if (/^#[0-9a-f]{6}$/i.test(next)) onChange({ bgColor: next.toLowerCase() }, "color");
              }}
            />
          </div>
        </div>
      ) : null}
      {kind === "image" || kind === "video" ? (
        <>
          <label className="fe-editor-field">
            <span>Overlay strength: {overlay}%</span>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={overlay}
              onChange={(event) => onChange({ bgOverlay: event.target.value }, "overlay")}
            />
          </label>
          <div className="fe-editor-media-toggle" role="radiogroup" aria-label="Overlay tone">
            {(["light", "dark"] as const).map((tone) => (
              <button
                key={tone}
                type="button"
                role="radio"
                aria-checked={(read("bgTone") || "light") === tone}
                className={(read("bgTone") || "light") === tone ? "is-on" : ""}
                onClick={() => onChange({ bgTone: tone }, "tone")}
              >
                {tone === "light" ? "Light overlay, dark text" : "Dark overlay, light text"}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {decorations && !kind ? (
        <label className="fe-editor-check">
          <input
            type="checkbox"
            checked={read(BG_DECOR_KEY) !== "off"}
            onChange={(event) => onChange({ [BG_DECOR_KEY]: event.target.checked ? "" : "off" }, "decor")}
          />
          <span>Default decorations (sky, sun, haze)</span>
        </label>
      ) : null}
      <GradientControls values={values} onChange={onChange} />
    </fieldset>
  );
}

/** Optional linear gradient (off by default): over the image/video, or as the background itself. */
function GradientControls({
  values,
  onChange,
}: {
  values: SectionConfig;
  onChange: (patch: Record<string, string>, key: string) => void;
}) {
  const read = (key: string) => (typeof values[key] === "string" ? (values[key] as string) : "");
  const on = read("gradOn") === "1";
  const hex = (key: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(read(key)) ? read(key) : fallback);
  const from = hex("gradFrom", GRADIENT_DEFAULTS.from);
  const to = hex("gradTo", GRADIENT_DEFAULTS.to);
  const angle = read("gradAngle") || String(GRADIENT_DEFAULTS.angle);
  const opacity = read("gradOpacity") || String(GRADIENT_DEFAULTS.opacity);
  const mode = read("gradMode") === "background" ? "background" : "overlay";
  // Switching on writes every value, so what you see is what is stored.
  const full = (patch: Record<string, string>) => ({
    gradOn: "1",
    gradMode: mode,
    gradFrom: from,
    gradTo: to,
    gradAngle: angle,
    gradOpacity: opacity,
    ...patch,
  });
  return (
    <div className="fe-editor-grad">
      <label className="fe-editor-check">
        <input
          type="checkbox"
          checked={on}
          onChange={(event) => onChange(event.target.checked ? full({}) : { gradOn: "0" }, "grad-on")}
        />
        <span>Gradient</span>
      </label>
      {on ? (
        <>
          <div className="fe-editor-media-toggle" role="radiogroup" aria-label="Gradient placement">
            {(
              [
                ["overlay", "Overlay on image/video"],
                ["background", "As the background"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                className={mode === value ? "is-on" : ""}
                onClick={() => onChange(full({ gradMode: value }), "grad-mode")}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="fe-editor-field fe-editor-color">
            <span>From</span>
            <div>
              <input type="color" aria-label="Gradient start colour" value={from} onChange={(e) => onChange(full({ gradFrom: e.target.value }), "grad-from")} />
              <code>{from}</code>
            </div>
          </div>
          <div className="fe-editor-field fe-editor-color">
            <span>To</span>
            <div>
              <input type="color" aria-label="Gradient end colour" value={to} onChange={(e) => onChange(full({ gradTo: e.target.value }), "grad-to")} />
              <code>{to}</code>
            </div>
          </div>
          <label className="fe-editor-field">
            <span>Direction: {angle}°</span>
            <input type="range" min={0} max={360} step={15} value={angle} onChange={(e) => onChange(full({ gradAngle: e.target.value }), "grad-angle")} />
          </label>
          <label className="fe-editor-field">
            <span>Opacity: {opacity}%</span>
            <input type="range" min={0} max={100} step={5} value={opacity} onChange={(e) => onChange(full({ gradOpacity: e.target.value }), "grad-opacity")} />
          </label>
          <div
            aria-hidden
            className="fe-editor-grad-preview"
            style={{ backgroundImage: `linear-gradient(${angle}deg, ${from}, ${to})`, opacity: Number(opacity) / 100 }}
          />
        </>
      ) : null}
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
