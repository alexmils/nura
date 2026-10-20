import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { balanceHtml } from "../lib/legal/balance-html";
import { loadPreparedPrivacyHtml } from "../lib/legal/privacy-html";

function balanced(html: string): boolean {
  const stack: string[] = [];
  const VOID = new Set(["br", "img", "hr", "input", "meta", "link", "wbr", "col", "source"]);
  for (const m of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
    const tag = m[2]!.toLowerCase();
    if (VOID.has(tag) || m[0].endsWith("/>")) continue;
    if (m[1]) {
      if (stack.pop() !== tag) return false;
    } else stack.push(tag);
  }
  return stack.length === 0;
}

describe("legal HTML is well-formed", () => {
  it("closes open tags, drops stray closes, keeps well-formed markup", () => {
    assert.equal(balanceHtml("<div><strong>a</div>b"), "<div><strong>a</strong></div>b");
    assert.equal(balanceHtml("<p>a</span>b</p>"), "<p>ab</p>");
    assert.equal(balanceHtml("<p>a<br>b<img src=x /></p>"), "<p>a<br>b<img src=x /></p>");
    assert.equal(balanceHtml("<em>open"), "<em>open</em>");
  });

  it("the privacy body cannot leak an open tag into the footer", () => {
    assert.ok(balanced(loadPreparedPrivacyHtml()));
  });
});
