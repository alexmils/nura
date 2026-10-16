import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import {
  collectCloudinaryPages,
  mergeCloudinaryInput,
  readSiteMedia,
  rejectUploadSize,
  resolveCloudinaryCredentials,
  signCloudinaryParams,
  sniffMarketingUpload,
} from "../lib/cloudinary.ts";
import { localMarketingPaths, replaceSectionMedia } from "../lib/marketing-sections.ts";

const empty = { cloudName: "", apiKey: "", apiSecret: "" };

describe("cloudinary media", () => {
  it("signs params the way Cloudinary expects", () => {
    assert.equal(
      signCloudinaryParams({ timestamp: "1000", folder: "nura" }, "secret"),
      "e91163baf953d388b323886945c4aeb58723ef28"
    );
  });

  it("uses a full credential set from settings or env, never a mix", () => {
    const env = { cloudName: "env-cloud", apiKey: "env-key", apiSecret: "env-secret" };
    const mixed = resolveCloudinaryCredentials(
      { cloudName: "db-cloud", apiKey: "", apiSecret: "" },
      env
    );
    assert.equal(mixed.source, "env");
    assert.equal(mixed.creds?.cloudName, "env-cloud");
    assert.equal(mixed.creds?.apiKey, "env-key");

    const stored = resolveCloudinaryCredentials(
      { cloudName: "db-cloud", apiKey: "db-key", apiSecret: "db-secret" },
      env
    );
    assert.equal(stored.source, "settings");
    assert.equal(stored.creds?.apiKey, "db-key");
    assert.equal(resolveCloudinaryCredentials(empty, empty).source, "none");
  });

  it("requires a new key and secret when the cloud name changes", () => {
    const current = { cloudName: "old", apiKey: "key", apiSecret: "secret" };
    assert.throws(() => mergeCloudinaryInput(current, { ...current, cloudName: "new", apiKey: "", apiSecret: "" }));
    assert.deepEqual(
      mergeCloudinaryInput(current, { cloudName: "old", apiKey: "", apiSecret: "" }),
      current
    );
    assert.throws(() => mergeCloudinaryInput(empty, { cloudName: "new", apiKey: "", apiSecret: "" }));
  });

  it("rejects an empty or oversized upload before reading it", () => {
    assert.equal(rejectUploadSize(0), "Choose a file.");
    assert.match(rejectUploadSize(25 * 1024 * 1024) ?? "", /24 MB/);
    assert.equal(rejectUploadSize(1024), null);
  });

  it("accepts real image and video bytes and rejects other files", () => {
    assert.equal(sniffMarketingUpload(Buffer.from([0xff, 0xd8, 0xff, 0x00]))?.type, "image/jpeg");
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]);
    assert.equal(sniffMarketingUpload(webm)?.type, "video/webm");
    assert.equal(sniffMarketingUpload(Buffer.from("not an image")), null);
  });

  it("follows every Cloudinary page", async () => {
    const items = await collectCloudinaryPages(async (cursor) => {
      if (!cursor) return { items: ["a"], next: "page-2" };
      return { items: ["b"] };
    });
    assert.deepEqual(items, ["a", "b"]);
  });

  it("refuses a path outside the marketing folder", async () => {
    await assert.rejects(() => readSiteMedia("/marketing/../package.json"));
    await assert.rejects(() => readSiteMedia("https://evil.test/a.jpg"));
  });

  it("rewrites a local path in section copy and drops it from the site list", () => {
    const copy = {
      "home-hero": {
        heroImage: "/marketing/landing/support-talk.jpg",
        heroVideo: "",
        stories: [{ image: "/marketing/landing/support-talk.jpg", name: "Maya" }],
      },
    };
    const next = replaceSectionMedia(copy["home-hero"], "/marketing/landing/support-talk.jpg", "https://res.cloudinary.com/demo/image/upload/v1/nura/a.jpg");
    assert.equal(next.changed, true);
    assert.equal(next.config.heroImage, "https://res.cloudinary.com/demo/image/upload/v1/nura/a.jpg");
    const stories = next.config.stories;
    assert.equal(Array.isArray(stories) && stories[0]?.image, "https://res.cloudinary.com/demo/image/upload/v1/nura/a.jpg");
    assert.deepEqual(localMarketingPaths({ "home-hero": next.config }), []);
    assert.equal(localMarketingPaths(copy)[0]?.path, "/marketing/landing/support-talk.jpg");
  });

  it("requires a platform admin for media uploads", async () => {
    const source = await readFile(new URL("../app/api/admin/marketing-media/route.ts", import.meta.url), "utf8");
    assert.match(source, /requirePlatformAdmin/);
    assert.match(source, /rejectUploadSize\(file\.size\)/);
    assert.match(source, /replaceMarketingMediaPath/);
  });
});
