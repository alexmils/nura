import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

/**
 * The session status block reads as one chip row with the target as a caption
 * underneath. Wrapping the chips back into the row (or letting the target sit
 * inline with them) is the regression this guards.
 */
describe("session status bar layout", () => {
  const component = readFileSync(
    join(root, "app/components/SessionStatusBar.tsx"),
    "utf8"
  );
  const css = readFileSync(join(root, "app/globals.css"), "utf8");

  it("keeps the chips in their own row wrapper", () => {
    assert.match(component, /className="session-status-chips"/);
    // Chips must live inside the wrapper, not directly in `.session-status`.
    assert.match(
      component,
      /session-status-chips[\s\S]*?session-status-chip--mode[\s\S]*?session-status-chip--phase/
    );
  });

  it("renders the target after the chip row", () => {
    const chipsAt = component.indexOf("session-status-chips");
    const targetAt = component.indexOf("session-status-target");
    assert.ok(chipsAt > -1, "chips wrapper present");
    assert.ok(targetAt > chipsAt, "target must come after the chips");
    assert.match(css, /^\.session-status-target \{/m);
  });

  /** First top-level `.selector { … }` block for an exact selector. */
  function topLevelBlock(selector: string): string {
    const start = css.search(
      new RegExp(`^\\${selector} \\{`, "m")
    );
    assert.ok(start > -1, `missing rule ${selector}`);
    const end = css.indexOf("}", start);
    return css.slice(start, end);
  }

  it("never wraps the chip row", () => {
    const block = topLevelBlock(".session-status-chips");
    assert.match(block, /flex-wrap: nowrap/);
    assert.doesNotMatch(block, /flex-wrap: wrap/);
  });

  it("stacks the status block as a column aligned to the trail edge", () => {
    const block = topLevelBlock(".session-status");
    assert.match(block, /flex-direction: column/);
    assert.match(block, /align-items: flex-end/);
  });

  it("baseline-aligns the trail so the crisis pill matches the chips", () => {
    const block = topLevelBlock(".workspace-header-trail");
    assert.match(block, /align-items: baseline/);
  });

  it("keeps a scrollable single row for the mobile header", () => {
    const mobile = css.slice(css.indexOf("@media (max-width: 767px) {"));
    assert.match(
      mobile,
      /\.workspace-header-row \.session-status-chips \{[\s\S]*?overflow-x: auto/
    );
    // The caption stays out of the compact mobile header.
    assert.match(
      mobile,
      /\.workspace-header-row \.session-status-target \{\s*display: none/
    );
  });
});
