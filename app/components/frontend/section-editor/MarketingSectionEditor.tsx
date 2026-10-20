"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Undo2, X } from "lucide-react";
import {
  getSectionDef,
  BG_DEFAULT_OVERLAY,
  GRADIENT_DEFAULTS,
  HIDDEN_ITEM_KEY,
  SECTION_OFF_KEY,
  mediaNames,
  type ItemField,
  type ListField,
  type MediaFieldDef,
  type ScalarField,
  type SectionConfig,
  type SectionItem,
} from "@/lib/marketing-sections";
import { EditorLayer } from "./EditorLayer";
import { ReplaceableThumb } from "./ReplaceableThumb";
import { commitSectionDraft, setSectionDraft, useEditorDraft } from "./section-draft";

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
  const [history, setHistory] = useState<SectionConfig[]>([]);
  const lastEdit = useRef<{ key: string; at: number } | null>(null);
  useEditorDraft(id, config);

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
  const split = def.name.indexOf(": ");
  const page = split > 0 ? def.name.slice(0, split) : "";
  const rawTitle = split > 0 ? def.name.slice(split + 2) : def.name;
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const on = config ? config[SECTION_OFF_KEY] !== "1" : true;

  return (
    <EditorLayer className="fe-editor-layer" role="dialog" aria-modal="true" aria-label={`Edit ${title}`}>
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
              <BackgroundControls
                values={config}
                onChange={(patch, key) => change(`bg:${key}`, (current) => ({ ...current, ...patch }))}
              />
              {def.fields.map((field) => {
                if (field.kind === "list") {
                  return (
                    <fieldset key={field.key} className="fe-editor-group">
                      <legend>{field.label}</legend>
                      <ListEditor
                        field={field}
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
    </EditorLayer>
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
  if (field.kind === "image") {
    return (
      <ImageSlot label={field.label} hint={field.hint} value={value} onChange={onChange} />
    );
  }
  return (
    <label className="fe-editor-field">
      <span>{field.label}</span>
      {field.kind === "textarea" ? (
        <textarea rows={(field.max ?? 0) > 2400 ? 18 : 4} value={value} onChange={(event) => onChange(event.target.value)} />
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
      <ReplaceableThumb src={value} onReplace={onChange} />
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
            <ReplaceableThumb
              mediaType="video"
              src={read(names.video)}
              onReplace={(url) => onChange({ [names.video]: url })}
            />
          </div>
          <ImageSlot
            label="Poster"
            hint={field.hint}
            value={read(names.poster)}
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

function ListEditor({
  field,
  items,
  onChange,
}: {
  field: ListField;
  items: SectionItem[];
  onChange: (items: SectionItem[], key: string) => void;
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

  return (
    <div className="fe-editor-list">
      {items.map((item, index) => {
        const hidden = item[HIDDEN_ITEM_KEY] === "1";
        return (
          <article key={item.id || index} className={hidden ? "fe-editor-item is-off" : "fe-editor-item"}>
            <div className="fe-editor-item-bar">
              <strong>
                {field.itemLabel} {index + 1}
              </strong>
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
            {field.fields.map((child) => (
              <ItemFieldControl
                key={child.key}
                field={child}
                item={item}
                onPatch={(key, value) => patch(index, key, value)}
                onPatchItem={(next) => patchItem(index, next)}
              />
            ))}
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
}: {
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
        <ImageSlot label="Image" value={read("bgImage")} onChange={(url) => onChange({ bgImage: url }, "image")} hint="Covers the whole section." />
      ) : null}
      {kind === "video" ? (
        <>
          <div className="fe-editor-field">
            <span>Video</span>
            <ReplaceableThumb mediaType="video" src={read("bgVideo")} onReplace={(url) => onChange({ bgVideo: url }, "video")} />
            <small>Plays muted, looped, behind the content.</small>
          </div>
          <ImageSlot label="Poster (optional)" value={read("bgPoster")} onChange={(url) => onChange({ bgPoster: url }, "poster")} />
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
