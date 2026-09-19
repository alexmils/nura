import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  A11Y_ATTRIBUTES,
  A11Y_FAB_SIZE,
  A11Y_RIBBON_H,
  A11Y_RIBBON_W,
  A11Y_TEXT_STEPS,
  DEFAULT_A11Y_FAB,
  DEFAULT_A11Y_PREFERENCES,
  a11yAttachedBox,
  a11yAttributeValues,
  a11yBootstrapScript,
  activeA11yCount,
  clampA11yCenterY,
  clampA11yFabPosition,
  isA11yReduceMotionPreferred,
  isDefaultA11yPreferences,
  nearestA11yEdge,
  parseA11yFabState,
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

  it("validates a stored floating button state", () => {
    assert.deepEqual(parseA11yFabState(null), DEFAULT_A11Y_FAB);
    assert.deepEqual(parseA11yFabState("nope"), DEFAULT_A11Y_FAB);
    assert.equal(parseA11yFabState("{not json").attached, true);
    assert.deepEqual(
      parseA11yFabState({
        x: 40,
        y: 90,
        attached: false,
        edge: "right",
        centerY: 300,
      }),
      { x: 40, y: 90, attached: false, edge: "right", centerY: 300 }
    );
    // Junk falls back per field rather than throwing.
    assert.deepEqual(parseA11yFabState({ x: "a", y: null, edge: "top" }), {
      x: null,
      y: null,
      attached: true,
      edge: null,
      centerY: null,
    });
    // Attached is the default, so only an explicit false frees it.
    assert.equal(parseA11yFabState({ x: 10, y: 10 }).attached, true);
  });

  it("clamps a dragged button back into the viewport", () => {
    const viewport = { width: 390, height: 844 };
    assert.deepEqual(clampA11yFabPosition({ x: -80, y: -80 }, viewport), {
      x: 10,
      y: 10,
    });
    const bottomRight = clampA11yFabPosition({ x: 9999, y: 9999 }, viewport);
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

  it("clamps the pinned center into the viewport", () => {
    const h = 844;
    assert.equal(clampA11yCenterY(-500, h), 54);
    assert.equal(clampA11yCenterY(9999, h), h - 54);
    // A bottom bar reserves room so the widget cannot sit under it.
    assert.equal(clampA11yCenterY(9999, h, undefined, 120), h - 54 - 120);
    // A viewport shorter than the widget stays centered instead of flipping.
    assert.equal(clampA11yCenterY(200, 40), 20);
  });

  it("picks the nearest edge from the middle of the button", () => {
    assert.equal(nearestA11yEdge(0, 390), "left");
    assert.equal(nearestA11yEdge(160, 390), "left");
    assert.equal(nearestA11yEdge(200, 390), "right");
    assert.equal(nearestA11yEdge(338, 390), "right");
  });

  it("computes the pinned ribbon box flush to each edge", () => {
    const v = { viewportWidth: 390, viewportHeight: 844 };
    const left = a11yAttachedBox({ edge: "left", centerY: 400, ...v });
    assert.equal(left.left, 0);
    assert.equal(left.width, A11Y_RIBBON_W);
    assert.equal(left.height, A11Y_RIBBON_H);
    assert.equal(left.top, 400 - A11Y_RIBBON_H / 2);

    const right = a11yAttachedBox({ edge: "right", centerY: null, ...v });
    assert.equal(right.left, 390 - A11Y_RIBBON_W);
    // No saved center means centered in the viewport.
    assert.equal(right.top, Math.round(844 / 2 - A11Y_RIBBON_H / 2));

    // Off-screen centers are pulled back inside.
    const clamped = a11yAttachedBox({ edge: "left", centerY: 9999, ...v });
    assert.ok(clamped.top + A11Y_RIBBON_H <= 844);
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

  it("keeps the widget clear of the other floating chrome", () => {
    const widget = readFileSync(
      join(process.cwd(), "app/components/accessibility-widget.css"),
      "utf8"
    );
    const widgetTsx = readFileSync(
      join(process.cwd(), "app/components/AccessibilityWidget.tsx"),
      "utf8"
    );
    // A set in progress hides the whole widget.
    assert.match(widget, /session-immersive\) \.a11y-widget/);
    // Both edges must be pinnable.
    assert.match(widget, /\[data-attached\]\[data-edge="right"\] \.a11y-fab\s*\{/);
    assert.match(widget, /\[data-attached\]\[data-edge="left"\] \.a11y-fab\s*\{/);
    // The attach control only exists while the circle is free, and it must
    // stay reachable without hover (touch, keyboard).
    assert.match(widget, /\.a11y-widget:hover \.a11y-attach/);
    assert.match(widget, /\.a11y-widget:focus-within \.a11y-attach/);
    assert.match(widget, /@media \(hover: none\), \(pointer: coarse\)\s*\{[^}]*\.a11y-attach/);
    // Dragging must not animate.
    assert.match(widget, /\.a11y-widget\.is-dragging\s*\{[^}]*transition: none/);
    // Each shell passes its default edge instead of the CSS guessing it.
    assert.match(widgetTsx, /defaultEdge\?: A11yDockEdge/);
    const marketing = readFileSync(
      join(process.cwd(), "app/components/frontend/FrontendShellClient.tsx"),
      "utf8"
    );
    const app = readFileSync(join(process.cwd(), "app/app/layout.tsx"), "utf8");
    assert.match(marketing, /AccessibilityWidget defaultEdge="left"/);
    assert.match(app, /AccessibilityWidget defaultEdge="right"/);
  });
});
