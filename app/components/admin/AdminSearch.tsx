"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  buildAdminSearchIndex,
  filterAdminSearch,
  type AdminSearchEntry,
} from "@/lib/admin-nav";

function kindLabel(kind: AdminSearchEntry["kind"]): string {
  switch (kind) {
    case "section":
      return "Section";
    case "page":
      return "Page";
    case "tab":
      return "Tab";
    case "action":
      return "Account";
  }
}

function modKeyHint(): string {
  if (typeof navigator === "undefined") return "Ctrl K";
  const mac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  return mac ? "⌘K" : "Ctrl K";
}

export function AdminSearch({
  isPlatformAdmin,
}: {
  isPlatformAdmin: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [kbdHint, setKbdHint] = useState("Ctrl K");

  const index = useMemo(
    () => buildAdminSearchIndex(isPlatformAdmin),
    [isPlatformAdmin]
  );
  const results = useMemo(
    () => filterAdminSearch(index, query),
    [index, query]
  );

  useEffect(() => {
    setKbdHint(modKeyHint());
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(0);
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      setQuery("");
      router.push(href);
    },
    [close, router]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, close]);

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (query) {
        setQuery("");
      } else {
        close();
        inputRef.current?.blur();
      }
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[activeIndex];
      if (hit) go(hit.href);
    }
  };

  const showPanel = open;

  return (
    <div className="admin-search" ref={rootRef}>
      <label className="admin-search-field">
        <Search
          size={16}
          strokeWidth={1.75}
          className="admin-search-icon"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          className="admin-search-input"
          placeholder="Search pages and sections"
          value={query}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Search admin pages and sections"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel}
          aria-haspopup="listbox"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="admin-search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <kbd className="admin-search-kbd" aria-hidden>
            {kbdHint}
          </kbd>
        )}
      </label>

      {showPanel ? (
        <div
          id={listId}
          className="admin-search-panel"
          role="listbox"
          aria-label="Search results"
        >
          {results.length === 0 ? (
            <p className="admin-search-empty">No matching pages</p>
          ) : (
            results.map((entry, i) => (
              <Link
                key={entry.id}
                href={entry.href}
                role="option"
                aria-selected={i === activeIndex}
                className={`admin-search-result ${
                  i === activeIndex ? "admin-search-result-active" : ""
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={(e) => {
                  e.preventDefault();
                  go(entry.href);
                }}
              >
                <span className="admin-search-result-main">
                  <span className="admin-search-result-title">
                    {entry.title}
                  </span>
                  <span className="admin-search-result-group">
                    {entry.group}
                  </span>
                </span>
                <span className="admin-search-result-kind">
                  {kindLabel(entry.kind)}
                </span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
