import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLongPress, LONG_PRESS_MS } from "../lib/long-press.ts";

/** Manual clock: schedule() queues, tick() runs what is due. */
function clock() {
  let now = 0;
  const jobs = new Map<number, { at: number; fn: () => void }>();
  let id = 0;
  return {
    schedule: (fn: () => void, ms: number) => {
      jobs.set(++id, { at: now + ms, fn });
      return id;
    },
    unschedule: (h: unknown) => void jobs.delete(h as number),
    tick(ms: number) {
      now += ms;
      for (const [k, j] of [...jobs]) if (j.at <= now) { jobs.delete(k); j.fn(); }
    },
  };
}

function setup(delay?: number) {
  const c = clock();
  const hits: { x: number; y: number }[] = [];
  const lp = createLongPress({ delay, onLongPress: (p) => hits.push(p), schedule: c.schedule, unschedule: c.unschedule });
  return { c, hits, lp };
}

describe("long press", () => {
  it("defaults to about half a second", () => {
    assert.ok(LONG_PRESS_MS >= 450 && LONG_PRESS_MS <= 600);
  });

  it("fires once after holding still, then swallows the following click", () => {
    const { c, hits, lp } = setup(500);
    lp.down(10, 20, "touch");
    c.tick(499);
    assert.equal(hits.length, 0);
    c.tick(1);
    assert.deepEqual(hits, [{ x: 10, y: 20 }]);
    lp.up();
    assert.equal(lp.consumeClick(), true);
    assert.equal(lp.consumeClick(), false);
  });

  it("does not fire on a short tap, and the tap's click goes through", () => {
    const { c, hits, lp } = setup(500);
    lp.down(0, 0, "touch");
    c.tick(200);
    lp.up();
    c.tick(1000);
    assert.equal(hits.length, 0);
    assert.equal(lp.consumeClick(), false);
  });

  it("cancels when the finger moves (a scroll) or the browser cancels the pointer", () => {
    const { c, hits, lp } = setup(500);
    lp.down(0, 0, "touch");
    lp.move(3, 4); // 5px: still a hold
    lp.move(0, 12); // scrolling
    c.tick(1000);
    lp.down(0, 0, "touch");
    lp.cancel(); // pointercancel when the list starts scrolling
    c.tick(1000);
    assert.equal(hits.length, 0);
  });

  it("ignores right and middle mouse buttons (right-click has its own menu)", () => {
    const { c, hits, lp } = setup(500);
    lp.down(0, 0, "mouse", 2);
    c.tick(1000);
    assert.equal(hits.length, 0);
    lp.down(0, 0, "mouse", 0);
    c.tick(500);
    assert.equal(hits.length, 1);
  });
});
