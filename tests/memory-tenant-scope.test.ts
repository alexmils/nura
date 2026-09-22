/**
 * Memory is account-scoped. RLS alone is not enough: the pooled connection
 * runs as the table owner in dev and (per docs/production.md) as `nura` in
 * production, and a table owner is exempt from its own RLS policies unless
 * FORCE ROW LEVEL SECURITY is set. So every memories query must carry an
 * explicit user_id predicate, and the schema init must not touch retired
 * memory-set tables after dropping them.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const dbSource = readFileSync(join(root, "lib/db.ts"), "utf8");
const rlsSource = readFileSync(join(root, "lib/rls-policies.ts"), "utf8");
const settingsRoute = readFileSync(
  join(root, "app/api/settings/route.ts"),
  "utf8"
);
const threadsRoute = readFileSync(join(root, "app/api/threads/route.ts"), "utf8");

/** Slice one top-level exported function body out of a module source. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("memories queries are tenant-scoped", () => {
  const scoped: [string, RegExp][] = [
    ["listMemories", /SELECT \* FROM memories WHERE user_id = \$1/],
    ["getAccountMemoryContext", /FROM memories WHERE user_id = \$1/],
    ["updateMemory", /UPDATE memories SET title = \$1, body = \$2 WHERE id = \$3 AND user_id = \$4/],
    ["deleteMemory", /DELETE FROM memories WHERE id = \$1 AND user_id = \$2/],
    ["clearMemories", /DELETE FROM memories WHERE user_id = \$1/],
    [
      "claimThreadMemoryExtract",
      /UPDATE threads[\s\S]*WHERE id = \$1[\s\S]*AND user_id = \$2/,
    ],
    [
      "clearThreadMemoryExtractClaim",
      /UPDATE threads[\s\S]*WHERE id = \$1 AND user_id = \$2/,
    ],
  ];

  for (const [name, pattern] of scoped) {
    it(`${name} filters by user_id`, () => {
      assert.match(functionBody(dbSource, name), pattern);
    });
  }

  it("no memories statement can run unfiltered", () => {
    // A quote right after the table name means no WHERE clause followed.
    assert.doesNotMatch(dbSource, /(SELECT|DELETE) FROM memories["`']/);
  });

  it("createMemory inserts with source and user_id", () => {
    assert.match(
      functionBody(dbSource, "createMemory"),
      /INSERT INTO memories \(id, user_id, title, body, source, created_at\)/
    );
  });
});

describe("retired memory-set tables", () => {
  it("are dropped before RLS policies run", () => {
    const drop = dbSource.indexOf("DROP TABLE IF EXISTS memory_sets");
    const policies = dbSource.indexOf("await ensureRlsPolicies(db)");
    assert.ok(drop >= 0, "memory_sets drop missing");
    assert.ok(policies >= 0, "ensureRlsPolicies call missing");
    assert.ok(
      drop < policies,
      "memory_sets must be dropped before ensureRlsPolicies touches it"
    );
  });

  it("are gone from the RLS policy list", () => {
    for (const table of [
      "memory_sets",
      "memory_set_items",
      "thread_memory_sets",
    ]) {
      assert.doesNotMatch(
        rlsSource,
        new RegExp(`\\b${table}\\b`),
        `${table} still referenced in rls-policies`
      );
    }
  });
});

describe("memory API surface", () => {
  it("settings exposes clear_memories and no set actions", () => {
    assert.match(settingsRoute, /body\.action === "clear_memories"/);
    for (const action of [
      "create_set",
      "update_set",
      "delete_set",
      "add_to_set",
      "remove_from_set",
    ]) {
      assert.doesNotMatch(settingsRoute, new RegExp(action));
    }
    assert.doesNotMatch(settingsRoute, /memorySets/);
  });

  it("threads no longer accepts set_memory", () => {
    assert.doesNotMatch(threadsRoute, /set_memory/);
    assert.doesNotMatch(threadsRoute, /memorySets/);
  });

  it("threads schedules session memory extract on guided closure", () => {
    assert.match(threadsRoute, /shouldScheduleMemoryExtract/);
    assert.match(threadsRoute, /scheduleSessionMemoryExtract/);
  });
});

describe("session memory extract wiring", () => {
  const chatRoute = readFileSync(join(root, "app/api/chat/route.ts"), "utf8");

  it("chat schedules extract when phase advances to closure", () => {
    assert.match(chatRoute, /shouldScheduleMemoryExtract/);
    assert.match(chatRoute, /scheduleSessionMemoryExtract/);
  });

  it("schema adds memories.source and threads.memory_extracted_at", () => {
    assert.match(
      dbSource,
      /ALTER TABLE memories ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user'/
    );
    assert.match(
      dbSource,
      /ALTER TABLE threads ADD COLUMN IF NOT EXISTS memory_extracted_at TIMESTAMPTZ/
    );
  });
});
