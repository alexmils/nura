import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  A11Y_ATTRIBUTES,
  A11Y_TEXT_STEPS,
  DEFAULT_A11Y_DOCK,
  DEFAULT_A11Y_PREFERENCES,
  a11yAttributeValues,
  a11yBootstrapScript,
  a11yEdgeForX,
  activeA11yCount,
  clampA11yCenterY,
  isA11yReduceMotionPreferred,
  isDefaultA11yPreferences,
  parseA11yDock,
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

  it("validates a stored dock state", () => {
    assert.deepEqual(parseA11yDock(null), DEFAULT_A11Y_DOCK);
    assert.deepEqual(parseA11yDock("nope"), DEFAULT_A11Y_DOCK);
    assert.equal(parseA11yDock("{not json").collapsed, true);
    assert.deepEqual(
      parseA11yDock({ edge: "left", centerY: 300, collapsed: false }),
      { edge: "left", centerY: 300, collapsed: false }
    );
    // Junk edge/center falls back to the surface default, not a crash.
    assert.deepEqual(parseA11yDock({ edge: "top", centerY: "a" }), {
      edge: null,
      centerY: null,
      collapsed: true,
    });
    // Folded is the default state, so only an explicit false unfolds.
    assert.equal(parseA11yDock({ edge: "right" }).collapsed, true);
    assert.equal(parseA11yDock({ collapsed: 0 }).collapsed, true);
  });

  it("clamps the docked center into the viewport", () => {
    const h = 844;
    // Never off the top or bottom, allowing for the ribbon half-height.
    assert.equal(clampA11yCenterY(-500, h), 54);
    assert.equal(clampA11yCenterY(9999, h), h - 54);
    // A bottom bar reserves room so the widget cannot sit under it.
    assert.equal(clampA11yCenterY(9999, h, undefined, 120), h - 54 - 120);
    // A viewport shorter than the widget stays centered instead of flipping.
    assert.equal(clampA11yCenterY(200, 40), 20);
  });

  it("picks the nearest edge so a folded ribbon can be re-docked", () => {
    assert.equal(a11yEdgeForX(10, 390), "left");
    assert.equal(a11yEdgeForX(194, 390), "left");
    assert.equal(a11yEdgeForX(196, 390), "right");
    assert.equal(a11yEdgeForX(380, 390), "right");
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
    // A set in progress hides the ribbon and its fold control.
    assert.match(widget, /session-immersive\) \.a11y-fab/);
    assert.match(widget, /session-immersive\) \.a11y-fold/);
    // Both edges must be dockable, folded and open.
    assert.match(widget, /data-edge="right"\] \.a11y-fab\s*\{[^}]*right: var\(--a11y-inset\)/);
    assert.match(widget, /data-edge="left"\] \.a11y-fab\s*\{[^}]*left: var\(--a11y-inset\)/);
    // The folded ribbon is flush to the edge, so the inset collapses to zero.
    assert.match(widget, /\.a11y-widget\[data-collapsed\]\s*\{[^}]*--a11y-inset: 0px/);
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
