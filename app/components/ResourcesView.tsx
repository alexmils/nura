"use client";

import { useEffect, useState, Fragment, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Clock,
  Play,
  ShieldAlert,
} from "lucide-react";
import { appPath } from "@/lib/app-base";
import {
  cssBackgroundImageUrl,
  isValidResourceImageUrl,
  resourceVideoEmbedUrl,
  type ResourceItem,
} from "@/lib/resources";
import { WorkspaceMenuButton } from "./SidebarNavContext";
import { AdDisplayUnit } from "./AdDisplayUnit";
import { CrisisHelpButton } from "./CrisisHelpButton";
import { useApp } from "./AppProvider";

function ResourceReadCard({ item }: { item: ResourceItem }) {
  return (
    <Link href={appPath(`/resources/${item.slug}`)} className="resource-read-card">
      {item.coverUrl && isValidResourceImageUrl(item.coverUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.coverUrl}
          alt=""
          className="resource-read-card-cover"
        />
      ) : null}
      <div className="resource-read-card-top">
        <span className="resource-read-card-icon" aria-hidden="true">
          <BookOpen size={18} strokeWidth={2} />
        </span>
        {item.readMinutes ? (
          <span className="resource-read-card-badge">{item.readMinutes} min</span>
        ) : null}
      </div>
      <h3 className="resource-read-card-title">{item.title}</h3>
      <p className="resource-read-card-summary">{item.summary}</p>
      <span className="resource-read-card-cta">Read article</span>
    </Link>
  );
}

