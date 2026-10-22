"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Image as ImageIcon, Repeat, Trash2 } from "lucide-react";
import { AdminMediaPicker } from "@/app/components/admin/AdminMediaPicker";

/**
 * Paragraph editor for the product's tiny markdown: text blocks you type in,
 * and media blocks shown as a small card instead of `![image](...)`.
 *
 * The stored value stays plain markdown (`\n\n` between blocks), so the site
 * renders it with `renderInlineMarkdown` unchanged.
 */

type MediaKind = "image" | "video";

type TextBlock = { id: string; kind: "text"; value: string };
type MediaBlock = { id: string; kind: "media"; media: MediaKind; alt: string; url: string };
type Block = TextBlock | MediaBlock;

const MEDIA_BLOCK = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const VIDEO_FILE = /\.(mp4|webm)(?:[?#]|$)/i;
const VIDEO_HOST = /^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)\//i;

let seq = 0;
function nextId(): string {
  seq += 1;
  return `md-${seq}`;
}

function kindOf(url: string): MediaKind {
  return VIDEO_FILE.test(url) || VIDEO_HOST.test(url) ? "video" : "image";
}

function altFromUrl(url: string): string {
  const name = url.split("/").pop()?.split("?")[0] ?? "";
  return name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 80);
}

function parse(value: string): Block[] {
  const parts = value
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const blocks: Block[] = parts.map((part) => {
    const match = part.match(MEDIA_BLOCK);
    if (match) {
      return { id: nextId(), kind: "media", media: kindOf(match[2]), alt: match[1], url: match[2] };
    }
    return { id: nextId(), kind: "text", value: part };
  });
  // Always leave a text block to type into.
  if (blocks.length === 0 || blocks[blocks.length - 1]?.kind !== "text") {
    blocks.push({ id: nextId(), kind: "text", value: "" });
  }
  return blocks;
}

function serialize(blocks: Block[]): string {
  return blocks
    .map((block) =>
      block.kind === "media" ? `![${block.alt}](${block.url})` : block.value.trim()
    )
    .filter(Boolean)
    .join("\n\n");
}

