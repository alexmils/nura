import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { passwordChangeError } from "../lib/auth/password-change.ts";

describe("passwordChangeError", () => {
  it("sets a first password for a Google-only account without a current one", () => {
    assert.equal(
      passwordChangeError({ hasPassword: false, newPassword: "calmriver12" }),
      null
    );
  });

  it("enforces the shared password rules", () => {
    assert.match(
      passwordChangeError({ hasPassword: false, newPassword: "short1" }) ?? "",
      /at least 8/i
    );
    assert.match(
      passwordChangeError({ hasPassword: false, newPassword: "nodigits" }) ?? "",
      /letter and one number/i
    );
  });

  it("requires the current password when one exists", () => {
    assert.match(
      passwordChangeError({ hasPassword: true, newPassword: "calmriver12" }) ??
        "",
      /current password/i
    );
  });

  it("rejects a wrong current password", () => {
    assert.match(
      passwordChangeError({
        hasPassword: true,
        currentPassword: "wrongpass1",
        currentPasswordMatches: false,
        newPassword: "calmriver12",
      }) ?? "",
      /incorrect/i
    );
  });

  it("rejects reusing the same password", () => {
    assert.match(
      passwordChangeError({
        hasPassword: true,
        currentPassword: "calmriver12",
        currentPasswordMatches: true,
        newPassword: "calmriver12",
      }) ?? "",
      /different/i
    );
  });

  it("allows a valid change", () => {
    assert.equal(
      passwordChangeError({
        hasPassword: true,
        currentPassword: "calmriver12",
        currentPasswordMatches: true,
        newPassword: "quietforest34",
      }),
      null
    );
  });
});
