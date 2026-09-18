import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APP_BASE } from "../lib/app-base.ts";
import {
  GUIDE_ACTIONS,
  GUIDE_GEAR_SECTIONS,
  GUIDE_STEPS,
  clearGuideStepIndex,
  consumeGuideNewChat,
  hasGuideAutoStarted,
  hasSeenGuide,
  isGuideAction,
  markGuideAutoStarted,
  markGuideSeen,
  nextIndexOutsideGroup,
  readGuideStepIndex,
  requestGuideNewChat,
  resetGuideState,
  writeGuideStepIndex,
  type GuideStorageLike,
} from "../lib/guide-steps.ts";

function fakeStorage(): GuideStorageLike & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map),
  };
}

const PLACEMENTS = new Set(["top", "bottom", "left", "right", "center"]);
const USER_FACING_STRINGS = GUIDE_STEPS.flatMap((step) => [
  step.title,
  step.body,
  step.kicker ?? "",
  step.cta ?? "",
]);

describe("guide steps", () => {
  it("has unique ids and known placements", () => {
    const ids = new Set<string>();
    for (const step of GUIDE_STEPS) {
      assert.equal(ids.has(step.id), false, `duplicate step id ${step.id}`);
      ids.add(step.id);
      assert.ok(PLACEMENTS.has(step.placement), `bad placement ${step.placement}`);
    }
    assert.ok(GUIDE_STEPS.length > 10);
  });

  it("keeps every surface inside the product console", () => {
    for (const step of GUIDE_STEPS) {
      assert.ok(
        step.surface === APP_BASE || step.surface.startsWith(`${APP_BASE}/`),
        `step ${step.id} leaves the console: ${step.surface}`
      );
    }
  });

  it("uses only known host actions", () => {
    for (const step of GUIDE_STEPS) {
      for (const action of [
        ...(step.prepare ?? []),
        ...(step.cleanup ?? []),
        ...(step.finishActions ?? []),
      ]) {
        assert.ok(isGuideAction(action), `unknown action ${action} in ${step.id}`);
      }
      if (step.gearSection) {
        assert.ok(
          GUIDE_GEAR_SECTIONS.includes(step.gearSection),
          `unknown gear section ${step.gearSection} in ${step.id}`
        );
        assert.ok(
          step.prepare?.includes("openGearSection"),
          `step ${step.id} declares a gear section but never opens it`
        );
      }
      if (step.prepare?.includes("openGearSection")) {
        assert.ok(
          step.gearSection,
          `step ${step.id} opens a gear section without naming one`
        );
        assert.ok(
          step.cleanup?.includes("closeGear"),
          `step ${step.id} should close the sheet when it leaves`
        );
      }
    }
    assert.ok(GUIDE_ACTIONS.includes("ensurePendingThread"));
  });

  it("points targets at guide anchors that exist in the shell", () => {    const anchors = GUIDE_STEPS.map((step) => step.target).filter(
      (target): target is string => Boolean(target)
    );
    for (const anchor of anchors) {
      assert.ok(
        anchor.startsWith("[") || anchor.startsWith("#") || anchor.startsWith("."),
        `target should be a selector: ${anchor}`
      );
    }
    // The attributes the shell exposes must match the step list.
    assert.ok(anchors.includes('[data-guide="new-chat"]'));
    assert.ok(anchors.includes('[data-guide="threads"]'));
    assert.ok(anchors.includes('[data-guide="nav-resources"]'));
    assert.ok(anchors.includes('[data-guide="guide-item"]'));
    assert.ok(anchors.includes('[data-guide="mode-cards"]'));
    assert.ok(anchors.includes('[data-guide="canvas"]'));
    assert.ok(anchors.includes('[data-guide="composer"]'));
    assert.ok(anchors.includes('[data-guide-field="sound"]'));
    assert.ok(anchors.includes('[data-guide-field="adjustments"]'));
    assert.ok(anchors.includes('[data-guide-field="vibration"]'));
    // Resource steps highlight the whole section, not just its heading.
    assert.ok(anchors.includes('[data-guide="resources-watch"]'));
    assert.ok(anchors.includes('[data-guide="resources-read"]'));
    assert.ok(anchors.includes('[data-guide="resources-safety"]'));
    // The adjustments step points at the whole Look card, not just its body.
    assert.ok(
      anchors.includes('[data-gear-section="look"]'),
      "the gear step should target the whole section card"
    );
  });

  it("keeps session steps in one contiguous block before resources", () => {
    const groupIndexes = GUIDE_STEPS.map((step, index) => ({ step, index }))
      .filter(({ step }) => step.group === "session")
      .map(({ index }) => index);
    assert.ok(groupIndexes.length > 3);
    for (let i = 1; i < groupIndexes.length; i += 1) {
      assert.equal(groupIndexes[i], groupIndexes[i - 1] + 1);
    }
    const firstResources = GUIDE_STEPS.findIndex((step) =>
      step.surface.startsWith(`${APP_BASE}/resources`)
    );
    assert.ok(firstResources > groupIndexes[groupIndexes.length - 1]);
  });

  it("ends on the finish step with a primary action", () => {
    const last = GUIDE_STEPS[GUIDE_STEPS.length - 1];
    assert.equal(last.id, "finish");
    assert.ok((last.finishActions ?? []).length > 0);
    assert.ok(last.cta);
  });

  it("keeps button labels short enough to stay on one line", () => {
    for (const step of GUIDE_STEPS) {
      if (!step.cta) continue;
      assert.ok(
        step.cta.length <= 22,
        `cta too long for the nowrap footer button: ${step.cta}`
      );
      assert.equal(step.cta.includes("\n"), false);
    }
  });

  it("simulates voice mode only on the composer step", () => {
    const demoSteps = GUIDE_STEPS.filter((step) => step.demo === "voice");
    assert.equal(demoSteps.length, 1);
    const [composer] = demoSteps;
    assert.equal(composer.id, "composer");
    assert.equal(composer.target, '[data-guide="composer"]');
    assert.equal(composer.group, "session");
    // The simulation needs the guided composer mounted.
    assert.ok(composer.prepare?.includes("chooseGuided"));
    // A target is required: the demo is anchored to the real composer.
    assert.ok(composer.target);
    // The demo panel sits in the gap, so the card needs extra room.
    assert.ok(
      (composer.cardOffset ?? 0) >= 90,
      "the voice demo needs cardOffset so the card clears the panel"
    );
  });

  it("stops a running set before switching to the tour session", () => {
    const mode = GUIDE_STEPS.find((step) => step.id === "mode");
    assert.ok(mode);
    const prepare = mode.prepare ?? [];
    assert.ok(
      prepare.indexOf("stopSet") < prepare.indexOf("ensurePendingThread"),
      "stopSet must run before the session is switched"
    );
    assert.ok(GUIDE_ACTIONS.includes("stopSet"));
  });

  it("shows the controller step on the controls bar, at step 12", () => {    const joystickIndex = GUIDE_STEPS.findIndex((step) => step.id === "joystick");
    assert.ok(joystickIndex >= 0);
    assert.equal(joystickIndex + 1, 12, "the controller step should be step 12");
    const joystick = GUIDE_STEPS[joystickIndex];
    // It must point at the real control, not at a card illustration.
    assert.equal(joystick.target, '[data-guide-field="vibration"]');
    assert.equal(joystick.placement, "top");
    // The bar hides that control until a gamepad is connected, so the step
    // still has to ask for the session the controls live in.
    assert.equal(joystick.group, "session");
    assert.ok(joystick.prepare?.includes("chooseSelfGuided"));
  });

  it("skips outside a group instead of looping", () => {
    const first = GUIDE_STEPS.findIndex((step) => step.group === "session");
    const outside = nextIndexOutsideGroup(first, "session");
    assert.equal(GUIDE_STEPS[outside].group, undefined);
    assert.equal(nextIndexOutsideGroup(outside, undefined), outside + 1);
  });
});

