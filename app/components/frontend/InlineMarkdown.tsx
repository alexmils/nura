import type { ReactNode } from "react";
import { isValidResourceImageUrl, resourceVideoEmbedUrl } from "@/lib/resources";

/** A bare YouTube/Vimeo link in body copy becomes an embed, not text. */
const BARE_VIDEO_URL =
  /(^|\s)(https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)\/[^\s)]+)/gi;

/**
 * The tiny markdown the product supports inside body copy: images, video
 * embeds, and bold.
 *
 * - `![alt](url)` renders an image, a <video> for .mp4/.webm, or an iframe for
 *   YouTube and Vimeo.
 * - A bare YouTube/Vimeo link is promoted to the same embed.
 * - Anything else is escaped as text through React, so a stored `javascript:`
 *   URL can never become an attribute.
 */
export function renderInlineMarkdown(
  text: string,
  imageClassName = "resource-article-img"
): ReactNode[] {
  const prepared = text.replace(
    BARE_VIDEO_URL,
    (_match, lead: string, url: string) => `${lead}![](${url})`
  );
  const parts = prepared.split(/(!\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const img = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      const src = img[2].replace(/[.,;!?]+$/, "");
      if (!isValidResourceImageUrl(src)) {
        return <span key={i}>{img[1] || "image"}</span>;
      }
      const embed = resourceVideoEmbedUrl(src);
      if (embed) {
        return (
          <span key={i} className="resource-article-embed">
            <iframe
              src={embed}
              title={img[1] || "Video"}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </span>
        );
      }
      const isVideo = /\.(mp4|webm)(?:[?#].*)?$/i.test(src);
      if (isVideo) {
        return (
          <video
            key={i}
            src={src}
            controls
            playsInline
            preload="metadata"
            className={imageClassName}
          />
        );
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt={img[1] || ""} className={imageClassName} />
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}
