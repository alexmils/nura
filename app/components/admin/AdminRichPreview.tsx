"use client";

import { BlogCta } from "@/app/components/frontend/BlogCta";
import { renderInlineMarkdown } from "@/app/components/frontend/InlineMarkdown";
import { parseBlogCta } from "@/lib/blog-cta";

/**
 * Shows what the markdown in a textarea will become on the site, so an
 * image, video, or CTA inserted at the cursor is visible as itself instead of
 * `![image](...)` in the raw text.
 *
 * Rendered only when the text contains media or a CTA; plain paragraphs stay
 * in the textarea without a duplicate block underneath.
 */
export function AdminRichPreview({ text }: { text: string }) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const hasRich = blocks.some(
    (block) => /^!\[[^\]]*\]\([^)]+\)/.test(block) || parseBlogCta(block) !== null
  );
  if (!hasRich) return null;

  return (
    <div className="admin-rich-preview">
      <span className="admin-field-label">Preview</span>
      {blocks.map((block, index) => {
        const cta = parseBlogCta(block);
        if (cta) return <BlogCta key={index} data={cta} />;
        return <div key={index}>{renderInlineMarkdown(block)}</div>;
      })}
    </div>
  );
}
