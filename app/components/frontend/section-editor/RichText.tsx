"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { safeHref } from "@/lib/marketing-sections";
import { parseArticle } from "@/lib/rich-article";

const TOKEN = /(\[[^\]]+\]\([^)\s]+\)|\*\*[^*\n]+\*\*)/g;

/** Renders plain text plus [label](/path) links and **bold**. Other markup stays text. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, index) => (
        <p key={index} className={className} style={{ whiteSpace: "pre-line" }}>
          {renderInline(block)}
        </p>
      ))}
    </>
  );
}

export function RichInline({ text }: { text: string }) {
  return <>{renderInline(text)}</>;
}

/**
 * Long-form text: # / ## / ### headings, "- " lists, "> " note boxes, paragraphs.
 * Renders bare elements (no wrapper) so it drops into `.frontend-legal` articles.
 */
export function RichArticle({ text }: { text: string }) {
  return (
    <>
      {parseArticle(text).map((block, index) => {
        switch (block.kind) {
          case "h1":
            return <h1 key={index}>{renderInline(block.text, true)}</h1>;
          case "h2":
            return <h2 key={index}>{renderInline(block.text, true)}</h2>;
          case "h3":
            return <h3 key={index}>{renderInline(block.text, true)}</h3>;
          case "note":
            return (
              <p key={index} className="frontend-legal-note">
                {renderInline(block.text, true)}
              </p>
            );
          case "ul":
            return (
              <ul key={index}>
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item, true)}</li>
                ))}
              </ul>
            );
          default:
            return <p key={index}>{renderInline(block.text, true)}</p>;
        }
      })}
    </>
  );
}

function renderInline(block: string, newTab = false): ReactNode[] {
  const parts = block.split(TOKEN);
  return parts.map((part, index) => {
    const bold = /^\*\*([^*\n]+)\*\*$/.exec(part);
    if (bold) {
      return <strong key={index}>{bold[1]}</strong>;
    }
    const match = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (!match) {
      return <Fragment key={index}>{part}</Fragment>;
    }
    const label = match[1] ?? "";
    const href = safeHref(match[2] ?? "", "");
    if (!href) return <Fragment key={index}>{label}</Fragment>;
    if (href.startsWith("https://") && newTab) {
      return (
        <a key={index} href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      );
    }
    if (href.startsWith("mailto:") || href.startsWith("https://") || href.startsWith("tel:")) {
      return (
        <a key={index} href={href}>
          {label}
        </a>
      );
    }
    return (
      <Link key={index} href={href}>
        {label}
      </Link>
    );
  });
}