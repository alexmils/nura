import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LAST_SESSION_STORAGE_KEY,
  isPlausibleThreadId,
  readStoredSessionId,
  readThreadIdFromSearch,
  resolveSessionThreadId,
  storeSessionId,
  withThreadParam,
} from "../lib/session-restore.ts";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

const ID = "f2955d68-492a-4351-b61f-b7b1deb06f82";

describe("session restore", () => {
  it("accepts real ids and rejects junk", () => {
    assert.equal(isPlausibleThreadId(ID), true);
    assert.equal(isPlausibleThreadId("abc12345"), true);
    assert.equal(isPlausibleThreadId(""), false);
    assert.equal(isPlausibleThreadId("  "), false);
    assert.equal(isPlausibleThreadId("../etc/passwd"), false);
    assert.equal(isPlausibleThreadId("a".repeat(65)), false);
    assert.equal(isPlausibleThreadId(undefined), false);
    assert.equal(isPlausibleThreadId(42), false);
  });

  it("reads the thread param from a query string", () => {
    assert.equal(readThreadIdFromSearch(`?thread=${ID}`), ID);
    assert.equal(readThreadIdFromSearch(`thread=${ID}&x=1`), ID);
    assert.equal(readThreadIdFromSearch("?thread=bogus"), null);
    assert.equal(readThreadIdFromSearch("?x=1"), null);
    assert.equal(readThreadIdFromSearch(""), null);
  });

  it("round-trips the stored session id", () => {
    const storage = fakeStorage();
    assert.equal(readStoredSessionId(storage), null);
    storeSessionId(ID, storage);
    assert.equal(readStoredSessionId(storage), ID);
    assert.equal(storage.dump()[LAST_SESSION_STORAGE_KEY], ID);
    storeSessionId(null, storage);
    assert.equal(readStoredSessionId(storage), null);
  });

  it("ignores a corrupted stored id", () => {
    assert.equal(
      readStoredSessionId(fakeStorage({ [LAST_SESSION_STORAGE_KEY]: "///" })),
      null
    );
  });

  it("survives storage that throws or is missing", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    assert.equal(readStoredSessionId(throwing), null);
    assert.doesNotThrow(() =>
      storeSessionId(ID, {
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      })
    );
    assert.equal(readStoredSessionId(null), null);
  });

  it("prefers the URL over the stored session", () => {
    const storage = fakeStorage({ [LAST_SESSION_STORAGE_KEY]: ID });
    const other = "11111111-2222-3333-4444-555555555555";
    assert.equal(
      resolveSessionThreadId({ search: `?thread=${other}`, stored: storage }),
      other
    );
    assert.equal(
      resolveSessionThreadId({ search: `?thread=bogus`, stored: storage }),
      ID
    );
    assert.equal(resolveSessionThreadId({ search: "", stored: storage }), ID);
    assert.equal(
      resolveSessionThreadId({ search: "", stored: fakeStorage() }),
      null
    );
  });

  it("writes and clears the URL param, keeping other params", () => {
    assert.equal(
      withThreadParam({ pathname: "/app", search: "", threadId: ID }),
      `/app?thread=${ID}`
    );
    assert.equal(
      withThreadParam({
        pathname: "/app",
        search: `?thread=${ID}&tab=settings`,
        threadId: null,
      }),
      "/app?tab=settings"
    );
    assert.equal(
      withThreadParam({
        pathname: "/app",
        search: "?tab=settings",
        threadId: ID,
      }),
      `/app?tab=settings&thread=${ID}`
    );
    assert.equal(
      withThreadParam({ pathname: "/app", search: "?thread=old", threadId: null }),
      "/app"
    );
    // An invalid id must never be written.
    assert.equal(
      withThreadParam({ pathname: "/app", search: "", threadId: "nope" }),
      "/app"
    );
  });
});
