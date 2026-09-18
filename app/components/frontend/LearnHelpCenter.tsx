"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  Search,
  Shield,
} from "lucide-react";
import type { ClusterTopic } from "@/lib/content-cluster";
import "./learn-help.css";

export type LearnHelpArticle = {
  slug: string;
  title: string;
  dek: string;
  topic: ClusterTopic;
  href: string;
};

export type LearnHelpPath = {
  topic: ClusterTopic;
  label: string;
  cardDek: string;
  panelTitle: string;
  panelAccent: string;
  panelDek: string;
  articles: LearnHelpArticle[];
  moreHref?: string;
  moreLabel?: string;
};

const POPULAR = [
  { label: "what is emdr", query: "what is emdr" },
  { label: "visual sets", query: "visual sets" },
  { label: "grounding", query: "grounding" },
] as const;

const CARD_ICONS = {
  understand: GraduationCap,
  practice: BookOpen,
  safety: Shield,
} as const;

const SIDE_PATHS: { href: string; label: string }[] = [
  { href: "#understand", label: "Understand EMDR" },
  { href: "#practice", label: "Practice" },
  { href: "#safety", label: "Safety" },
];

const SIDE_MORE: { href: string; label: string }[] = [
  { href: "/blog", label: "All articles" },
  { href: "/knowledge", label: "Knowledge clips" },
  { href: "/emdr", label: "How EMDR works" },
  { href: "/safety", label: "Safety guide" },
  { href: "/faq", label: "FAQ" },
];

function matchesQuery(article: LearnHelpArticle, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return (
    article.title.toLowerCase().includes(q) ||
    article.dek.toLowerCase().includes(q) ||
    article.slug.replace(/-/g, " ").includes(q)
  );
}

export function LearnHelpCenter({
  articles,
  paths,
}: {
  articles: LearnHelpArticle[];
  paths: LearnHelpPath[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [modKey, setModKey] = useState("⌘");

  useEffect(() => {
    const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    setModKey(isApple ? "⌘" : "Ctrl");
  }, []);

  const results =
    query.trim().length < 2
      ? []
      : articles.filter((a) => matchesQuery(a, query)).slice(0, 8);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      const hit = results[active];
      if (hit) {
        e.preventDefault();
        window.location.assign(hit.href);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="fe-help">
      <aside className="fe-help-sidebar" aria-label="Learn navigation">
        <button
          type="button"
          className="fe-help-side-search"
          onClick={() => {
            inputRef.current?.focus();
            setOpen(true);
          }}
        >
          <Search size={14} aria-hidden />
          <span>Search</span>
          <kbd>
            {modKey}
            {modKey === "⌘" ? "" : " "}K
          </kbd>
        </button>

        <nav className="fe-help-nav">
          <div className="fe-help-nav-group">
            <p className="fe-help-nav-label">
              <GraduationCap aria-hidden />
              Paths
            </p>
            <ul className="fe-help-nav-list">
              {SIDE_PATHS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>
                    <ChevronRight
                      className="fe-help-nav-chevron"
                      aria-hidden
                    />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="fe-help-nav-group">
            <p className="fe-help-nav-label">
              <BookOpen aria-hidden />
              More
            </p>
            <ul className="fe-help-nav-list">
              {SIDE_MORE.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>
                    <ChevronRight
                      className="fe-help-nav-chevron"
                      aria-hidden
                    />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </aside>

      <div className="fe-help-main">
        <header className="fe-help-hero">
          <Link href="/knowledge" className="fe-help-badge">
            Watch Knowledge clips
            <ChevronRight aria-hidden />
          </Link>
          <h1 className="fe-help-title">How can we help?</h1>
          <p className="fe-help-dek">
            Short guides on EMDR, sets, and staying safe.
          </p>

          <div className="fe-help-search">
            <label className="fe-help-search-field">
              <Search className="fe-help-search-icon" aria-hidden />
              <input
                ref={inputRef}
                className="fe-help-search-input"
                type="search"
                role="combobox"
                value={query}
                placeholder="Search guides"
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls={listId}
                aria-expanded={open && query.trim().length >= 2}
                aria-haspopup="listbox"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setOpen(false), 120);
                }}
                onKeyDown={onSearchKeyDown}
              />
              <kbd className="fe-help-search-kbd">
                {modKey}
                {modKey === "⌘" ? "" : " "}K
              </kbd>
            </label>

            {open && query.trim().length >= 2 ? (
              <ul
                id={listId}
                className="fe-help-results"
                role="listbox"
                aria-label="Search results"
              >
                {results.length === 0 ? (
                  <li className="fe-help-results-empty">No guides match.</li>
                ) : (
                  results.map((article, index) => (
                    <li key={article.slug} role="option" aria-selected={index === active}>
                      <Link
                        href={article.href}
                        data-active={index === active ? "true" : "false"}
                        onMouseEnter={() => setActive(index)}
                      >
                        <span className="fe-help-result-title">
                          {article.title}
                        </span>
                        <span className="fe-help-result-dek">{article.dek}</span>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>

          <div className="fe-help-popular">
            <p className="fe-help-popular-label">Popular searches:</p>
            <ul className="fe-help-popular-list">
              {POPULAR.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    className="fe-help-chip"
                    onClick={() => {
                      setQuery(item.query);
                      setOpen(true);
                      inputRef.current?.focus();
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </header>

        <div className="fe-help-cards">
          {paths.map((path) => {
            const Icon = CARD_ICONS[path.topic];
            return (
              <Link
                key={path.topic}
                href={`#${path.topic}`}
                className="fe-help-card"
              >
                <span className="fe-help-card-icon" aria-hidden>
                  <Icon strokeWidth={1.5} />
                </span>
                <h2 className="fe-help-card-title">{path.label}</h2>
                <p className="fe-help-card-dek">{path.cardDek}</p>
              </Link>
            );
          })}
        </div>

        {paths.map((path) => (
          <section
            key={path.topic}
            id={path.topic}
            className="fe-help-panel"
            aria-labelledby={`help-panel-${path.topic}`}
          >
            <div className="fe-help-panel-copy">
              <h2
                id={`help-panel-${path.topic}`}
                className="fe-help-panel-title"
              >
                {path.panelTitle}{" "}
                <em>{path.panelAccent}</em>
              </h2>
              <p className="fe-help-panel-dek">{path.panelDek}</p>
              {path.moreHref && path.moreLabel ? (
                <p className="fe-help-footer-link">
                  <Link href={path.moreHref}>{path.moreLabel}</Link>
                </p>
              ) : null}
            </div>
            <ol className="fe-help-steps">
              {path.articles.map((article, index) => (
                <li key={article.slug}>
                  <Link href={article.href}>
                    <span className="fe-help-step-num" aria-hidden>
                      {index + 1}
                    </span>
                    <span>
                      <span className="fe-help-step-title">
                        {article.title}
                      </span>
                      <span className="fe-help-step-dek">{article.dek}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}

        <p className="fe-help-footer-link">
          Full archive with dates?{" "}
          <Link href="/blog">Browse all EMDR articles</Link>
        </p>
      </div>
    </div>
  );
}
