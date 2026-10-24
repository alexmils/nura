import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REPLY_MAX_WAIT_MS,
  REPLY_QUIET_MS,
  REPLY_TYPING_GRACE_MS,
  createReplyBatcher,
  isRiskText,
  replyDueAt,
  shouldReplyImmediately,
} from "../lib/reply-debounce.ts";

function harness() {
  let t = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let nextId = 1;
  const flushed: string[][] = [];
  const b = createReplyBatcher<string>({
    onFlush: (items) => flushed.push(items),
    now: () => t,
    schedule: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    unschedule: (h) => {
      timers.delete(h as number);
    },
  });
  const advance = (ms: number) => {
    const end = t + ms;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, v]) => v.at <= end)
        .sort((a, z) => a[1].at - z[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      t = due[1].at;
      due[1].fn();
    }
    t = end;
  };
  return { b, flushed, advance };
}

describe("replyDueAt", () => {
  it("nothing pending: nothing due", () => {
    assert.equal(replyDueAt({ lastSendAt: null, lastKeyAt: null, draftNonEmpty: false }), null);
  });
  it("quiet window after the last send", () => {
    assert.equal(replyDueAt({ lastSendAt: 1000, lastKeyAt: null, draftNonEmpty: false }), 1000 + REPLY_QUIET_MS);
  });
  it("a recent keystroke extends past the quiet window", () => {
    const due = replyDueAt({ lastSendAt: 0, lastKeyAt: 2000, draftNonEmpty: false });
    assert.equal(due, 2000 + REPLY_TYPING_GRACE_MS);
  });
  it("text in the composer waits until the cap", () => {
    assert.equal(replyDueAt({ lastSendAt: 0, lastKeyAt: 100, draftNonEmpty: true }), REPLY_MAX_WAIT_MS);
  });
});

describe("reply batcher", () => {
  it("does not ask the guide before the quiet window ends", () => {
    const { b, flushed, advance } = harness();
    b.push("btu i cant");
    advance(REPLY_QUIET_MS - 1);
    assert.equal(flushed.length, 0);
    advance(1);
    assert.deepEqual(flushed, [["btu i cant"]]);
  });

  it("batches 3 quick messages into ONE guide turn, in order", () => {
    const { b, flushed, advance } = harness();
    b.push("but i cant");
    advance(1000);
    b.push("i tried once");
    advance(1500);
    b.push("it was too much");
    advance(REPLY_QUIET_MS);
    assert.deepEqual(flushed, [["but i cant", "i tried once", "it was too much"]]);
  });

  it("typing extends the wait; clearing and stopping resumes it", () => {
    const { b, flushed, advance } = harness();
    b.push("first");
    advance(2000);
    b.noteDraft("and th"); // still typing
    advance(5000);
    assert.equal(flushed.length, 0);
    b.noteDraft(""); // cleared it and stopped
    advance(REPLY_TYPING_GRACE_MS - 1);
    assert.equal(flushed.length, 0);
    advance(1);
    assert.deepEqual(flushed, [["first"]]);
  });

  it("never waits past the cap even if the draft stays non-empty", () => {
    const { b, flushed, advance } = harness();
    b.push("one");
    b.noteDraft("half a sentence");
    advance(REPLY_MAX_WAIT_MS - 1);
    assert.equal(flushed.length, 0);
    advance(1);
    assert.deepEqual(flushed, [["one"]]);
  });

  it("an immediate send goes now, together with anything pending", () => {
    const { b, flushed } = harness();
    b.push("i feel bad");
    b.push("i want to kill myself", shouldReplyImmediately("i want to kill myself"));
    assert.deepEqual(flushed, [["i feel bad", "i want to kill myself"]]);
  });

  it("flush sends pending items (navigation / unmount) and drain drops them", () => {
    const { b, flushed, advance } = harness();
    b.push("a");
    b.flush();
    assert.deepEqual(flushed, [["a"]]);
    b.push("b");
    assert.deepEqual(b.drain(), ["b"]);
    advance(REPLY_MAX_WAIT_MS);
    assert.equal(flushed.length, 1);
    assert.equal(b.pendingCount(), 0);
  });

  it("keystrokes without anything pending do not schedule a send", () => {
    const { b, flushed, advance } = harness();
    b.noteDraft("hello");
    advance(REPLY_MAX_WAIT_MS * 2);
    assert.equal(flushed.length, 0);
  });
});

describe("immediate-send rules", () => {
  it("crisis text, quick replies and voice skip the wait", () => {
    assert.equal(shouldReplyImmediately("I don't want to live anymore"), true);
    assert.equal(shouldReplyImmediately("ne \u017eelim da \u017eivim"), true);
    assert.equal(shouldReplyImmediately("Ich will nicht mehr leben"), true);
    assert.equal(shouldReplyImmediately("Quiero suicidarme"), true);
    // Figures of speech still wait like any other message.
    assert.equal(shouldReplyImmediately("I'm dying to try this"), false);
    assert.equal(shouldReplyImmediately("ok", { immediate: true }), true);
    assert.equal(shouldReplyImmediately("ok", { voice: true }), true);
    assert.equal(shouldReplyImmediately("btu i cant"), false);
    assert.equal(isRiskText("I feel a bit sad"), false);
  });

});
describe("batched turn on the server", () => {
  it("keeps order, trims and drops empties; array wins over the single field", async () => {
    const { normalizeUserBatch, batchTurnText, MAX_BATCHED_USER_MESSAGES } = await import("../lib/reply-debounce.ts");
    assert.deepEqual(normalizeUserBatch([" but i cant ", "", "i tried once", 3], "ignored"), ["but i cant", "i tried once"]);
    assert.deepEqual(normalizeUserBatch(undefined, " hello "), ["hello"]);
    assert.deepEqual(normalizeUserBatch(undefined, undefined), []);
    assert.equal(normalizeUserBatch(Array(50).fill("x"), null).length, MAX_BATCHED_USER_MESSAGES);
    assert.equal(batchTurnText(["but i cant", "i tried once"]), "but i cant\ni tried once");
    assert.equal(batchTurnText([]), undefined);
  });
});