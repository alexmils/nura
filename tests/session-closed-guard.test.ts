/**
 * Closed guided session: the chat route must refuse further turns before it
 * saves the message or calls any model (interpreter, guide, TTS), and the
 * client must treat that refusal quietly.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  isGuidedSessionClosed,
  isSessionClosedError,
  sessionClosedBody,
  SESSION_CLOSED_ERROR,
  SESSION_CLOSED_STATUS,
} from "../lib/session-closed-guard.ts";

const root = process.cwd();
const route = readFileSync(join(root, "app/api/chat/route.ts"), "utf8");
const overlay = readFileSync(join(root, "app/components/AgentOverlay.tsx"), "utf8");
const provider = readFileSync(join(root, "app/components/AppProvider.tsx"), "utf8");

describe("closed session guard (pure)", () => {
  it("treats a guided thread in closure as closed", () => {
    assert.equal(isGuidedSessionClosed({ mode: "guided", phase: "closure" }), true);
  });

  it("leaves open phases, other modes and missing threads alone", () => {
    for (const phase of ["intake", "preparation", "assessment", "desensitization", "installation", "body_scan"]) {
      assert.equal(isGuidedSessionClosed({ mode: "guided", phase }), false, phase);
    }
    assert.equal(isGuidedSessionClosed({ mode: "free", phase: "closure" }), false);
    assert.equal(isGuidedSessionClosed({ mode: "pending", phase: "closure" }), false);
    assert.equal(isGuidedSessionClosed(null), false);
    assert.equal(isGuidedSessionClosed(undefined), false);
  });

  it("answers 409 session_closed and hands the thread back", () => {
    assert.equal(SESSION_CLOSED_STATUS, 409);
    const thread = { id: "t1", mode: "guided", phase: "closure" };
    assert.deepEqual(sessionClosedBody(thread), { error: SESSION_CLOSED_ERROR, thread });
  });

  it("recognises the refusal on the client and nothing else", () => {
    assert.equal(isSessionClosedError({ status: 409, message: "session_closed" }), true);
    assert.equal(isSessionClosedError({ status: 409, message: "Conflict" }), false);
    assert.equal(isSessionClosedError({ status: 500, message: "session_closed" }), false);
    assert.equal(isSessionClosedError(new Error("session_closed")), false);
    assert.equal(isSessionClosedError(null), false);
  });
});

describe("chat route: closed thread -> no model call", () => {
  const post = route.indexOf("export async function POST");
  const body = route.slice(post);
  const guard = body.indexOf("isGuidedSessionClosed(thread)");

  it("has the guard inside POST, returning 409", () => {
    assert.ok(post >= 0, "POST handler");
    assert.ok(guard >= 0, "closed-session guard in POST");
    const block = body.slice(guard, guard + 300);
    assert.match(block, /return NextResponse\.json\(sessionClosedBody\(thread\)/);
    assert.match(block, /SESSION_CLOSED_STATUS/);
  });

  it("runs the guard right after the thread is loaded", () => {
    const load = body.indexOf("await getThread(threadId)");
    assert.ok(load >= 0 && load < guard, "thread loaded before the guard");
  });

  // Everything that costs money or writes the message must come after it.
  const later: Array<[string, string]> = [
    ["saving the user message", 'addMessage(threadId, "user"'],
    ["any agent message", "addMessage(threadId,"],
    ["the interpreter model", "runInterpreter("],
    ["the guide model", "chatCompletion("],
    ["LLM settings / provider", "getLlmRuntimeConfig()"],
    ["thread writes (set outcome)", "updateThread(threadId"],
    ["the old closed-goodbye reply", "closedSessionReply("],
  ];
  for (const [what, token] of later) {
    it(`refuses before ${what}`, () => {
      const at = body.indexOf(token);
      assert.ok(at >= 0, `${token} present in POST`);
      assert.ok(guard < at, `guard must precede ${token}`);
    });
  }
});

describe("client: closed session composer", () => {
  it("disables input, mic, voice mode and send", () => {
    assert.match(overlay, /sessionClosed\?: boolean/);
    assert.match(overlay, /const canSend = !sessionClosed &&/);
    assert.equal((overlay.match(/disabled=\{sessionClosed\}/g) ?? []).length >= 3, true);
    assert.match(overlay, /COMPOSER_STRINGS\.sessionClosed/);
    assert.match(overlay, /onExitVoice\?\.\(\)/);
  });

  it("swallows the 409 without a toast and keeps the thread closed", () => {
    assert.match(provider, /isSessionClosedError\(err\)/);
    assert.match(provider, /markThreadClosed\(activeThreadId\)/);
  });
});