import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * User-facing copy never names the payment processor
 * (.cursor/rules/no-payment-processor-copy.mdc). Admin screens are exempt.
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const SCAN = [
  "app/app",
  "app/checkout",
  "app/reactivate",
  "app/pricing",
  "app/faq",
  "app/support",
  "app/components/billing",
  "app/components/checkout",
  "app/components/frontend",
  "app/components/ReactivateOfferView.tsx",
  "app/components/UpgradeModal.tsx",
  "app/api/billing",
  "app/api/reactivate",
  "lib/email",
  "lib/delete-account-shared.ts",
];

function files(p: string): string[] {
  const abs = join(ROOT, p);
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs).flatMap((n) => files(relative(ROOT, join(abs, n))));
}

/** Quoted strings and JSX text that read "Stripe" as a word. */
function processorMentions(src: string): string[] {
  const hits: string[] = [];
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    const t = line.trim();
    if (/^(\/\/|\*|\/\*|import\b)/.test(t) || /console\.(log|warn|error|info)\(/.test(t)) return;
    const strings = [
      ...line.matchAll(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/g),
    ].map((m) => m[0]);
    const jsxText = [...line.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]);
    for (const s of [...strings, ...jsxText]) {
      if (/\bStripe\b(?!\w|\(|\.\w)/.test(s) && !/^["'`]@stripe\//.test(s)) hits.push(`${i + 1}: ${t}`);
    }
  });
  return hits;
}

describe("no payment processor in user-facing copy", () => {
  it("the scanner catches a mention", () => {
    assert.equal(processorMentions(`<p>Card details are handled by Stripe.</p>`).length, 1);
    assert.equal(processorMentions(`const m = "Secure checkout by Stripe";`).length, 1);
    assert.equal(processorMentions(`import type Stripe from "stripe";`).length, 0);
    assert.equal(processorMentions(`// Stripe returns here`).length, 0);
  });
  for (const p of SCAN) {
    it(p, () => {
      for (const f of files(p).filter((x) => /\.(tsx?|mdx?)$/.test(x))) {
        assert.deepEqual(processorMentions(readFileSync(f, "utf8")), [], relative(ROOT, f));
      }
    });
  }
});
