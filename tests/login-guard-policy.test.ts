import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideGuard,
  ipMatchesEntry,
  isValidGuardAddress,
  newGuardSlug,
  parseAddressList,
  roleMayUseSurface,
  slugError,
} from "../lib/login-guard-policy.ts";

describe("operator sign-in surface", () => {
  it("keeps staff off the public page and members off the operator page", () => {
    assert.equal(roleMayUseSurface("platform_admin", false), false);
    assert.equal(roleMayUseSurface("support", false), false);
    assert.equal(roleMayUseSurface("platform_admin", true), true);
    assert.equal(roleMayUseSurface("user", false), true);
    assert.equal(roleMayUseSurface("user", true), false);
  });

  it("rejects short slugs", () => {
    assert.ok(slugError("admin"));
    assert.equal(slugError("abcdefghijklmnop"), null);
  });
});

describe("address lists", () => {
  it("matches an address and a CIDR range", () => {
    assert.equal(ipMatchesEntry("203.0.113.9", "203.0.113.9"), true);
    assert.equal(ipMatchesEntry("203.0.113.9", "203.0.113.0/24"), true);
    assert.equal(ipMatchesEntry("198.51.100.9", "203.0.113.0/24"), false);
    assert.equal(isValidGuardAddress("0.0.0.0/0"), false);
  });

  it("rejects a bad line", () => {
    const parsed = parseAddressList("203.0.113.1\nnot-an-ip");
    assert.equal(parsed.ok, false);
  });
});

describe("decideGuard", () => {
  const base = {
    ip: "203.0.113.9",
    whitelist: [] as string[],
    blocklist: [] as string[],
    maxAttempts: 5,
    ipFailures: 0,
    emailFailures: 0,
    ipLocked: false,
    emailLocked: false,
  };

  it("blocks a listed address before counting attempts", () => {
    const decision = decideGuard({ ...base, blocklist: ["203.0.113.9"] });
    assert.equal(decision.allow, false);
    if (!decision.allow) assert.equal(decision.outcome, "blocked_ip");
  });

  it("lets a whitelist address through a block and a lock", () => {
    const decision = decideGuard({
      ...base,
      whitelist: ["203.0.113.0/24"],
      blocklist: ["203.0.113.9"],
      ipLocked: true,
      emailFailures: 9,
    });
    assert.equal(decision.allow, true);
  });

  it("locks after the attempt budget", () => {
    const decision = decideGuard({ ...base, emailFailures: 5 });
    assert.equal(decision.allow, false);
    if (!decision.allow) assert.equal(decision.status, 429);
  });

  it("does not treat a missing proxy address as one shared IP lock", () => {
    const decision = decideGuard({
      ...base,
      ip: "unknown",
      ipFailures: 20,
    });
    assert.equal(decision.allow, true);
  });
});

describe("newGuardSlug", () => {
  it("is long enough to use as the private path", () => {
    assert.equal(slugError(newGuardSlug()), null);
  });
});
