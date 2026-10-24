import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("admin single-user page layout (WordPress-style)", () => {
  const page = read("app/admin/users/[id]/page.tsx");
  const css = read("app/components/admin/admin-user-layout.css");

  it("wide main column first, narrow sidebar second", () => {
    const main = page.indexOf('className="admin-user-main"');
    const side = page.indexOf('className="admin-user-side"');
    assert.ok(main > 0 && side > main, "main column comes before the sidebar in the DOM");
  });

  it("main column holds the long tables and activity", () => {
    const main = page.slice(page.indexOf('className="admin-user-main"'), page.indexOf('className="admin-user-side"'));
    for (const piece of ["<UserAgentHealthPanel", "<AdminUserWinbackActivity", "Billing / payments", "Login history"]) {
      assert.ok(main.includes(piece), piece);
    }
  });

  it("sidebar has Profile, Subscription and Win-back boxes", () => {
    const side = page.slice(page.indexOf('className="admin-user-side"'));
    assert.match(side, /admin-user-box-head">Profile</);
    assert.match(side, /admin-user-box-head">Subscription</);
    assert.match(side, /<AdminUserWinbackBox state=\{winback\} canWrite=\{canWrite\} \/>/);
    assert.match(side, /Ignore in stats/);
    assert.match(side, /Disable user/);
  });

  it("one win-back state shared by the box and the activity panel", () => {
    assert.equal((page.match(/useUserWinback\(userId\)/g) ?? []).length, 1);
  });

  it("CSS: separate file, two columns from 1100px, sticky sidebar", () => {
    assert.match(css, /@media \(min-width: 1100px\)/);
    assert.match(css, /grid-template-columns: minmax\(0, 1fr\) clamp\(320px, 26vw, 360px\)/);
    assert.match(css, /position: sticky/);
    assert.doesNotMatch(read("app/globals.css"), /admin-user-layout/);
  });

  it("win-back and problem-report buttons use real admin button classes", () => {
    for (const f of [
      "app/components/admin/AdminUserWinbackCard.tsx",
      "app/components/admin/AdminProblemReportsPanel.tsx",
      "app/components/admin/WinbackEmailEditor.tsx",
    ]) {
      const src = read(f);
      assert.doesNotMatch(src, /className="admin-btn"/, f);
    }
    const panel = read("app/components/admin/AdminProblemReportsPanel.tsx");
    assert.match(panel, /admin-segmented-btn admin-segmented-btn-active/);
  });
});
