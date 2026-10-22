"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Image as ImageIcon } from "lucide-react";
import { AdminMediaPicker } from "@/app/components/admin/AdminMediaPicker";
import {
  isValidResourceVideoUrl,
  resourceVideoEmbedUrl,
} from "@/lib/resources";

/**
 * One editable area, like WordPress's visual editor: text flows as usual and
 * an inserted image or video appears as the media itself, not `![...](...)`.
 *
 * The stored value is still the product's tiny markdown (`\n\n` between
 * blocks), so the public page renders it with `renderInlineMarkdown`.
 */

type MediaKind = "image" | "video";

const VIDEO_FILE = /\.(mp4|webm)(?:[?#]|$)/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mediaHtml(url: string, alt = ""): string {
  const embed = resourceVideoEmbedUrl(url);
  const media = embed
    ? `<span class="admin-md-embed" data-embed-url="${escapeHtml(url)}"><iframe src="${escapeHtml(embed)}" title="${escapeHtml(alt || "Video")}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></span>`
    : VIDEO_FILE.test(url)
      ? `<video src="${escapeHtml(url)}" controls preload="metadata"></video>`
      : `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />`;
  return `<span class="admin-md-media" contenteditable="false">${media}<span class="admin-md-media-tools" contenteditable="false"><button type="button" data-media-action="replace" title="Replace" aria-label="Replace">&#8635;</button><button type="button" data-media-action="remove" title="Remove" aria-label="Remove">&#215;</button></span></span>`;
}

function inlineHtml(text: string): string {
  return text
    .split(/(!\[[^\]]*\]\([^)\s]+\)|\*\*[^*]+\*\*)/g)
    .map((part) => {
      const image = part.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (image) return mediaHtml(image[2], image[1]);
      if (part.startsWith("**") && part.endsWith("**")) {
        return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`;
      }
      return escapeHtml(part).replace(/\n/g, "<br>");
    })
    .join("");
}

function markdownToHtml(markdown: string): string {
  return markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const heading = block.match(/^##\s+(.+)$/);
      if (heading) {
        return `<h2>${inlineHtml(heading[1].trim())}</h2>`;
      }
      const media = block.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (media) {
        return `<p>${mediaHtml(media[2], media[1])}</p>`;
      }
      return `<p>${inlineHtml(block)}</p>`;
    })
    .join("");
}

function inlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";
  // The hover tools are editor chrome, not content.
  if (node.matches(".admin-md-media-tools")) return "";
  if (node.matches("img")) {
    return `![${node.getAttribute("alt") ?? ""}](${node.getAttribute("src") ?? ""})`;
  }
  if (node.matches("video")) return `![](${node.getAttribute("src") ?? ""})`;
  if (node.matches("[data-embed-url]")) {
    return `![](${node.getAttribute("data-embed-url") ?? ""})`;
  }
  if (node.matches("strong,b")) return `**${node.textContent ?? ""}**`;
  if (node.matches("br")) return "\n";
  return Array.from(node.childNodes).map(inlineMarkdown).join("");
}

function htmlToMarkdown(root: HTMLElement): string {
  const blocks: string[] = [];

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").trim();
      if (text) blocks.push(text);
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;

    if (node.matches("h1,h2,h3,h4,h5,h6")) {
      const heading = inlineMarkdown(node).trim();
      if (heading) blocks.push(`## ${heading}`);
      continue;
    }

    if (node.matches(".admin-md-media")) {
      const media = inlineMarkdown(node).trim();
      if (media) blocks.push(media);
      continue;
    }

    if (node.matches("img,video,[data-embed-url]")) {
      const media = inlineMarkdown(node).trim();
      if (media) blocks.push(media);
      continue;
    }

    // A paragraph can mix text and media; split around the media.
    const segments: string[] = [];
    let text = "";
    for (const child of Array.from(node.childNodes)) {
      const isMedia =
        child instanceof HTMLElement &&
        (child.matches("img,video,[data-embed-url],.admin-md-media") ||
          Boolean(child.querySelector("img,video,[data-embed-url]")));
      if (isMedia) {
        if (text.trim()) segments.push(text.trim());
        text = "";
        const media = inlineMarkdown(child).trim();
        if (media) segments.push(media);
      } else {
        text += inlineMarkdown(child);
      }
    }
    if (text.trim()) segments.push(text.trim());
    if (segments.length) blocks.push(...segments);
  }

  return blocks.join("\n\n");
}

