import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  DEFAULT_CLOUDINARY_ACCOUNT_EMAIL,
  effectiveCloudinaryAccountEmail,
  normalizeCloudinaryAccountEmail,
} from "../lib/cloudinary";

describe("Cloudinary account email (reference note)", () => {
  it("accepts a valid email and trims it", () => {
    assert.equal(normalizeCloudinaryAccountEmail("  me@example.com "), "me@example.com");
  });
  it("allows empty (clears the saved value)", () => {
    assert.equal(normalizeCloudinaryAccountEmail(""), "");
    assert.equal(normalizeCloudinaryAccountEmail("   "), "");
    assert.equal(normalizeCloudinaryAccountEmail(undefined), "");
    assert.equal(normalizeCloudinaryAccountEmail(null), "");
  });
  it("rejects things that are not an email", () => {
    for (const bad of ["dxyz123ab", "me@", "@example.com", "me@example", "a b@example.com", 42]) {
      assert.throws(() => normalizeCloudinaryAccountEmail(bad), /email|text/i, String(bad));
    }
    assert.throws(() => normalizeCloudinaryAccountEmail(`${"a".repeat(250)}@x.io`), /valid email/);
  });
  it("falls back to the built-in default when nothing is saved", () => {
    assert.equal(DEFAULT_CLOUDINARY_ACCOUNT_EMAIL, "hello@alexandermils.com");
    assert.equal(effectiveCloudinaryAccountEmail(""), DEFAULT_CLOUDINARY_ACCOUNT_EMAIL);
    assert.equal(effectiveCloudinaryAccountEmail(undefined), DEFAULT_CLOUDINARY_ACCOUNT_EMAIL);
    assert.equal(effectiveCloudinaryAccountEmail("other@example.com"), "other@example.com");
  });
  it("admin Media > Settings shows the field next to the read-only cloud name, never key/secret values", () => {
    const page = readFileSync(new URL("../app/admin/media/page.tsx", import.meta.url), "utf8");
    assert.match(page, /Cloudinary account email/);
    assert.match(page, /Which Cloudinary login owns this cloud\. For reference only\./);
    assert.match(page, /Current cloud name:/);
    assert.doesNotMatch(page, /status\?\.apiKey|status\?\.apiSecret/);
  });
  it("saving the email is platform-admin only and does not touch credentials", () => {
    const route = readFileSync(new URL("../app/api/admin/cloudinary/route.ts", import.meta.url), "utf8");
    const put = route.slice(route.indexOf("export async function PUT"));
    assert.match(put, /requirePlatformAdmin\(\)/);
    assert.match(put, /saveCloudinaryAccountEmail\(body\.accountEmail\)/);
  });
});