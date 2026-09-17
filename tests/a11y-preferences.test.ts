import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  A11Y_ATTRIBUTES,
  A11Y_FAB_SIZE,
  A11Y_TEXT_STEPS,
  DEFAULT_A11Y_PREFERENCES,
  a11yAttributeValues,
  a11yBootstrapScript,
  activeA11yCount,
  clampA11yFabPosition,
  isA11yReduceMotionPreferred,
  isDefaultA11yPreferences,
  parseA11yFabPosition,
  parseA11yPreferences,
} from "../lib/a11y-preferences.ts";

describe("accessibility preferences", () => {
  it("defaults to the shipped look", () => {
    const prefs = parseA11yPreferences(null);
    assert.deepEqual(prefs, DEFAULT_A11Y_PREFERENCES);
    assert.equal(prefs.textSize, 0);
    assert.equal(isDefaultA11yPreferences(prefs), true);
    assert.equal(activeA11yCount(prefs), 0);
  });

  it("survives malformed storage", () => {
    assert.deepEqual(parseA11yPreferences("{not json"), DEFAULT_A11Y_PREFERENCES);
    assert.deepEqual(parseA11yPreferences("42"), DEFAULT_A11Y_PREFERENCES);
    assert.deepEqual(
      parseA11yPreferences(JSON.stringify({ textSize: "big", highContrast: "yes" })),
      DEFAULT_A11Y_PREFERENCES
    );
  });

  it("clamps text size into the available steps", () => {
    const max = A11Y_TEXT_STEPS.length - 1;
    assert.equal(parseA11yPreferences({ textSize: 99 }).textSize, max);
    assert.equal(parseA11yPreferences({ textSize: -4 }).textSize, 0);
    assert.equal(parseA11yPreferences({ textSize: 2.4 }).textSize, 2);
  });

  it("reads a full customised set", () => {
    const prefs = parseA11yPreferences({
      textSize: 3,
      highContrast: true,
      largeTargets: true,
      readableSpacing: true,
      underlineLinks: true,
      reduceMotion: true,
    });
    assert.equal(prefs.textSize, 3);
    assert.equal(isDefaultA11yPreferences(prefs), false);
    assert.equal(activeA11yCount(prefs), 6);
  });

  it("maps preferences to html attributes and clears them at default", () => {
    const values = a11yAttributeValues(DEFAULT_A11Y_PREFERENCES);
    for (const name of Object.values(A11Y_ATTRIBUTES)) {
      assert.equal(values[name], null, name);
    }
    const custom = a11yAttributeValues({
      textSize: 2,
      highContrast: true,
      largeTargets: true,
      readableSpacing: true,
      underlineLinks: true,
      reduceMotion: true,
    });
    assert.equal(custom[A11Y_ATTRIBUTES.textSize], "2");
    assert.equal(custom[A11Y_ATTRIBUTES.highContrast], "high");
    assert.equal(custom[A11Y_ATTRIBUTES.largeTargets], "large");
    assert.equal(custom[A11Y_ATTRIBUTES.readableSpacing], "on");
    assert.equal(custom[A11Y_ATTRIBUTES.underlineLinks], "on");
    assert.equal(custom[A11Y_ATTRIBUTES.reduceMotion], "reduced");
  });

  it("keeps the bootstrap script in sync with the attribute map", () => {
    const script = a11yBootstrapScript();
    for (const name of Object.values(A11Y_ATTRIBUTES)) {
      assert.ok(script.includes(name), `script must set ${name}`);
    }
    // Every text step must be representable by the pre-paint script.
    assert.match(script, /Math\.min\(step,3\)/);
  });

  it("detects reduce motion from the html attribute", () => {
    assert.equal(isA11yReduceMotionPreferred(null), false);
    assert.equal(
      isA11yReduceMotionPreferred({
        getAttribute: (name: string) =>
          name === A11Y_ATTRIBUTES.reduceMotion ? "reduced" : null,
      }),
      true
    );
    assert.equal(
      isA11yReduceMotionPreferred({ getAttribute: () => null }),
      false
    );
  });

  it("validates a stored floating button position", () => {
    assert.equal(parseA11yFabPosition(null), null);
    assert.equal(parseA11yFabPosition("nope"), null);
    assert.deepEqual(parseA11yFabPosition({ x: 12, y: 900 }), { x: 12, y: 900 });
    assert.equal(parseA11yFabPosition({ x: "a", y: 1 }), null);
  });

  it("clamps a dragged button back into the viewport", () => {
    const viewport = { width: 390, height: 844 };
    assert.deepEqual(clampA11yFabPosition({ x: -80, y: -80 }, viewport), {
      x: 10,
      y: 10,
    });
    const bottomRight = clampA11yFabPosition(
      { x: 9999, y: 9999 },
      viewport
    );
    assert.equal(bottomRight.x, 390 - A11Y_FAB_SIZE - 10);
    assert.equal(bottomRight.y, 844 - A11Y_FAB_SIZE - 10);
  });

  it("keeps the button on screen on a tiny viewport", () => {
    const clamped = clampA11yFabPosition({ x: 200, y: 200 }, {
      width: 40,
      height: 40,
    });
    assert.equal(clamped.x, 10);
    assert.equal(clamped.y, 10);
  });
});

/**
 * CSS and TS have to agree: every text step needs a root font-size rule, and
 * all six attributes need a styling block in globals.css.
 */
describe("accessibility CSS contract", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  it("ships a root font-size rule per text step", () => {
    for (const step of A11Y_TEXT_STEPS) {
      if (step === 0) continue;
      const rule = new RegExp(
        `html\\[data-a11y-text="${step}"\\]\\s*\\{[^}]*font-size:\\s*[\\d.]+%`
      );
      assert.match(css, rule, `missing font-size for step ${step}`);
    }
    assert.doesNotMatch(css, /html\[data-a11y-text="0"\]/);
  });

  it("styles every preference attribute", () => {
    assert.match(css, /html\[data-a11y-contrast="high"\]\s*\{/);
    assert.match(css, /html\[data-a11y-targets="large"\]\s*\{/);
    assert.match(css, /html\[data-a11y-spacing="on"\]\s+p,/);
    assert.match(css, /html\[data-a11y-links="on"\]\s+a/);
    assert.match(css, /html\[data-a11y-motion="reduced"\]\s*\{/);
  });

  it("keeps the floating button clear of the other bottom-right chrome", () => {
    const widget = readFileSync(
      join(process.cwd(), "app/components/accessibility-widget.css"),
      "utf8"
    );
    // Marketing rests it bottom-left; /app stacks it above the Help pill.
    assert.match(widget, /\.frontend-home \.a11y-fab\s*\{[^}]*--a11y-fab-left/);
    assert.match(widget, /body:has\(\.app-shell\) \.a11y-fab\s*\{[^}]*3\.4rem/);
    assert.match(widget, /session-immersive\) \.a11y-fab/);
  });
});
