import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  helpChatProblemDecision,
  isProblemSource,
  PROBLEM_SOURCE_LABEL,
  PROBLEM_SOURCES,
  problemReportAckLine,
} from "../lib/problem-report-rules";
import { offerSourceAllowsExtension } from "../lib/reactivation-rules";

describe("problem report sources", () => {
  it("knows the three sources and labels them", () => {
    assert.deepEqual([...PROBLEM_SOURCES], ["guide_session", "help_chat", "admin"]);
    assert.equal(PROBLEM_SOURCE_LABEL.help_chat, "Help chat");
    assert.equal(PROBLEM_SOURCE_LABEL.guide_session, "AI guide session");
    assert.ok(isProblemSource("help_chat"));
    assert.ok(!isProblemSource("email"));
    assert.ok(!isProblemSource(null));
  });
});

describe("help chat -> problem report decision", () => {
  const cases: [string, string, string][] = [
    ["The page won't load", "en", "I have passed this on"],
    ["Ich habe keinen Ton", "de", "Ich habe das als technisches Problem"],
    ["El bot\u00f3n no funciona", "es", "He enviado esto"],
    ["Il pulsante non funziona", "it", "Ho inoltrato"],
    ["L'application plante", "fr", "J'ai transmis"],
    ["Ne vidim lopticu", "sr", "Prijava tehni\u010dkog problema"],
  ];
  for (const [text, lang, ack] of cases) {
    it(`reports and confirms in ${lang}: ${text}`, () => {
      const d = helpChatProblemDecision(text);
      assert.ok(d, text);
      assert.equal(d.language, lang);
      assert.ok(d.ackLine.startsWith(ack), d.ackLine);
    });
  }
  it("falls back to English for unknown language", () => {
    assert.equal(problemReportAckLine(null), problemReportAckLine("en"));
    assert.equal(problemReportAckLine("pt"), problemReportAckLine("en"));
  });
  it("ignores emotional and normal help questions", () => {
    assert.equal(helpChatProblemDecision("How do I cancel my subscription?"), null);
    assert.equal(helpChatProblemDecision("I feel stuck"), null);
    assert.equal(helpChatProblemDecision(""), null);
    assert.equal(helpChatProblemDecision(undefined), null);
  });
  it("never on crisis messages, even with a tech complaint", () => {
    assert.equal(helpChatProblemDecision("The app crashed and I want to kill myself"), null);
    assert.equal(helpChatProblemDecision("Die App ist abgest\u00fcrzt, ich will mich umbringen"), null);
  });
});

describe("win-back link sources", () => {
  it("problem-report and user-page links may extend a paying subscription", () => {
    assert.ok(offerSourceAllowsExtension("problem_report"));
    assert.ok(offerSourceAllowsExtension("admin_user"));
  });
  it("Win-back tab and older links keep the lapsed-only rule", () => {
    assert.ok(!offerSourceAllowsExtension("winback_tab"));
    assert.ok(!offerSourceAllowsExtension(null));
    assert.ok(!offerSourceAllowsExtension(undefined));
  });
});

describe("wiring", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  it("help chat: signed-in users get a report + confirmation line", () => {
    const src = read("app/api/help/chat/route.ts");
    const calls = src.match(/noteHelpChatProblem\(/g) ?? [];
    assert.equal(calls.length, 1, "only the signed-in path records problems");
    assert.match(src, /noteHelpChatProblem\(\{\s*userId: input\.userId/);
    assert.equal((src.match(/ackLine: problemAck\?\.ackLine/g) ?? []).length, 1);
  });
  it("help chat: signed-out visitors get no report and no confirmation line", () => {
    const route = read("app/api/help/chat/route.ts");
    const guest = route.slice(route.indexOf("export async function POST"), route.indexOf("async function handleUserPost"));
    assert.ok(guest.length > 0);
    assert.doesNotMatch(guest, /noteHelpChatProblem|problemAck|ackLine/);
    const hook = read("lib/help-problem-report.ts");
    assert.match(hook, /source: "help_chat"/);
    assert.match(hook, /if \(!input\.userId\) return null;/);
    assert.doesNotMatch(hook, /guestEmail|getUserByEmail|unverified/);
  });
  it("noteHelpChatProblem returns null without a signed-in user (no DB touched)", async () => {
    const { noteHelpChatProblem } = await import("../lib/help-problem-report");
    assert.equal(await noteHelpChatProblem({ userId: null, helpThreadId: "h1", text: "The page won't load" }), null);
    assert.equal(await noteHelpChatProblem({ userId: undefined, helpThreadId: "h1", text: "The app crashed" }), null);
  });
  it("admin user page shows the win-back box", () => {
    const src = read("app/admin/users/[id]/page.tsx");
    assert.match(src, /<AdminUserWinbackBox state=\{winback\} canWrite=\{canWrite\} \/>/);
  });
  it("user-page writes go through platform-admin write auth", () => {
    const src = read("app/api/admin/reactivation/route.ts");
    assert.match(src, /requirePlatformAdminWrite/);
    assert.match(src, /"user_generate"/);
    assert.match(src, /"user_send"/);
  });
  it("problem reports API filters by user", () => {
    const src = read("app/api/admin/problem-reports/route.ts");
    assert.match(src, /searchParams\.get\("userId"\)/);
  });
  it("schema adds the source columns and win-back email history", () => {
    const src = read("lib/db.ts");
    assert.match(src, /ALTER TABLE problem_reports ADD COLUMN IF NOT EXISTS source TEXT/);
    assert.match(src, /ALTER TABLE reactivation_offers ADD COLUMN IF NOT EXISTS source TEXT/);
    assert.match(src, /CREATE TABLE IF NOT EXISTS winback_emails/);
  });
});
