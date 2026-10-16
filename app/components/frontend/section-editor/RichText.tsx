"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { safeHref } from "@/lib/marketing-sections";

const TOKEN = /(\[[^\]]+\]\([^)\s]+\))/g;

/** Renders plain text plus [label](/path) links. Other markup stays text. */
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

function renderInline(block: string): ReactNode[] {
  const parts = block.split(TOKEN);
  return parts.map((part, index) => {
    const match = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (!match) {
      return <Fragment key={index}>{part}</Fragment>;
    }
    const label = match[1] ?? "";
    const href = safeHref(match[2] ?? "", "");
    if (!href) return <Fragment key={index}>{label}</Fragment>;
    if (href.startsWith("mailto:") || href.startsWith("https://")) {
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
