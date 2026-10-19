import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MEMBER_ON_GATE_MESSAGE,
  STAFF_ON_PUBLIC_MESSAGE,
  countsAsFailure,
  decideGuard,
  ipLockable,
  ipMatchesEntry,
  isPrivateOrInternalIp,
  isValidGuardAddress,
  newGuardSlug,
  parseAddressList,
  roleMayUseSurface,
  slugError,
  wrongSurfaceMessage,
  wrongSurfaceOutcome,
} from "../lib/login-guard-policy.ts";

describe("operator sign-in surface", () => {
  it("keeps staff off the public page and members off the operator page", () => {
    assert.equal(roleMayUseSurface("platform_admin", false), false);
    assert.equal(roleMayUseSurface("support", false), false);
    assert.equal(roleMayUseSurface("platform_admin", true), true);
    assert.equal(roleMayUseSurface("user", false), true);
    assert.equal(roleMayUseSurface("user", true), false);
  });

  it("names the right page for each role", () => {
    assert.equal(wrongSurfaceMessage("platform_admin"), STAFF_ON_PUBLIC_MESSAGE);
    assert.equal(wrongSurfaceMessage("support"), STAFF_ON_PUBLIC_MESSAGE);
    assert.equal(wrongSurfaceMessage("user"), MEMBER_ON_GATE_MESSAGE);
    assert.equal(wrongSurfaceOutcome("platform_admin"), "staff_public");
    assert.equal(wrongSurfaceOutcome("user"), "consumer_gate");
    assert.doesNotMatch(STAFF_ON_PUBLIC_MESSAGE, /\/entry/);
    assert.doesNotMatch(STAFF_ON_PUBLIC_MESSAGE, /invalid email or password/i);
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

  it("does not IP-lock an internal proxy address", () => {
    const decision = decideGuard({
      ...base,
      ip: "10.0.1.1",
      ipFailures: 50,
      ipLocked: true,
    });
    assert.equal(decision.allow, true);
  });

  it("still applies the email lock behind an internal proxy address", () => {
    const decision = decideGuard({
      ...base,
      ip: "10.0.1.1",
      emailFailures: 5,
    });
    assert.equal(decision.allow, false);
    if (!decision.allow) assert.equal(decision.outcome, "locked");
  });

  it("still IP-locks a public address", () => {
    const decision = decideGuard({ ...base, ipFailures: 5 });
    assert.equal(decision.allow, false);
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

describe("countsAsFailure", () => {
  it("counts unproven credentials only", () => {
    assert.equal(countsAsFailure("bad_password"), true);
    assert.equal(countsAsFailure("unknown_user"), true);
    assert.equal(countsAsFailure("disabled"), true);
  });

  it("never counts a wrong-surface refusal", () => {
    assert.equal(countsAsFailure("staff_public"), false);
    assert.equal(countsAsFailure("consumer_gate"), false);
    assert.equal(countsAsFailure("locked"), false);
    assert.equal(countsAsFailure("ok"), false);
  });
});

describe("internal client addresses", () => {
  it("flags loopback, RFC 1918, and ULA addresses", () => {
    for (const ip of [
      "10.0.1.1",
      "172.16.0.1",
      "172.31.255.254",
      "192.168.1.10",
      "127.0.0.1",
      "::1",
      "::ffff:10.0.1.1",
      "fc00::1",
      "fd12:3456::7",
      "[::1]",
    ]) {
      assert.equal(isPrivateOrInternalIp(ip), true, ip);
      assert.equal(ipLockable(ip), false, ip);
    }
  });

  it("keeps public addresses lockable", () => {
    for (const ip of [
      "46.255.74.128",
      "172.32.0.1",
      "172.15.255.255",
      "11.0.0.1",
      "2606:4700::1",
      "fe80::1",
    ]) {
      assert.equal(isPrivateOrInternalIp(ip), false, ip);
    }
    assert.equal(ipLockable("46.255.74.128"), true);
    assert.equal(ipLockable("unknown"), false);
    assert.equal(ipLockable(""), false);
  });
});

describe("newGuardSlug", () => {
  it("is long enough to use as the private path", () => {
    assert.equal(slugError(newGuardSlug()), null);
  });
});
