import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allInformedKeysAccepted,
  INFORMED_CONSENT_KEYS,
  requiredConsentVersions,
  SESSION_REQUIRED_DOC_TYPES,
} from "../lib/consents-shared.ts";
import {
  LEGAL_DOC_VERSION,
  hasClinicalAdvisorConfigured,
  legalEntityDisplayName,
  pendingCounselNotice,
} from "../lib/legal-entity.ts";
import {
  phaseNeedsClosureGate,
  shouldOfferResumeClosure,
  shouldPromptSessionClosure,
  isEmptyDisposableSession,
} from "../lib/session-closure.ts";

describe("consents helpers", () => {
  it("requires age_18 and informed_session", () => {
    assert.deepEqual(SESSION_REQUIRED_DOC_TYPES, [
      "age_18",
      "informed_session",
    ]);
    const v = requiredConsentVersions();
    assert.equal(v.age_18, LEGAL_DOC_VERSION.age_18);
    assert.equal(v.informed_session, LEGAL_DOC_VERSION.informed_session);
  });

  it("accepts only when every informed key is true", () => {
    assert.equal(allInformedKeysAccepted({}), false);
    const partial = Object.fromEntries(
      INFORMED_CONSENT_KEYS.map((k, i) => [k, i > 0])
    );
    assert.equal(allInformedKeysAccepted(partial), false);
    const full = Object.fromEntries(
      INFORMED_CONSENT_KEYS.map((k) => [k, true])
    );
    assert.equal(allInformedKeysAccepted(full), true);
  });
});

describe("session closure gates", () => {
  it("flags processing phases", () => {
    assert.equal(phaseNeedsClosureGate("desensitization"), true);
    assert.equal(phaseNeedsClosureGate("installation"), true);
    assert.equal(phaseNeedsClosureGate("body_scan"), true);
    assert.equal(phaseNeedsClosureGate("intake"), false);
    assert.equal(phaseNeedsClosureGate("closure"), false);
  });

  it("prompts on running set or guided processing phase", () => {
    assert.equal(
      shouldPromptSessionClosure({
        thread: {
          mode: "guided",
          phase: "desensitization",
          incomplete: false,
        },
      }),
      true
    );
    assert.equal(
      shouldPromptSessionClosure({
        thread: { mode: "free", phase: "intake", incomplete: false },
        setRunning: true,
      }),
      false
    );
    assert.equal(
      shouldPromptSessionClosure({
        thread: {
          mode: "free",
          phase: "desensitization",
          incomplete: true,
        },
      }),
      false
    );
    assert.equal(
      shouldPromptSessionClosure({
        thread: { mode: "pending", phase: "intake", incomplete: true },
      }),
      false
    );
    assert.equal(
      shouldPromptSessionClosure({
        thread: {
          mode: "guided",
          phase: "intake",
          incomplete: true,
        },
        hasUserMessage: false,
      }),
      false
    );
    assert.equal(
      shouldPromptSessionClosure({
        thread: {
          mode: "guided",
          phase: "intake",
          incomplete: true,
        },
        hasUserMessage: true,
      }),
      true
    );
  });

  it("treats unused picker / silent intake as disposable", () => {
    assert.equal(
      isEmptyDisposableSession({
        thread: { mode: "pending", phase: "intake", incomplete: true },
        hasUserMessage: false,
      }),
      true
    );
    assert.equal(
      isEmptyDisposableSession({
        thread: {
          mode: "guided",
          phase: "intake",
          incomplete: true,
          intakeComplete: false,
        },
        hasUserMessage: false,
      }),
      true
    );
    assert.equal(
      isEmptyDisposableSession({
        thread: {
          mode: "guided",
          phase: "intake",
          incomplete: true,
          intakeComplete: false,
        },
        hasUserMessage: true,
      }),
      false
    );
    assert.equal(
      isEmptyDisposableSession({
        thread: {
          mode: "free",
          phase: "intake",
          incomplete: true,
          intakeComplete: true,
        },
        hasUserMessage: false,
      }),
      false
    );
  });

  it("resume only when incomplete mid-processing (not default new threads)", () => {
    assert.equal(
      shouldOfferResumeClosure({
        mode: "guided",
        phase: "intake",
        incomplete: true,
      }),
      false
    );
    assert.equal(
      shouldOfferResumeClosure({
        mode: "guided",
        phase: "desensitization",
        incomplete: true,
      }),
      true
    );
    assert.equal(
      shouldOfferResumeClosure({
        mode: "guided",
        phase: "desensitization",
        incomplete: false,
      }),
      false
    );
  });
});

describe("legal entity placeholders", () => {
  it("lists a configured operator without inventing a clinician", () => {
    assert.equal(hasClinicalAdvisorConfigured(), false);
    assert.equal(legalEntityDisplayName(), "Receptly LLC");
    assert.match(pendingCounselNotice(), /not a substitute for attorney/i);
  });
});
