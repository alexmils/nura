import type { ReactNode } from "react";
import { isValidResourceImageUrl } from "@/lib/resources";

/**
 * The tiny markdown the product supports inside body copy: images and bold.
 *
 * `![alt](url)` renders an image, or a player when the URL ends in .mp4/.webm.
 * Anything else is escaped as text through React, so a stored `javascript:`
 * URL can never become an attribute.
 */
export function renderInlineMarkdown(
  text: string,
  imageClassName = "resource-article-img"
): ReactNode[] {
  const parts = text.split(/(!\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const img = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      const src = img[2];
      if (!isValidResourceImageUrl(src)) {
        return <span key={i}>{img[1] || "image"}</span>;
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