function ResourceVideoCard({ item }: { item: ResourceItem }) {
  const ready = Boolean(item.videoUrl);
  const href = appPath(`/resources/${item.slug}`);
  const coverBg = item.coverUrl ? cssBackgroundImageUrl(item.coverUrl) : null;
  const inner = (
    <>
      <div
        className="resource-video-thumb"
        style={
          coverBg
            ? {
                backgroundImage: coverBg,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                background:
                  "linear-gradient(145deg, color-mix(in srgb, var(--accent) 18%, var(--bg-muted)), var(--bg-canvas))",
              }
        }
      >
        <span className="resource-video-play" aria-hidden="true">
          <Play size={18} strokeWidth={2.25} />
        </span>
        {item.readMinutes ? (
          <span className="resource-video-duration">{item.readMinutes} min</span>
        ) : null}
      </div>
      <h3 className="resource-video-title">{item.title}</h3>
      <p className="resource-video-summary">{item.summary}</p>
      {!ready ? (
        <span className="resource-video-soon">Video coming soon</span>
      ) : null}
    </>
  );

  if (!ready && !item.hasBody) {
    return (
      <article className="resource-video-card resource-video-card--soon">
        {inner}
      </article>
    );
  }

  return (
    <Link href={href} className="resource-video-card">
      {inner}
    </Link>
  );
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(!\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const img = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      const src = img[2];
      if (!isValidResourceImageUrl(src)) {
        return <span key={i}>{img[1] || "image"}</span>;
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={src}
          alt={img[1] || ""}
          className="resource-article-img"
        />
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function ResourcesLibrary() {
  const { adsConfig, adsReady } = useApp();
  const [items, setItems] = useState<ResourceItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/resources");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load resources");
          setItems([]);
          return;
        }
        setItems(data.resources ?? []);
      } catch {
        if (!cancelled) {
          setError("Could not load resources");
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const videos = (items ?? []).filter((r) => r.kind === "video");
  const articles = (items ?? []).filter((r) => r.kind === "article");
  const safety = (items ?? []).filter((r) => r.kind === "safety");

  return (
    <main className="resources-main flex min-h-0 flex-1 flex-col">
      <header className="workspace-header">
        <div className="workspace-header-row">
          <div className="workspace-header-lead">
            <WorkspaceMenuButton />
            <div className="min-w-0">
              <h1 className="workspace-title">Resources</h1>
              <p className="workspace-hint">
                Short guides to help you use sessions safely
              </p>
            </div>
          </div>
          <div className="workspace-header-trail">
            <CrisisHelpButton />
          </div>
        </div>
      </header>

      <div className="resources-scroll">
        {items === null ? (
          <p className="workspace-hint">Loading…</p>
        ) : null}
        {error ? <p className="workspace-hint">{error}</p> : null}

        {videos.length > 0 ? (
          <section className="resources-section" aria-labelledby="resources-watch">
            <h2 id="resources-watch" className="resources-section-title">
              Watch & learn
            </h2>
            <div className="resource-video-track">
              {videos.map((item) => (
                <ResourceVideoCard key={item.slug} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        {articles.length > 0 ? (
          <section className="resources-section" aria-labelledby="resources-read">
            <h2 id="resources-read" className="resources-section-title">
              Read
            </h2>
            <div className="resource-read-grid">
              {articles.map((item) => (
                <ResourceReadCard key={item.slug} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        {safety.length > 0 ? (
          <section className="resources-section" aria-labelledby="resources-safety">
            <h2 id="resources-safety" className="resources-section-title">
              Safety
            </h2>
            {safety.map((item) => (
              <Link
                key={item.slug}
                href={appPath(`/resources/${item.slug}`)}
                className="resource-safety-card"
              >
                <span className="resource-safety-icon" aria-hidden="true">
                  <ShieldAlert size={20} strokeWidth={2} />
                </span>
                <span className="resource-safety-copy">
                  <strong>{item.title}</strong>
                  <span>{item.summary}</span>
                </span>
                <ChevronRight
                  size={16}
                  strokeWidth={2}
                  className="resource-safety-arrow"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </section>
        ) : null}

        {items && items.length === 0 && !error ? (
          <p className="workspace-hint">No published resources yet.</p>
        ) : null}

        {items && items.length > 0 ? (
          <AdDisplayUnit
            config={adsConfig}
            adsReady={adsReady}
            className="ad-display-unit--resources"
          />
        ) : null}
      </div>
    </main>
  );
}

export function ResourceArticleView({ item }: { item: ResourceItem }) {
  const { adsConfig, adsReady } = useApp();
  const paragraphs = (item.body ?? "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const embed = item.videoUrl ? resourceVideoEmbedUrl(item.videoUrl) : null;
  const midIndex =
    paragraphs.length >= 4 ? Math.floor(paragraphs.length / 2) : -1;

  return (
    <main className="resources-main resources-main--article flex min-h-0 flex-1 flex-col">
      <header className="workspace-header">
        <div className="workspace-header-row">
          <div className="workspace-header-lead">
            <WorkspaceMenuButton />
            <Link href={appPath("/resources")} className="resource-back-link">
              <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />
              Resources
            </Link>
          </div>
        </div>
      </header>

      <article className="resource-article">
        <div className="resource-article-paper">
          <header className="resource-article-paper-head">
            <h1 className="resource-article-title">{item.title}</h1>
            {item.readMinutes ? (
              <p className="resource-article-meta">
                <Clock size={14} strokeWidth={2} aria-hidden="true" />
                {item.readMinutes} min read
              </p>
            ) : null}
          </header>

          {item.coverUrl && isValidResourceImageUrl(item.coverUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverUrl}
              alt=""
              className="resource-article-cover"
            />
          ) : null}

          {embed ? (
            <div className="resource-article-video">
              <iframe
                src={embed}
                title={item.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : item.videoUrl ? (
            <p className="resource-article-p">
              <a href={item.videoUrl} target="_blank" rel="noopener noreferrer">
                Open video
              </a>
            </p>
          ) : null}

          {paragraphs.map((paragraph, index) => (
            <Fragment key={index}>
              <p className="resource-article-p">
                {renderInlineMarkdown(paragraph)}
              </p>
              {index === midIndex ? (
                <AdDisplayUnit
                  config={adsConfig}
                  adsReady={adsReady}
                  className="ad-display-unit--article"
                />
              ) : null}
            </Fragment>
          ))}

          {midIndex < 0 ? (
            <AdDisplayUnit
              config={adsConfig}
              adsReady={adsReady}
              className="ad-display-unit--article"
            />
          ) : null}
        </div>
      </article>
    </main>
  );
}
