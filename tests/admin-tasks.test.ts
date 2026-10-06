import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_TASK_STATUSES,
  adminTaskMediaUrl,
  normalizeTaskBody,
  normalizeTaskLabel,
  normalizeTaskStatus,
} from "../lib/admin-tasks.ts";
import { imageFileFromClipboard } from "../lib/clipboard-image.ts";
import { buildAdminSearchIndex } from "../lib/admin-nav.ts";

describe("admin task helpers", () => {
  it("covers board statuses", () => {
    assert.deepEqual(
      [...ADMIN_TASK_STATUSES],
      ["pending", "idea", "in_progress", "completed"]
    );
  });

  it("normalizes status variants", () => {
    assert.equal(normalizeTaskStatus("Idea"), "idea");
    assert.equal(normalizeTaskStatus("in-progress"), "in_progress");
    assert.equal(normalizeTaskStatus("in progress"), "in_progress");
    assert.throws(() => normalizeTaskStatus("done"));
  });

  it("normalizes label and body", () => {
    assert.equal(normalizeTaskLabel("  ui  "), "ui");
    assert.equal(normalizeTaskLabel(""), null);
    assert.throws(() => normalizeTaskLabel("x".repeat(65)));
    assert.equal(normalizeTaskBody(" Ship it "), "Ship it");
    assert.throws(() => normalizeTaskBody("   "));
  });

  it("builds media urls", () => {
    assert.equal(
      adminTaskMediaUrl("abc.jpg"),
      "/api/admin/tasks/media/abc.jpg"
    );
  });
});

describe("clipboard image helper", () => {
  it("returns null without image items", () => {
    assert.equal(imageFileFromClipboard(null), null);
  });
});

describe("admin search includes Tasks", () => {
  it("lists Tasks page for platform admin", () => {
    const index = buildAdminSearchIndex(true);
    assert.ok(index.some((e) => e.href === "/admin/tasks" && e.title === "Tasks"));
  });
});
