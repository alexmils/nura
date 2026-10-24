"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  RotateCcw,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  CUSTOM_SECTION_TEMPLATES,
  CUSTOM_SECTION_TYPES,
  customSectionType,
  getSectionDef,
  isCodeSectionId,
  isCustomSectionId,
  newCustomSectionId,
  normalizeSection,
  sectionText,
  SECTION_OFF_KEY,
  type CustomSectionType,
  type SectionConfig,
} from "@/lib/marketing-sections";
import {
  layoutDraftId,
  MARKETING_PAGES,
  MAX_CUSTOM_SECTIONS_PER_PAGE,
  slotIsEditable,
  slotLabel,
  type LayoutEntry,
  type MarketingPageId,
} from "@/lib/marketing-layout";
import { EditorLayer } from "./EditorLayer";
import { MarketingSectionEditor } from "./MarketingSectionEditor";
import { useMarketingCopyMap, useSavedPageLayout, useSectionConfig } from "./MarketingCopy";
import {
  clearSectionDraft,
  commitSectionDraft,
  getSectionDraft,
  setSectionDraft,
  useEditorDraft,
} from "./section-draft";

const DRAG_TYPE = "application/x-nura-layout-index";

function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [row] = next.splice(from, 1);
  if (row === undefined) return list;
  next.splice(to, 0, row);
  return next;
}