describe("guide copy", () => {
  it("avoids retired or jargon terms", () => {
    for (const text of USER_FACING_STRINGS) {
      assert.equal(text.includes("—"), false, `em dash in: ${text}`);
      assert.equal(/\bBLS\b/.test(text), false, `BLS in: ${text}`);
      assert.equal(/free session/i.test(text), false, `Free session in: ${text}`);
      assert.equal(/free mode/i.test(text), false, `Free mode in: ${text}`);
      assert.equal(/moving ball/i.test(text), false, `moving ball in: ${text}`);
      assert.equal(/NuraHelp/.test(text), false, `NuraHelp in: ${text}`);
    }
  });

  it("names the session modes the canonical way", () => {
    const all = USER_FACING_STRINGS.join(" ");
    assert.match(all, /AI agent-guided/);
    assert.match(all, /Self-guided/);
  });
});

describe("guide storage", () => {
  it("tracks seen, step, autostart, and pending new chat", () => {
    const local = fakeStorage();
    const session = fakeStorage();

    assert.equal(hasSeenGuide(local), false);
    markGuideSeen(local);
    assert.equal(hasSeenGuide(local), true);

    assert.equal(readGuideStepIndex(session), 0);
    writeGuideStepIndex(session, 4);
    assert.equal(readGuideStepIndex(session), 4);
    writeGuideStepIndex(session, 999);
    assert.equal(readGuideStepIndex(session), GUIDE_STEPS.length - 1);
    writeGuideStepIndex(session, -3);
    assert.equal(readGuideStepIndex(session), 0);
    clearGuideStepIndex(session);
    assert.equal(readGuideStepIndex(session), 0);

    assert.equal(hasGuideAutoStarted(session), false);
    markGuideAutoStarted(session);
    assert.equal(hasGuideAutoStarted(session), true);

    assert.equal(consumeGuideNewChat(session), false);
    requestGuideNewChat(session);
    assert.equal(consumeGuideNewChat(session), true);
    assert.equal(consumeGuideNewChat(session), false);

    resetGuideState(local, session);
    assert.equal(hasSeenGuide(local), false);
    assert.equal(hasGuideAutoStarted(session), false);
    assert.deepEqual(session.dump(), {});
  });

  it("survives storage that throws", () => {
    const broken: GuideStorageLike = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };
    assert.equal(hasSeenGuide(broken), false);
    assert.doesNotThrow(() => markGuideSeen(broken));
    assert.equal(readGuideStepIndex(broken), 0);
    assert.doesNotThrow(() => writeGuideStepIndex(broken, 2));
    assert.equal(consumeGuideNewChat(broken), false);
  });
});
