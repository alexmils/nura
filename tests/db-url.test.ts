import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDatabaseUrl } from "@/lib/db";

describe("resolveDatabaseUrl", () => {
  it("rewrites localhost to 127.0.0.1 on Windows", () => {
    if (process.platform !== "win32") return;
    assert.equal(
      resolveDatabaseUrl("postgresql://emdr:emdr@localhost:5434/emdr"),
      "postgresql://emdr:emdr@127.0.0.1:5434/emdr"
    );
    assert.equal(
      resolveDatabaseUrl("postgresql://emdr:emdr@[::1]:5434/emdr"),
      "postgresql://emdr:emdr@127.0.0.1:5434/emdr"
    );
  });

  it("leaves remote hosts unchanged", () => {
    const remote = "postgresql://nura:secret@db.internal:5432/nura";
    assert.equal(resolveDatabaseUrl(remote), remote);
  });
});
