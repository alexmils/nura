import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canRepeatGuidedSet,
  canStartBls,
  isChoosableSessionMode,
  phaseAllowsBlsSet,
  shouldAutoStartSet,
  shouldBootstrapAgent,
  showsBlsControls,
  showsBlsToolbar,
  showsComposer,
  usesAgent,
} from "../lib/session-mode.ts";

describe("session mode helpers", () => {
  it("bootstraps agent only for guided with no messages", () => {
    assert.equal(shouldBootstrapAgent("pending", 0), false);
    assert.equal(shouldBootstrapAgent("free", 0), false);
    assert.equal(shouldBootstrapAgent("guided", 0), true);
    assert.equal(shouldBootstrapAgent("guided", 1), false);
  });

  it("shows composer only in guided mode", () => {
    assert.equal(showsComposer("pending"), false);
    assert.equal(showsComposer("free"), false);
    assert.equal(showsComposer("guided"), true);
  });

  it("shows BLS toolbar in guided only when a set is ready or running", () => {
    assert.equal(
      showsBlsToolbar({
        sessionKind: "guided",
        phase: "intake",
        sessionMode: "idle",
      }),
      false
    );
    assert.equal(
      showsBlsToolbar({
        sessionKind: "guided",
        phase: "grounding",
        sessionMode: "idle",
      }),
      false
    );
    assert.equal(
      showsBlsToolbar({
        sessionKind: "guided",
        phase: "desensitization",
        sessionMode: "idle",
      }),
      true
    );
    assert.equal(
      showsBlsToolbar({
        sessionKind: "guided",
        phase: "desensitization",
        sessionMode: "check_in",
      }),
      false
    );
    assert.equal(
      showsBlsToolbar({
        sessionKind: "guided",
        phase: "grounding",
        sessionMode: "running",
      }),
      true
    );
    assert.equal(
      showsBlsToolbar({
        sessionKind: "free",
        phase: "grounding",
        sessionMode: "idle",
      }),
      true
    );
  });

  it("shows BLS controls after mode is chosen", () => {
    assert.equal(showsBlsControls("pending"), false);
    assert.equal(showsBlsControls("free"), true);
    assert.equal(showsBlsControls("guided"), true);
  });

  it("uses agent only for guided", () => {
    assert.equal(usesAgent("pending"), false);
    assert.equal(usesAgent("free"), false);
    assert.equal(usesAgent("guided"), true);
  });

  it("accepts only guided or free as choosable modes", () => {
    assert.equal(isChoosableSessionMode("guided"), true);
    assert.equal(isChoosableSessionMode("free"), true);
    assert.equal(isChoosableSessionMode("pending"), false);
    assert.equal(isChoosableSessionMode("other"), false);
    assert.equal(isChoosableSessionMode(undefined), false);
  });

  it("allows BLS sets only in processing phases", () => {
    assert.equal(phaseAllowsBlsSet("intake"), false);
    assert.equal(phaseAllowsBlsSet("grounding"), false);
    assert.equal(phaseAllowsBlsSet("assessment"), false);
    assert.equal(phaseAllowsBlsSet("closure"), false);
    assert.equal(phaseAllowsBlsSet("desensitization"), true);
    assert.equal(phaseAllowsBlsSet("installation"), true);
    assert.equal(phaseAllowsBlsSet("body_scan"), true);
  });

  it("gates starting BLS in guided by phase and idle mode", () => {
    assert.equal(
      canStartBls({
        sessionKind: "guided",
        phase: "intake",
        sessionMode: "idle",
      }),
      false
    );
    assert.equal(
      canStartBls({
        sessionKind: "free",
        phase: "grounding",
        sessionMode: "idle",
      }),
      true
    );
    assert.equal(
      canStartBls({
        sessionKind: "guided",
        phase: "grounding",
        sessionMode: "idle",
      }),
      false
    );
    assert.equal(
      canStartBls({
        sessionKind: "guided",
        phase: "desensitization",
        sessionMode: "idle",
      }),
      true
    );
    assert.equal(
      canStartBls({
        sessionKind: "guided",
        phase: "desensitization",
        sessionMode: "check_in",
      }),
      false
    );
    assert.equal(
      canStartBls({
        sessionKind: "guided",
        phase: "desensitization",
        sessionMode: "running",
      }),
      false
    );
  });

  it("allows repeat set only during guided check-in in BLS phases", () => {
    assert.equal(
      canRepeatGuidedSet({
        sessionKind: "guided",
        phase: "desensitization",
        sessionMode: "check_in",
      }),
      true
    );
    assert.equal(
      canRepeatGuidedSet({
        sessionKind: "guided",
        phase: "desensitization",
        sessionMode: "idle",
      }),
      false
    );
    assert.equal(
      canRepeatGuidedSet({
        sessionKind: "free",
        phase: "desensitization",
        sessionMode: "check_in",
      }),
      false
    );
  });

  it("auto-starts a set only with startSet and canStartBls gates", () => {
    assert.equal(
      shouldAutoStartSet({
        startSet: true,
        sessionKind: "guided",
        phase: "desensitization",
        sessionMode: "idle",
      }),
      true
    );
    assert.equal(
      shouldAutoStartSet({
        startSet: false,
        sessionKind: "guided",
        phase: "desensitization",
        sessionMode: "idle",
      }),
      false
    );
    assert.equal(
      shouldAutoStartSet({
        startSet: true,
        sessionKind: "guided",
        phase: "assessment",
        sessionMode: "idle",
      }),
      false
    );
    assert.equal(
      shouldAutoStartSet({
        startSet: true,
        sessionKind: "guided",
        phase: "desensitization",
        sessionMode: "idle",
        riskFlag: true,
      }),
      false
    );
    assert.equal(
      shouldAutoStartSet({
        startSet: true,
        sessionKind: "guided",
        phase: "desensitization",
        sessionMode: "idle",
        outOfWindow: true,
      }),
      false
    );
    // A high SUDs is not out of window: the guide must still be free to start.
    assert.equal(
      shouldAutoStartSet({
        startSet: true,
        sessionKind: "guided",
        phase: "desensitization",
        sessionMode: "idle",
        outOfWindow: false,
      }),
      true
    );
    assert.equal(
      shouldAutoStartSet({
        startSet: true,
        sessionKind: "guided",
        phase: "desensitization",
        sessionMode: "check_in",
      }),
      false
    );
  });
});
