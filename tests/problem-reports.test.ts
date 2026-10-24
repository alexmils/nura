import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProblemAlertEmail,
  buildWinbackEmailDraft,
  canGenerateWinback,
  canTransitionProblemReport,
  detectAppProblem,
  mergeProblemExcerpt,
  parseAdminAlertEnv,
  problemExcerpt,
  problemTextToHtml,
  redactWinbackToken,
  shouldMergeProblemReport,
  shouldSendProblemAlert,
  tokenFromWinbackBody,
  validateWinbackEmail,
} from "../lib/problem-report-rules";

const POSITIVE: [string, string, string][] = [
  // [text, language, category]
  ["I can't see the ball", "en", "ball"],
  ["The ball is stuck and not moving", "en", "ball"],
  ["the dot doesn't move at all", "en", "ball"],
  ["There's no sound", "en", "audio"],
  ["I can't hear you", "en", "audio"],
  ["The audio is not working", "en", "audio"],
  ["The page won't load", "en", "loading"],
  ["I just get a blank screen", "en", "loading"],
  ["The start button doesn't work", "en", "button"],
  ["Nothing happens when I click start", "en", "button"],
  ["The app crashed", "en", "crash"],
  ["I keep getting an error", "en", "crash"],
  ["Ich sehe den Ball nicht", "de", "ball"],
  ["Die Kugel bewegt sich nicht", "de", "ball"],
  ["Ich habe keinen Ton", "de", "audio"],
  ["Die Seite l\u00e4dt nicht", "de", "loading"],
  ["Der Knopf funktioniert nicht", "de", "button"],
  ["Die App ist abgest\u00fcrzt", "de", "crash"],
  ["No veo la pelota", "es", "ball"],
  ["La pelota no se mueve", "es", "ball"],
  ["No se oye el sonido", "es", "audio"],
  ["La p\u00e1gina no carga", "es", "loading"],
  ["El bot\u00f3n no funciona", "es", "button"],
  ["La aplicaci\u00f3n se cuelga", "es", "crash"],
  ["Non vedo la pallina", "it", "ball"],
  ["La palla \u00e8 bloccata", "it", "ball"],
  ["Non si sente il suono", "it", "audio"],
  ["La pagina non si carica", "it", "loading"],
  ["Il pulsante non funziona", "it", "button"],
  ["L'app si blocca sempre", "it", "crash"],
  ["Je ne vois pas la balle", "fr", "ball"],
  ["La boule ne bouge pas", "fr", "ball"],
  ["Il n'y a pas de son", "fr", "audio"],
  ["La page ne se charge pas", "fr", "loading"],
  ["Le bouton ne marche pas", "fr", "button"],
  ["L'application plante", "fr", "crash"],
  ["Ne vidim lopticu", "sr", "ball"],
  ["Loptica se ne pomera", "sr", "ball"],
  ["Ne \u010dujem zvuk", "sr", "audio"],
  ["Stranica se ne u\u010ditava", "sr", "loading"],
  ["Dugme ne radi", "sr", "button"],
  ["Aplikacija ne radi", "sr", "crash"],
];

const NEGATIVE = [
  "I can't see a way out",
  "I feel stuck",
  "I'm stuck in this memory and it won't move",
  "This session I feel stuck",
  "My mind froze when I thought about it",
  "Nothing works in my life",
  "I can't hear my own voice anymore",
  "I have no voice in my family",
  "There is a ball of anxiety in my chest and it is stuck",
  "I feel frozen",
  "My heart is broken",
  "I'm dying to try it",
  "Ich sehe keinen Ausweg",
  "Ich f\u00fchle mich blockiert",
  "No veo salida",
  "Me siento atascado",
  "No tengo voz",
  "Non vedo via d'uscita",
  "Mi sento bloccato",
  "Je ne vois pas d'issue",
  "Je me sens bloqu\u00e9",
  "Ne vidim izlaz",
  "Ose\u0107am se zaglavljeno",
  "Napravio sam gre\u0161ku",
  "Don't bug me about it",
  "",
];

describe("detectAppProblem", () => {
  for (const [text, language, category] of POSITIVE) {
    it(`matches ${language}: ${text}`, () => {
      const m = detectAppProblem(text);
      assert.ok(m, `expected a match for "${text}"`);
      assert.equal(m.category, category, text);
      assert.equal(m.language, language, text);
    });
  }
  for (const text of NEGATIVE) {
    it(`ignores: ${text || "(empty)"}`, () => {
      assert.equal(detectAppProblem(text), null, text);
    });
  }
  it("shared tech words have no language", () => {
    assert.deepEqual(detectAppProblem("I think there is a bug"), { category: "crash", language: null });
  });
  it("never throws on odd input", () => {
    assert.equal(detectAppProblem(undefined), null);
    assert.equal(detectAppProblem(null), null);
    assert.equal(detectAppProblem(42 as unknown as string), null);
  });
});

