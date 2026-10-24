import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isRecentThreadActive,
  isSessionHostPath,
  recentThreadAction,
  sessionHref,
} from "../lib/sidebar-thread-nav.ts";
import { readThreadIdFromSearch } from "../lib/session-restore.ts";
import { createLongPress } from "../lib/long-press.ts";

const ID = "thr_abc123";

describe("sidebar Recent navigation", () => {
  it("only /app hosts the session workspace", () => {
    assert.equal(isSessionHostPath("/app"), true);
    assert.equal(isSessionHostPath("/app/"), true);
    assert.equal(isSessionHostPath("/app/resources"), false);
    assert.equal(isSessionHostPath("/app/resources/what-is-emdr"), false);
    assert.equal(isSessionHostPath("/app/settings"), false);
    assert.equal(isSessionHostPath(null), false);
  });

  it("builds a deep link the Home provider restores from", () => {
    const href = sessionHref(ID);
    assert.equal(href, `/app?thread=${ID}`);
    assert.equal(readThreadIdFromSearch(href.slice(href.indexOf("?"))), ID);
  });

  it("selects in place on Home", () => {
    assert.deepEqual(recentThreadAction("/app", ID), { kind: "select", threadId: ID });
  });

  it("navigates to the session from Resources and articles", () => {
    for (const path of ["/app/resources", "/app/resources/grounding", "/app/billing"]) {
      assert.deepEqual(recentThreadAction(path, ID), {
        kind: "navigate",
        threadId: ID,
        href: `/app?thread=${ID}`,
      });
    }
  });

  it("highlights a Recent row only when that session is on screen", () => {
    assert.equal(isRecentThreadActive("/app", ID, ID), true);
    assert.equal(isRecentThreadActive("/app", ID, "thr_other1"), false);
    assert.equal(isRecentThreadActive("/app", null, ID), false);
    // Resources restores the stored session in memory but does not show it.
    assert.equal(isRecentThreadActive("/app/resources", ID, ID), false);
    assert.equal(isRecentThreadActive("/app/resources/grounding", ID, ID), false);
  });
});

describe("tap vs long press on a Recent row", () => {
  function manual() {
    let pending: (() => void) | null = null;
    let fired = 0;
    const lp = createLongPress({
      onLongPress: () => {
        fired += 1;
      },
      schedule: (fn) => {
        pending = fn;
        return 1;
      },
      unschedule: () => {
        pending = null;
      },
    });
    return { lp, fire: () => pending?.(), fired: () => fired };
  }

  it("a short tap is not swallowed (it navigates)", () => {
    const { lp } = manual();
    lp.down(10, 10, "touch");
    lp.up();
    assert.equal(lp.consumeClick(), false);
  });

  it("a hold opens the menu and swallows only the click that follows", () => {
    const { lp, fire, fired } = manual();
    lp.down(10, 10, "touch");
    fire();
    lp.up();
    assert.equal(fired(), 1);
    assert.equal(lp.consumeClick(), true);
    assert.equal(lp.consumeClick(), false);
  });

  it("a hold with no trailing click does not eat the next tap", () => {
    const { lp, fire } = manual();
    lp.down(10, 10, "touch");
    fire();
    lp.cancel(); // touch long-press: the browser may skip the click entirely
    lp.down(10, 10, "touch");
    lp.up();
    assert.equal(lp.consumeClick(), false);
  });
});