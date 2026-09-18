import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  UNRELEASED_PUBLIC_CAP,
  formatPublicChangelogItem,
  isInternalChangelogItem,
  loadPublicChangelog,
  parseChangelogMarkdown,
} from "../lib/changelog-public.ts";
import { isFrontendPublicPath } from "../lib/public-paths.ts";

const SAMPLE = `# Changelog

## [Unreleased]

### Added
- Password show/hide on login
- [internal] Cursor rule for the changelog page
- Cursor rule \`.cursor/rules/foo.mdc\` — hide this
- **Session header** description you can edit

### Changed
- Login passkey hint spacing
- Admin Email templates sidebar

### Fixed
- App Help flyout clipped
- Guided BLS: Space/click only start a set

### Removed
- Design lab \`/design/voice-composer\`

## [0.1.0] - 2026-08-01

### Added
- First public session workspace
`;

describe("changelog public parse", () => {
  it("hides admin, platform, and marketing — keeps in-app user features", () => {
    assert.equal(isInternalChangelogItem("Password show/hide on login"), false);
    assert.equal(
      isInternalChangelogItem("**Session header** description you can edit"),
      false
    );
    assert.equal(
      isInternalChangelogItem("[internal] Cursor rule for the changelog page"),
      true
    );
    assert.equal(
      isInternalChangelogItem(
        "Cursor rule `.cursor/rules/foo.mdc` — hide this"
      ),
      true
    );
    assert.equal(
      isInternalChangelogItem("**Admin Last 7 days chart**: bars sit on a baseline"),
      true
    );
    assert.equal(
      isInternalChangelogItem(
        "Meta Pixel conversion events: CompleteRegistration (email + Google signup)"
      ),
      true
    );
    assert.equal(
      isInternalChangelogItem(
        "Blog index: wider masonry scatter, date + min-read meta"
      ),
      true
    );
    assert.equal(
      isInternalChangelogItem(
        "Public content split: /learn is the start-here hub"
      ),
      true
    );
    assert.equal(
      isInternalChangelogItem("[public] Coolify env now has VAPID keys"),
      false
    );
    assert.equal(
      isInternalChangelogItem(
        "Cursor rule changelog-split — classify public vs internal bullets"
      ),
      true
    );
  });

  it("rewrites BLS and strips markdown for the public page", () => {
    assert.equal(
      formatPublicChangelogItem("Trial includes 10 minutes of free BLS"),
      "Trial includes 10 minutes of self-guided set time"
    );
    assert.match(
      formatPublicChangelogItem("**Session header** (`threads.description`)"),
      /Session header/
    );
    assert.doesNotMatch(
      formatPublicChangelogItem("**Session header** (`AppShell.tsx`)"),
      /\.tsx/
    );
  });

  it("maps Keep a Changelog sections to New / Improved / Fixed", () => {
    const releases = parseChangelogMarkdown(SAMPLE);
    assert.equal(releases.length, 2);
    const now = releases[0];
    assert.equal(now.unreleased, true);
    assert.equal(now.kindLabel, "Feature release");
    assert.equal(now.dateLabel, "Now");
    const added = now.sections.find((s) => s.kind === "added");
    assert.deepEqual(added?.items.slice(0, 2), [
      "Session header description you can edit",
      "Password show/hide on login",
    ]);
    assert.ok(!added?.items.some((t) => /cursor rule/i.test(t)));
    const changed = now.sections.find((s) => s.kind === "changed");
    assert.deepEqual(changed?.items, ["Login passkey hint spacing"]);
    const fixed = now.sections.find((s) => s.kind === "fixed");
    assert.ok(fixed?.items.some((t) => /Help flyout/i.test(t)));
    assert.ok(fixed?.items.every((t) => !/\bBLS\b/.test(t)));
    const first = releases[1];
    assert.equal(first.versionLabel, "0.1.0");
    assert.equal(first.dateLabel, "August 2026");
    assert.equal(first.dateIso, "2026-08-01");
  });

  it("caps Unreleased to the newest items per section", () => {
    const many = Array.from(
      { length: 12 },
      (_, i) => `- Session note ${i + 1}`
    ).join("\n");
    const releases = parseChangelogMarkdown(
      `## [Unreleased]\n\n### Added\n${many}\n`
    );
    assert.equal(releases[0]?.sections[0]?.items.length, UNRELEASED_PUBLIC_CAP);
    assert.equal(releases[0]?.sections[0]?.items[0], "Session note 12");
  });

  it("reads the repo CHANGELOG.md into at least one public release", () => {
    const releases = loadPublicChangelog();
    assert.ok(releases.length >= 1, "expected Unreleased");
    const items = releases.flatMap((r) =>
      r.sections.flatMap((s) => s.items)
    );
    assert.ok(items.length >= 4, `got ${items.length} public items`);
    for (const section of releases[0].sections) {
      assert.ok(section.items.length <= UNRELEASED_PUBLIC_CAP);
    }
    for (const text of items) {
      assert.doesNotMatch(text, /\bBLS\b/);
      assert.doesNotMatch(text, /NuraHelp/);
      assert.doesNotMatch(text, /\[internal\]/i);
      assert.doesNotMatch(text, /\bAdmin\b/);
      assert.doesNotMatch(text, /Meta Pixel/i);
      assert.doesNotMatch(text, /\/learn/);
    }
  });
});

describe("changelog route", () => {
  it("is a public frontend path", () => {
    assert.equal(isFrontendPublicPath("/changelog"), true);
  });
});