export function PageLayoutEditor({
  page,
  onClose,
}: {
  page: MarketingPageId;
  onClose: () => void;
}) {
  const router = useRouter();
  const saved = useSavedPageLayout(page);
  const copyMap = useMarketingCopyMap();
  const [entries, setEntries] = useState<LayoutEntry[]>(() =>
    saved.sections.map((entry) => ({ ...entry }))
  );
  const [history, setHistory] = useState<LayoutEntry[][]>([]);
  const [seeds, setSeeds] = useState<Record<string, SectionConfig>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [addType, setAddType] = useState<CustomSectionType>("text");
  const [addAfter, setAddAfter] = useState<string>("__end");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const seedIds = useRef<string[]>([]);

  const draft = useMemo(() => ({ sections: entries }), [entries]);
  useEditorDraft(layoutDraftId(page), draft);

  useEffect(() => {
    seedIds.current = Object.keys(seeds);
    for (const [id, config] of Object.entries(seeds)) setSectionDraft(id, config);
  }, [seeds]);

  useEffect(
    () => () => {
      if (!done.current) for (const id of seedIds.current) clearSectionDraft(id);
    },
    []
  );

  useEffect(() => {
    if (editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, onClose]);

  const customCount = entries.filter((entry) => isCustomSectionId(entry.id)).length;
  const dirty = history.length > 0;

  function update(next: LayoutEntry[]) {
    setHistory((past) => [...past.slice(-49), entries]);
    setEntries(next);
    setError(null);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(history.slice(0, -1));
    setEntries(previous);
  }

  /** A built-in section is effectively off when its own switch is off too. */
  function offFor(id: string): boolean {
    return (
      !isCustomSectionId(id) &&
      slotIsEditable(id) &&
      sourceConfig(id)[SECTION_OFF_KEY] === "1"
    );
  }

  /**
   * One eye controls the whole card: hiding sets the layout flag and the
   * section's own "Show this section" switch, so the copy and the layout can
   * never disagree.
   */
  function toggle(index: number) {
    const entry = entries[index];
    if (!entry) return;
    const nextHidden = !(entry.hidden || offFor(entry.id));
    if (!isCustomSectionId(entry.id) && slotIsEditable(entry.id)) {
      const seeded: SectionConfig = {
        ...sourceConfig(entry.id),
        [SECTION_OFF_KEY]: nextHidden ? "1" : "0",
      };
      setSeeds((current) => ({ ...current, [entry.id]: seeded }));
      setSectionDraft(entry.id, seeded);
      if (!seedIds.current.includes(entry.id)) seedIds.current.push(entry.id);
    }
    update(
      entries.map((item, i) =>
        i === index
          ? nextHidden
            ? { id: item.id, hidden: true }
            : { id: item.id }
          : item
      )
    );
  }

  function insertAt(index: number, entry: LayoutEntry) {
    const next = entries.slice();
    next.splice(index, 0, entry);
    update(next);
  }

  function addSection() {
    if (customCount >= MAX_CUSTOM_SECTIONS_PER_PAGE) {
      setError(`A page can hold up to ${MAX_CUSTOM_SECTIONS_PER_PAGE} added sections.`);
      return;
    }
    const id = newCustomSectionId(addType);
    const after = entries.findIndex((entry) => entry.id === addAfter);
    insertAt(after >= 0 ? after + 1 : entries.length, { id });
  }

  function sourceConfig(id: string): SectionConfig {
    return (
      seeds[id] ??
      getSectionDraft<SectionConfig>(id) ??
      copyMap[id] ??
      normalizeSection(id, null)
    );
  }

  function duplicate(index: number) {
    const entry = entries[index];
    const type = entry ? customSectionType(entry.id) : null;
    if (!entry || !type) return;
    if (customCount >= MAX_CUSTOM_SECTIONS_PER_PAGE) {
      setError(`A page can hold up to ${MAX_CUSTOM_SECTIONS_PER_PAGE} added sections.`);
      return;
    }
    const id = newCustomSectionId(type);
    setSeeds((current) => ({ ...current, [id]: structuredClone(sourceConfig(entry.id)) }));
    insertAt(index + 1, { id, hidden: entry.hidden });
  }

  function remove(index: number) {
    const entry = entries[index];
    if (!entry || !isCustomSectionId(entry.id) || isCodeSectionId(entry.id)) return;
    if (!window.confirm("Delete this added section? Its text is removed when you save.")) return;
    update(entries.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const live = new Set(entries.map((entry) => entry.id));
      const keptSeeds = Object.fromEntries(
        Object.entries(seeds).filter(([id]) => live.has(id))
      );
      const res = await fetch(`/api/admin/marketing-layout/${page}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: entries, seeds: keptSeeds }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error || "Could not save the layout.");
      done.current = true;
      commitSectionDraft(layoutDraftId(page));
      for (const id of Object.keys(keptSeeds)) commitSectionDraft(id);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the layout.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (
      !window.confirm(
        "Reset this page to the default order with every section shown? Added sections on this page are deleted."
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing-layout/${page}`, { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        layout?: { sections: LayoutEntry[] };
      } | null;
      if (!res.ok || !body?.layout) throw new Error(body?.error || "Could not reset the layout.");
      done.current = true;
      setEntries(body.layout.sections);
      setSectionDraft(layoutDraftId(page), { sections: body.layout.sections });
      commitSectionDraft(layoutDraftId(page));
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the layout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <EditorLayer
        className="fe-editor-layer"
        role="dialog"
        aria-modal="true"
        aria-label="Page layout"
      >
        <div className="fe-editor-drawer" data-lenis-prevent>
          <header className="fe-editor-head">
            <h2>Page layout {"\u00b7"} {MARKETING_PAGES[page].label}</h2>
            <button type="button" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </header>
          <div className="fe-editor-body">
            <p className="fe-layout-help">
              Drag or use the arrows to reorder. The eye hides or shows the whole section —
              including its own &ldquo;Show this section&rdquo; switch — and the page preview follows
              live. Nothing is public until you save.
            </p>
            <ol className="fe-layout-list">
              {entries.map((entry, index) => {
                const custom = isCustomSectionId(entry.id);
                const editable = custom || slotIsEditable(entry.id);
                const off = offFor(entry.id);
                const hiddenNow = entry.hidden || off;
                const unsavedCopy = custom && Boolean(seeds[entry.id]);
                return (
                  <li
                    key={entry.id}
                    className={`fe-layout-row${hiddenNow ? " is-hidden" : ""}${
                      dragFrom === index ? " is-dragging" : ""
                    }`}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(DRAG_TYPE, String(index));
                      event.dataTransfer.effectAllowed = "move";
                      setDragFrom(index);
                    }}
                    onDragEnd={() => setDragFrom(null)}
                    onDragOver={(event) => {
                      if (event.dataTransfer.types.includes(DRAG_TYPE)) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const from = Number(event.dataTransfer.getData(DRAG_TYPE));
                      setDragFrom(null);
                      if (Number.isInteger(from)) update(moveItem(entries, from, index));
                    }}
                  >
                    <span className="fe-layout-grip" aria-hidden>
                      <GripVertical size={16} />
                    </span>
                    <div className="fe-layout-name">
                      {custom ? (
                        <CustomRowName id={entry.id} />
                      ) : (
                        <strong>{slotLabel(page, entry.id)}</strong>
                      )}
                      <code>{entry.id}</code>
                      {hiddenNow ? <em>Hidden</em> : null}
                    </div>
                    <div className="fe-layout-actions">
                      <button
                        type="button"
                        onClick={() => update(moveItem(entries, index, index - 1))}
                        disabled={index === 0}
                        aria-label="Move up"
                        title="Move up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => update(moveItem(entries, index, index + 1))}
                        disabled={index === entries.length - 1}
                        aria-label="Move down"
                        title="Move down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(index)}
                        aria-pressed={!hiddenNow}
                        aria-label={hiddenNow ? "Show section" : "Hide section"}
                        title={hiddenNow ? "Show" : "Hide"}
                      >
                        {hiddenNow ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => setEditing(entry.id)}
                          disabled={unsavedCopy}
                          aria-label="Edit content"
                          title={unsavedCopy ? "Save the layout first to edit this copy" : "Edit content"}
                        >
                          <Pencil size={14} />
                        </button>
                      ) : null}
                      {custom ? (
                        <>
                          <button
                            type="button"
                            onClick={() => duplicate(index)}
                            aria-label="Duplicate section"
                            title="Duplicate"
                          >
                            <Copy size={14} />
                          </button>
                          {/* Code-defined sections can be hidden, not deleted. */}
                          {isCodeSectionId(entry.id) ? null : (
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              aria-label="Delete section"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>

            <section className="fe-layout-add" aria-label="Add a section">
              <h3>Add a section</h3>
              <label className="fe-editor-field">
                <span>Type</span>
                <select
                  value={addType}
                  onChange={(event) => setAddType(event.target.value as CustomSectionType)}
                >
                  {CUSTOM_SECTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CUSTOM_SECTION_TEMPLATES[type].label}
                    </option>
                  ))}
                </select>
                <small>{CUSTOM_SECTION_TEMPLATES[addType].description}</small>
              </label>
              <label className="fe-editor-field">
                <span>Position</span>
                <select value={addAfter} onChange={(event) => setAddAfter(event.target.value)}>
                  <option value="__end">At the end</option>
                  {entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      After: {isCustomSectionId(entry.id) ? entry.id : slotLabel(page, entry.id)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="fe-layout-add-btn" onClick={addSection}>
                Add section
              </button>
            </section>
          </div>
          <footer className="fe-editor-foot">
            {error ? <p>{error}</p> : <span />}
            <button type="button" onClick={undo} disabled={!dirty || saving} title="Undo last change">
              <Undo2 size={14} aria-hidden /> Undo
            </button>
            <button type="button" onClick={() => void reset()} disabled={saving} title="Reset to default">
              <RotateCcw size={14} aria-hidden /> Reset
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving\u2026" : "Save layout"}
            </button>
          </footer>
        </div>
      </EditorLayer>
      {editing ? (
        <MarketingSectionEditor id={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}

function CustomRowName({ id }: { id: string }) {
  const copy = useSectionConfig(id);
  const type = customSectionType(id);
  const label = isCodeSectionId(id)
    ? getSectionDef(id)?.name ?? id
    : type
      ? CUSTOM_SECTION_TEMPLATES[type].label
      : "Added section";
  const title = sectionText(copy, "title");
  return (
    <strong>
      {label}
      {title ? `: ${title}` : ""}
    </strong>
  );
}