export function AdminMarkdownEditor({
  value,
  onChange,
  folder = "nura/admin",
  disabled = false,
  label = "Paragraphs",
}: {
  value: string;
  onChange: (markdown: string) => void;
  /** Uploads land here when no sidebar folder is selected. */
  folder?: string;
  disabled?: boolean;
  label?: string;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => parse(value));
  const [picker, setPicker] = useState<{ kind: MediaKind; replaceId?: string } | null>(null);
  const lastEmitted = useRef(value);
  const activeId = useRef<string | null>(null);
  const caret = useRef<{ id: string; pos: number } | null>(null);
  const textRefs = useRef(new Map<string, HTMLTextAreaElement>());

  // External changes (loading a post, router refresh) replace the blocks.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setBlocks(parse(value));
  }, [value]);

  function commit(next: Block[], focusId?: string) {
    setBlocks(next);
    const markdown = serialize(next);
    lastEmitted.current = markdown;
    onChange(markdown);
    if (focusId) {
      requestAnimationFrame(() => {
        const el = textRefs.current.get(focusId);
        if (!el) return;
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
      });
    }
  }

  function setText(id: string, next: string) {
    commit(
      blocks.map((block) =>
        block.id === id && block.kind === "text" ? { ...block, value: next } : block
      )
    );
  }

  function insertMedia(url: string, kind: MediaKind) {
    const media: MediaBlock = {
      id: nextId(),
      kind: "media",
      media: kind,
      alt: altFromUrl(url),
      url,
    };

    // Insert at the caret when the last focus was in a text block.
    const spot = caret.current;
    const index = spot ? blocks.findIndex((block) => block.id === spot.id) : -1;
    if (index >= 0) {
      const block = blocks[index];
      if (block?.kind === "text") {
        const pos = Math.min(spot?.pos ?? block.value.length, block.value.length);
        const before = block.value.slice(0, pos).trim();
        const after = block.value.slice(pos).trim();
        const next: Block[] = [...blocks.slice(0, index)];
        if (before) next.push({ id: block.id, kind: "text", value: before });
        next.push(media);
        const afterId = nextId();
        next.push({ id: afterId, kind: "text", value: after });
        next.push(...blocks.slice(index + 1));
        commit(next, afterId);
        return;
      }
    }

    // Otherwise after the active block, or at the end.
    const activeIndex = blocks.findIndex((block) => block.id === activeId.current);
    const at = activeIndex >= 0 ? activeIndex + 1 : blocks.length;
    const next = [...blocks.slice(0, at), media, ...blocks.slice(at)];
    if (next[next.length - 1]?.kind !== "text") {
      next.push({ id: nextId(), kind: "text", value: "" });
    }
    commit(next);
  }

  function replaceMedia(id: string, url: string) {
    commit(
      blocks.map((block) =>
        block.id === id && block.kind === "media"
          ? { ...block, url, media: kindOf(url), alt: altFromUrl(url) }
          : block
      )
    );
  }

  function removeBlock(id: string) {
    const next = blocks.filter((block) => block.id !== id);
    if (next.length === 0) next.push({ id: nextId(), kind: "text", value: "" });
    if (next[next.length - 1]?.kind !== "text") {
      next.push({ id: nextId(), kind: "text", value: "" });
    }
    commit(next);
  }

  return (
    <div className="admin-md">
      <span className="admin-field-label">{label}</span>

      <div className="admin-md-tools">
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled}
          onClick={() => setPicker({ kind: "image" })}
        >
          <ImageIcon size={14} /> Image
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled}
          onClick={() => setPicker({ kind: "video" })}
        >
          <Film size={14} /> Video
        </button>
        <span className="admin-panel-sub">Inserted where the cursor is.</span>
      </div>

      <div className="admin-md-blocks">
        {blocks.map((block, blockIndex) =>
          block.kind === "text" ? (
            <textarea
              key={block.id}
              ref={(el) => {
                if (el) textRefs.current.set(block.id, el);
                else textRefs.current.delete(block.id);
              }}
              className="field admin-md-text"
              rows={Math.min(10, Math.max(2, block.value.split("\n").length + 1))}
              value={block.value}
              disabled={disabled}
              aria-label={`${label} block ${blockIndex + 1}`}
              placeholder="Write a paragraph"
              onFocus={() => {
                activeId.current = block.id;
                caret.current = { id: block.id, pos: block.value.length };
              }}
              onSelect={(event) => {
                const el = event.currentTarget;
                caret.current = { id: block.id, pos: el.selectionStart };
              }}
              onChange={(event) => setText(block.id, event.target.value)}
            />
          ) : (
            <div key={block.id} className="admin-md-media">
              <span className="admin-md-thumb" aria-hidden>
                {block.media === "video" ? (
                  VIDEO_FILE.test(block.url) ? (
                    <video src={block.url} muted preload="metadata" />
                  ) : (
                    <Film size={22} />
                  )
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={block.url} alt="" loading="lazy" />
                )}
              </span>
              <span className="admin-md-meta">
                <span className="admin-md-name">{block.alt || "media"}</span>
                <span className="admin-md-kind">{block.media}</span>
              </span>
              <span className="admin-md-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={disabled}
                  onClick={() => setPicker({ kind: block.media, replaceId: block.id })}
                >
                  <Repeat size={14} /> Replace
                </button>
                <button
                  type="button"
                  className="btn-ghost is-danger"
                  disabled={disabled}
                  onClick={() => removeBlock(block.id)}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </span>
            </div>
          )
        )}
      </div>

      <AdminMediaPicker
        kind={picker?.kind ?? "image"}
        open={picker !== null}
        folder={folder}
        onClose={() => setPicker(null)}
        onPick={(url) => {
          if (!picker) return;
          if (picker.replaceId) replaceMedia(picker.replaceId, url);
          else insertMedia(url, picker.kind);
          setPicker(null);
        }}
      />
    </div>
  );
}