export function AdminMarkdownEditor({
  value,
  onChange,
  folder = "nura/admin",
  disabled = false,
  label = "Paragraphs",
  allowHeadings = true,
}: {
  value: string;
  onChange: (markdown: string) => void;
  /** Uploads land here when no sidebar folder is selected. */
  folder?: string;
  disabled?: boolean;
  label?: string;
  /** The blog maps H2 to section headings; resources have no headings. */
  allowHeadings?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);
  const mounted = useRef(false);
  const savedRange = useRef<Range | null>(null);
  const replaceBlock = useRef<HTMLElement | null>(null);
  const [picker, setPicker] = useState<MediaKind | null>(null);
  const [videoMenu, setVideoMenu] = useState(false);
  const [videoLink, setVideoLink] = useState("");
  const [videoError, setVideoError] = useState("");

  /*
   * The editable DOM is owned by the browser, not React. Never pass
   * `dangerouslySetInnerHTML` here: a parent re-render would re-set it on
   * every keystroke and wipe the caret. Set it once on mount and only when
   * the parent changes the value from outside.
   */
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!mounted.current) {
      mounted.current = true;
      root.innerHTML = markdownToHtml(value);
      return;
    }
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    root.innerHTML = markdownToHtml(value);
  }, [value]);

  function emit() {
    const root = ref.current;
    if (!root) return;
    const markdown = htmlToMarkdown(root);
    lastEmitted.current = markdown;
    onChange(markdown);
  }

  function formatHeading() {
    const root = ref.current;
    if (!root) return;
    root.focus();
    const selection = window.getSelection();
    const node = selection?.anchorNode ?? null;
    const element =
      node?.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node?.parentElement ?? null;
    const block = element?.closest("h1,h2,h3,h4,h5,h6,p,div,li,blockquote");
    document.execCommand(
      "formatBlock",
      false,
      block?.tagName === "H2" ? "p" : "h2"
    );
    emit();
  }

  function formatBold() {
    ref.current?.focus();
    document.execCommand("bold");
    emit();
  }

  function captureCaret() {
    const selection = window.getSelection();
    savedRange.current =
      selection &&
      selection.rangeCount > 0 &&
      ref.current?.contains(selection.anchorNode)
        ? selection.getRangeAt(0).cloneRange()
        : null;
  }

  function openPicker(kind: MediaKind) {
    captureCaret();
    setPicker(kind);
  }

  function openVideoMenu() {
    captureCaret();
    setVideoError("");
    setVideoMenu((open) => !open);
  }

  function insertFromLink() {
    let raw = videoLink.trim();
    // Accept a full iframe snippet as well as a bare link.
    const iframe = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframe) raw = iframe[1];
    if (!isValidResourceVideoUrl(raw)) {
      setVideoError(
        "Use YouTube, Vimeo, Dailymotion, Loom, Streamable, or a direct .mp4/.webm link."
      );
      return;
    }
    insertMedia(raw);
    setVideoMenu(false);
    setVideoLink("");
    setVideoError("");
  }

  function insertMedia(url: string) {
    const root = ref.current;
    if (!root) return;

    const media = document.createElement("p");
    media.innerHTML = mediaHtml(url);

    const after = document.createElement("p");
    after.appendChild(document.createElement("br"));

    const range = savedRange.current;
    let block: HTMLElement | null = null;
    if (range && root.contains(range.startContainer)) {
      const start = range.startContainer;
      const element =
        start.nodeType === Node.ELEMENT_NODE
          ? (start as HTMLElement)
          : start.parentElement;
      block = element?.closest("p,div,li,blockquote") ?? null;
      // `closest` can return the editor itself (caret between blocks); never
      // insert after it, or the media lands outside the box.
      if (!block || block === root || !root.contains(block)) block = null;
    }

    if (range && block) {
      // Split the paragraph at the caret: text before stays, text after moves
      // below the media, exactly where the image lands in WordPress.
      const tail = document.createRange();
      tail.setStart(range.endContainer, range.endOffset);
      tail.setEnd(block, block.childNodes.length);
      after.textContent = "";
      after.appendChild(tail.extractContents());
      if (
        !after.textContent?.trim() &&
        !after.querySelector("img,video,[data-embed-url]")
      ) {
        after.innerHTML = "<br>";
      }
      block.after(media);
      media.after(after);
    } else {
      root.append(media, after);
    }

    root.focus();
    const caret = document.createRange();
    caret.selectNodeContents(after);
    caret.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);
    savedRange.current = null;
    emit();
  }

  return (
    <div className="admin-md">
      <div className="admin-md-tools">
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => openPicker("image")}
        >
          <ImageIcon size={14} /> Image
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={openVideoMenu}
        >
          <Film size={14} /> Video
        </button>
        {allowHeadings ? (
          <>
            <span className="admin-md-divider" aria-hidden />
            <button
              type="button"
              className="btn-secondary"
              disabled={disabled}
              title="Heading"
              onMouseDown={(event) => event.preventDefault()}
              onClick={formatHeading}
            >
              H2
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="btn-secondary admin-md-bold"
          disabled={disabled}
          title="Bold"
          onMouseDown={(event) => event.preventDefault()}
          onClick={formatBold}
        >
          B
        </button>
      </div>

      {videoMenu ? (
        <div className="admin-md-video-menu">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setVideoMenu(false);
              setPicker("video");
            }}
          >
            <Film size={14} /> Choose from Cloudinary
          </button>
          <div className="admin-md-video-link">
            <input
              className="field"
              autoFocus
              value={videoLink}
              placeholder="Paste a YouTube, Vimeo, Dailymotion, Loom, or Streamable link"
              onChange={(event) => {
                setVideoLink(event.target.value);
                setVideoError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  insertFromLink();
                }
              }}
            />
            <button
              type="button"
              className="btn-primary"
              disabled={!videoLink.trim()}
              onClick={insertFromLink}
            >
              Insert
            </button>
          </div>
          <p className="admin-panel-sub">
            An embed code works too. Direct .mp4 and .webm links play inline.
          </p>
          {videoError ? (
            <p className="admin-mcp-wizard-error" role="alert">
              {videoError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        ref={ref}
        className="admin-md-rich"
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-placeholder="Write a paragraph"
        onInput={emit}
        onBlur={emit}
        onClick={(event) => {
          const action = (event.target as HTMLElement).closest<HTMLElement>(
            "[data-media-action]"
          );
          if (action) {
            const block = action.closest<HTMLElement>(".admin-md-media");
            if (!block) return;
            event.preventDefault();
            if (action.dataset.mediaAction === "remove") {
              block.remove();
              emit();
              return;
            }
            replaceBlock.current = block;
            setPicker(
              block.querySelector("video,[data-embed-url]") ? "video" : "image"
            );
            return;
          }

          const root = ref.current;
          if (!root) return;

          // Clicking the media puts the caret on the line after it, so Enter
          // continues the article below the image.
          const mediaBlock = (event.target as HTMLElement).closest<HTMLElement>(
            ".admin-md-media"
          );
          if (mediaBlock) {
            const host = mediaBlock.closest("p") ?? mediaBlock;
            let next = host.nextElementSibling as HTMLElement | null;
            if (!next || !next.matches("p")) {
              next = document.createElement("p");
              next.appendChild(document.createElement("br"));
              host.after(next);
            }
            const range = document.createRange();
            range.setStart(next, 0);
            range.collapse(true);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            root.focus();
            return;
          }

          // Clicking the empty area below the text should start a new line,
          // not lose the caret.
          if (event.target === root) {
            const range = document.createRange();
            range.selectNodeContents(root);
            range.collapse(false);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            root.focus();
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
      />

      <AdminMediaPicker
        kind={picker ?? "image"}
        open={picker !== null}
        folder={folder}
        onClose={() => {
          replaceBlock.current = null;
          setPicker(null);
        }}
        onPick={(url) => {
          const target = replaceBlock.current;
          replaceBlock.current = null;
          if (target) {
            target.outerHTML = mediaHtml(url);
            emit();
          } else {
            insertMedia(url);
          }
          setPicker(null);
        }}
      />
    </div>
  );
}
