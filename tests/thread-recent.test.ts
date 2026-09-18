/**
 * Recent must not collect session shells that have nothing to come back to.
 * A Self-guided session has no agent and no chat, so there is no conversation
 * to restore; its set settings live per user in `lib/bls-prefs.ts`. It should
 * therefore be pruned like the pending picker instead of lingering in Recent.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const dbSource = readFileSync(join(root, "lib/db.ts"), "utf8");
const threadsRoute = readFileSync(
  join(root, "app/api/threads/route.ts"),
  "utf8"
);

/** Slice one top-level exported function body out of a module source. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("pruneEmptyThreads", () => {
  const body = functionBody(dbSource, "pruneEmptyThreads");

  it("drops Self-guided sessions", () => {
    assert.match(body, /t\.mode = 'free'/);
  });

  it("still drops the pending picker", () => {
    assert.match(body, /t\.mode = 'pending'/);
  });

  it("keeps an untouched guided intake", () => {
    assert.match(body, /t\.phase = 'intake'/);
    assert.match(body, /COALESCE\(t\.intake_complete, FALSE\) = FALSE/);
  });

  it("never deletes a thread that has user messages", () => {
    // The free branch must stay guarded, so a session that somehow carries a
    // conversation can never be pruned.
    const freeBranch = body.slice(body.indexOf("t.mode = 'free'"));
    const guardIndex = freeBranch.indexOf("m.role = 'user'");
    const orIndex = freeBranch.indexOf("OR (");
    assert.ok(guardIndex >= 0, "missing user-message guard");
    assert.ok(
      guardIndex < orIndex,
      "the user-message guard must belong to the free branch"
    );
  });

  it("keeps the session the user is currently on", () => {
    assert.match(body, /\(\$2::text IS NULL OR t\.id <> \$2\)/);
    assert.match(body, /\[userId, exceptId \?\? null\]/);
  });

  it("scopes every delete to the current user", () => {
    assert.match(body, /WHERE t\.user_id = \$1/);
  });

  it("is the only prune path the threads list uses", () => {
    assert.match(threadsRoute, /await pruneEmptyThreads\(exceptId\)/);
    assert.match(threadsRoute, /threads: await listThreads\(\)/);
  });
});
