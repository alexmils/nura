import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cloudinaryErrorMessage, cloudNameProblem, mergeCloudinaryInput, parseCloudinaryUrl } from "../lib/cloudinary";

const empty = { cloudName: "", apiKey: "", apiSecret: "" };

describe("Cloudinary credential checks", () => {
  it("rejects an email or URL as the cloud name", () => {
    assert.match(cloudNameProblem("someone@example.com") ?? "", /email/);
    assert.match(cloudNameProblem("https://res.cloudinary.com/x") ?? "", /URL/);
    assert.equal(cloudNameProblem("dxyz123ab"), null);
    assert.throws(() => mergeCloudinaryInput(empty, { cloudName: "a@b.com", apiKey: "123456789012345", apiSecret: "s" }), /email/);
  });

  it("names the field to check without echoing secrets", () => {
    const secret = "TOPSECRETvalue";
    const msgs = [
      cloudinaryErrorMessage(404, undefined, "wrongcloud"),
      cloudinaryErrorMessage(401, "cloud_name mismatch", "dxyz"),
      cloudinaryErrorMessage(401, "Unknown API key 123", "dxyz"),
      cloudinaryErrorMessage(401, "Invalid Signature", "dxyz"),
      cloudinaryErrorMessage(404, undefined, "a@b.com"),
    ];
    assert.match(msgs[0], /no cloud named "wrongcloud"/);
    assert.match(msgs[1], /different Cloudinary cloud/);
    assert.match(msgs[2], /API key/);
    assert.match(msgs[3], /API secret/);
    assert.match(msgs[4], /email/);
    for (const m of msgs) assert.ok(!m.includes(secret));
  });

  it("accepts the dashboard CLOUDINARY_URL pasted into any field", () => {
    const parsed = parseCloudinaryUrl("cloudinary://123456789012345:abcDEF_123-x@mycloud");
    assert.deepEqual(parsed, { apiKey: "123456789012345", apiSecret: "abcDEF_123-x", cloudName: "mycloud" });
    const merged = mergeCloudinaryInput(empty, { cloudName: "", apiKey: "", apiSecret: "cloudinary://123456789012345:abc@mycloud" });
    assert.equal(merged.cloudName, "mycloud");
    assert.throws(() => mergeCloudinaryInput(empty, { cloudName: "mycloud", apiKey: "not-digits", apiSecret: "x" }), /API key/);
  });

  it("lets a mistyped (invalid) stored cloud name be corrected without re-entering the keys", () => {
    const stored = { cloudName: "me@example.com", apiKey: "123456789012345", apiSecret: "kept" };
    const merged = mergeCloudinaryInput(stored, { cloudName: "realcloud", apiKey: "", apiSecret: "" });
    assert.equal(merged.cloudName, "realcloud");
    assert.equal(merged.apiSecret, "kept");
    assert.throws(() => mergeCloudinaryInput({ ...stored, cloudName: "validcloud" }, { cloudName: "other", apiKey: "", apiSecret: "" }));
  });
});