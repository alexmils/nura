"use client";

import { useCallback, useRef, useState } from "react";
import { unzipSync } from "fflate";
import {
  IMPORT_MAX_NOTES,
  parseImportText,
  pickConversationsJsonFromZip,
  setNameForImportSource,
  type ImportCandidate,
  type ImportSource,
} from "@/lib/memory-import";

type Props = {
  onImported: () => void | Promise<void>;
  toast: (message: string, tone?: "success" | "error") => void;
};

export function MemoryImportDropzone({ onImported, toast }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [source, setSource] = useState<ImportSource | null>(null);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const clearPreview = () => {
    setSource(null);
    setCandidates([]);
    setSelected(new Set());
  };

  const scanFile = useCallback(
    async (file: File) => {
      setScanning(true);
      clearPreview();
      try {
        const lower = file.name.toLowerCase();
        let text: string;
        let label = file.name;

        if (lower.endsWith(".zip")) {
          const buf = new Uint8Array(await file.arrayBuffer());
          const files = unzipSync(buf);
          const picked = pickConversationsJsonFromZip(files);
          if (!picked) {
            throw new Error(
              "This file isn’t a ChatGPT or Claude export we recognize."
            );
          }
          text = picked.text;
          label = picked.fileName;
        } else {
          text = await file.text();
        }

        const parsed = parseImportText(label, text);
        if (!parsed.candidates.length) {
          throw new Error(
            "This file isn’t a ChatGPT or Claude export we recognize."
          );
        }
        setSource(parsed.source);
        setCandidates(parsed.candidates);
        const initial = new Set(
          parsed.candidates.slice(0, IMPORT_MAX_NOTES).map((c) => c.id)
        );
        setSelected(initial);
      } catch (err) {
        toast(
          err instanceof Error
            ? err.message
            : "This file isn’t a ChatGPT or Claude export we recognize.",
          "error"
        );
      } finally {
        setScanning(false);
      }
    },
    [toast]
  );

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await scanFile(file);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(
      new Set(candidates.slice(0, IMPORT_MAX_NOTES).map((c) => c.id))
    );
  };

  const importSelected = async () => {
    if (!source || selected.size === 0) return;
    if (selected.size > IMPORT_MAX_NOTES) {
      toast("Import up to 40 at a time. Deselect some, then try again.", "error");
      return;
    }
    setImporting(true);
    try {
      const notes = candidates
        .filter((c) => selected.has(c.id))
        .map((c) => ({ title: c.title, body: c.body }));
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_memories",
          notes,
        }),
      });
      const data = (await res.json()) as { error?: string; imported?: number };
      if (!res.ok) throw new Error(data.error || "Could not import");
      toast(`Imported ${data.imported ?? notes.length} notes`);
      clearPreview();
      await onImported();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not import", "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="settings-row space-y-3">
      <div
        role="button"
        tabIndex={0}
        className={`memory-import-drop ${dragging ? "memory-import-drop-active" : ""}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => void onDrop(e)}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <p className="settings-body-text">
          {scanning
            ? "Scanning…"
            : dragging
              ? "Drop to scan — nothing is saved until you choose."
              : "Drop a ChatGPT or Claude export here (.json or .zip), or a plain text note."}
        </p>
        <p className="settings-help mt-1.5">
          We read the file in your browser. Only the notes you select are saved
          to Nura.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".json,.zip,.txt,.md,application/json,application/zip,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void scanFile(file);
          }}
        />
      </div>

      {candidates.length > 0 && source && (
        <div className="space-y-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="settings-body-text">Choose what to import</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={selectAll}
            >
              Select all
            </button>
          </div>
          <ul className="max-h-56 space-y-2.5 overflow-y-auto">
            {candidates.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-start gap-2.5 settings-body-text">
                  <input
                    type="checkbox"
                    className="mt-1 size-4"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{c.title}</span>
                    <span className="settings-muted mt-0.5 block">
                      {c.bodyPreview}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {candidates.length > IMPORT_MAX_NOTES && (
            <p className="settings-help">
              Import up to 40 at a time. Deselect some, then try again.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={importing || selected.size === 0}
              onClick={() => void importSelected()}
            >
              {importing
                ? "Importing…"
                : `Import ${selected.size} note${selected.size === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={importing}
              onClick={clearPreview}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