describe("excerpts", () => {
  it("trims to the budget on a word boundary", () => {
    const long = "word ".repeat(200);
    const e = problemExcerpt(long, 500);
    assert.ok(e.length <= 500);
    assert.ok(e.endsWith("\u2026"));
  });
  it("merges a new message without repeating", () => {
    const a = mergeProblemExcerpt("I can't see the ball", "still no ball");
    assert.match(a, /I can't see the ball\n\u2014\nstill no ball/);
    assert.equal(mergeProblemExcerpt(a, "still no ball"), a);
    const big = mergeProblemExcerpt("x ".repeat(240), "the newest complaint", 500);
    assert.ok(big.length <= 500);
    assert.match(big, /the newest complaint$/);
  });
});

describe("dedupe and rate limit", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const base = { userId: "u1", threadId: "t1", status: "new" as const, lastDetectedAt: "2026-10-24T09:00:00Z" };
  it("merges same user + session within 6h", () => {
    assert.equal(shouldMergeProblemReport(base, { userId: "u1", threadId: "t1", now }), true);
  });
  it("does not merge after 6h, other session, other user or closed report", () => {
    assert.equal(shouldMergeProblemReport({ ...base, lastDetectedAt: "2026-10-24T05:59:00Z" }, { userId: "u1", threadId: "t1", now }), false);
    assert.equal(shouldMergeProblemReport(base, { userId: "u1", threadId: "t2", now }), false);
    assert.equal(shouldMergeProblemReport(base, { userId: "u2", threadId: "t1", now }), false);
    assert.equal(shouldMergeProblemReport({ ...base, status: "dismissed" }, { userId: "u1", threadId: "t1", now }), false);
    assert.equal(shouldMergeProblemReport({ ...base, status: "winback_sent" }, { userId: "u1", threadId: "t1", now }), false);
    assert.equal(shouldMergeProblemReport(null, { userId: "u1", threadId: "t1", now }), false);
  });
  it("merges into a confirmed report", () => {
    assert.equal(shouldMergeProblemReport({ ...base, status: "confirmed" }, { userId: "u1", threadId: "t1", now }), true);
  });
  it("alerts at most once per 6h", () => {
    assert.equal(shouldSendProblemAlert(null, now), true);
    assert.equal(shouldSendProblemAlert("2026-10-24T07:00:00Z", now), false);
    assert.equal(shouldSendProblemAlert("2026-10-24T06:00:00Z", now), true);
  });
});

describe("status transitions", () => {
  it("allows the admin flow", () => {
    assert.ok(canTransitionProblemReport("new", "confirmed"));
    assert.ok(canTransitionProblemReport("new", "dismissed"));
    assert.ok(canTransitionProblemReport("confirmed", "dismissed"));
    assert.ok(canTransitionProblemReport("dismissed", "new"));
    assert.ok(canTransitionProblemReport("confirmed", "winback_sent"));
  });
  it("blocks the rest", () => {
    assert.equal(canTransitionProblemReport("new", "winback_sent"), false);
    assert.equal(canTransitionProblemReport("winback_sent", "new"), false);
    assert.equal(canTransitionProblemReport("winback_sent", "dismissed"), false);
    assert.equal(canTransitionProblemReport("new", "new"), false);
  });
  it("only a confirmed report gets a win-back", () => {
    assert.equal(canGenerateWinback("confirmed"), true);
    assert.equal(canGenerateWinback("new"), false);
    assert.equal(canGenerateWinback("dismissed"), false);
    assert.equal(canGenerateWinback("winback_sent"), false);
  });
});

describe("emails", () => {
  const link = "https://dev.nurahelp.com/reactivate?token=abcDEF123_-abcDEF123_-abcDEF123_-xyz";
  it("renders the admin alert", () => {
    const e = buildProblemAlertEmail({
      userEmail: "a@b.co",
      userName: "Ana <script>",
      detectedAt: new Date("2026-10-24T00:31:00Z"),
      category: "ball",
      language: "sr",
      excerpt: "Ne vidim lopticu",
      adminUrl: "https://dev.nurahelp.com/admin/billing?tab=problems",
    });
    assert.match(e.subject, /^Problem report: a@b\.co/);
    assert.match(e.text, /Time: 2026-10-24 00:31 UTC/);
    assert.match(e.text, /Ne vidim lopticu/);
    assert.match(e.text, /admin\/billing\?tab=problems/);
    assert.doesNotMatch(e.html, /<script>/);
    assert.match(e.html, /&lt;script&gt;/);
  });
  it("renders the win-back draft with the link", () => {
    const d = buildWinbackEmailDraft({ to: "a@b.co", name: "Ana Petrovic", link, expiresAt: new Date("2026-11-23T00:00:00Z") });
    assert.equal(d.to, "a@b.co");
    assert.equal(d.subject, "30 days of Nura on us");
    assert.match(d.body, /^Hi Ana,/);
    assert.ok(d.body.includes(link));
    assert.match(d.body, /November 23, 2026/);
    assert.match(problemTextToHtml(d.body), /<a href="https:\/\/dev\.nurahelp\.com\/reactivate\?token=/);
    assert.match(buildWinbackEmailDraft({ to: "x@y.z", link, expiresAt: new Date() }).body, /^Hi there,/);
  });
  it("finds, validates and redacts the token", () => {
    const body = `Hello\n\n${link}\n\nBye`;
    assert.equal(tokenFromWinbackBody(body), "abcDEF123_-abcDEF123_-abcDEF123_-xyz");
    assert.match(redactWinbackToken(body), /reactivate\?token=\[redacted\]/);
    assert.ok(validateWinbackEmail({ subject: "Hi", body }).ok);
    assert.equal(validateWinbackEmail({ subject: "Hi", body: "no link" }).ok, false);
    assert.equal(validateWinbackEmail({ subject: " ", body }).ok, false);
  });
  it("reads ADMIN_ALERT_EMAIL", () => {
    assert.deepEqual(parseAdminAlertEnv(undefined), { mode: "default" });
    assert.deepEqual(parseAdminAlertEnv("off"), { mode: "off" });
    assert.deepEqual(parseAdminAlertEnv("A@x.io, b@y.io"), { mode: "list", emails: ["a@x.io", "b@y.io"] });
  });
});
