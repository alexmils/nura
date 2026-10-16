"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  getSectionDef,
  type ListField,
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
            def.fields.map((field) =>
              field.kind === "list" ? (
                <ListEditor
                  key={field.key}
                  field={field}
                  items={(config[field.key] as SectionItem[]) ?? []}
                  onChange={(items) =>
                    setConfig((current) =>
                      current ? { ...current, [field.key]: items } : current
                    )
                  }
                />
              ) : (
                <label key={field.key} className="fe-editor-field">
                  <span>{field.label}</span>
                  {field.kind === "textarea" ? (
                    <textarea
                      rows={4}
                      value={String(config[field.key] ?? "")}
                      onChange={(event) =>
                        setConfig((current) =>
                          current ? { ...current, [field.key]: event.target.value } : current
                        )
                      }
                    />
                  ) : (
                    <input
                      value={String(config[field.key] ?? "")}
                      onChange={(event) =>
                        setConfig((current) =>
                          current ? { ...current, [field.key]: event.target.value } : current
                        )
                      }
                    />
                  )}
                  {field.hint ? <small>{field.hint}</small> : null}
                </label>
              )
            )
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

function ListEditor({
  field,
  items,
  onChange,
}: {
  field: ListField;
  items: SectionItem[];
  onChange: (items: SectionItem[]) => void;
}) {
  function patch(index: number, key: string, value: string) {
    const next = items.map((item, i) => (i === index ? { ...item, [key]: value } : item));
    onChange(next);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    const [row] = next.splice(index, 1);
    if (!row) return;
    next.splice(target, 0, row);
    onChange(next);
  }

  function add() {
    if (items.length >= field.max) return;
    const blank: SectionItem = {};
    for (const child of field.fields) blank[child.key] = "";
    onChange([...items, blank]);
  }

  return (
    <fieldset className="fe-editor-list">
      <legend>{field.label}</legend>
      {items.map((item, index) => (
        <div key={item.id || index} className="fe-editor-item">
          <div className="fe-editor-item-bar">
            <strong>
              {field.itemLabel} {index + 1}
            </strong>
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
          {field.fields.map((child) => (
            <label key={child.key} className="fe-editor-field">
              <span>{child.label}</span>
              {child.kind === "textarea" ? (
                <textarea
                  rows={3}
                  value={item[child.key] ?? ""}
                  onChange={(event) => patch(index, child.key, event.target.value)}
                />
              ) : (
                <input
                  value={item[child.key] ?? ""}
                  onChange={(event) => patch(index, child.key, event.target.value)}
                />
              )}
              {child.hint ? <small>{child.hint}</small> : null}
            </label>
          ))}
        </div>
      ))}
      {field.fixed || items.length >= field.max ? null : (
        <button type="button" onClick={add}>
          Add {field.itemLabel.toLowerCase()}
        </button>
      )}
    </fieldset>
  );
}
