import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compactAttribution,
  gaClientIdFromCookie,
  googleClickId,
  mergeAttribution,
  parseAttributionCookie,
  parseAttributionSources,
  parseCookieHeader,
  readAttributionFromCookieHeader,
  ATTRIBUTION_COOKIE,
  type AttributionSnapshot,
} from "@/lib/attribution";

const NOW = "2026-09-21T10:00:00.000Z";

describe("attribution parsing", () => {
  it("reads click ids, cookies and UTMs from a landing request", () => {
    const snapshot = parseAttributionSources({
      search: "?gclid=TeSt-Gclid_1&utm_source=google&utm_medium=cpc&utm_campaign=emdr",
      cookies: {
        _ga: "GA1.1.1234567890.1758448800",
        _fbp: "fb.1.1758448800000.987654321",
      },
      href: "https://nurahelp.com/",
      referrer: "https://www.google.com/",
      now: NOW,
    });

    assert.equal(snapshot.gclid, "TeSt-Gclid_1");
    assert.equal(snapshot.gaClientId, "1234567890.1758448800");
    assert.equal(snapshot.fbp, "fb.1.1758448800000.987654321");
    assert.equal(snapshot.utmSource, "google");
    assert.equal(snapshot.utmCampaign, "emdr");
    assert.equal(snapshot.landingPage, "https://nurahelp.com/");
    assert.equal(snapshot.capturedAt, NOW);
  });

  it("derives an fbc value from fbclid", () => {
    const snapshot = parseAttributionSources({
      search: "?fbclid=IwAR1234567890",
      now: NOW,
    });
    assert.equal(snapshot.fbclid, "IwAR1234567890");
    assert.equal(snapshot.fbc, `fb.1.${Date.parse(NOW)}.IwAR1234567890`);
  });

  it("falls back to the Google ads cookie when the URL has no gclid", () => {
    const snapshot = parseAttributionSources({
      search: "",
      cookies: { _gcl_aw: "GCL.1758448800.Cj0KCQjw_from_cookie" },
      now: NOW,
    });
    assert.equal(snapshot.gclid, "Cj0KCQjw_from_cookie");
  });

  it("drops junk instead of storing it", () => {
    const snapshot = parseAttributionSources({
      search: `?gclid=${"x".repeat(400)}&utm_source=${"y".repeat(400)}`,
      href: "https://nurahelp.com/",
      now: NOW,
    });
    assert.equal(snapshot.gclid, undefined);
    assert.equal(snapshot.utmSource?.length, 300);
  });

  it("parses the GA4 client id out of the _ga cookie", () => {
    assert.equal(
      gaClientIdFromCookie("GA1.1.1234567890.1758448800"),
      "1234567890.1758448800"
    );
    assert.equal(gaClientIdFromCookie("GA1.2.1234567890.1758448800"), "1234567890.1758448800");
    assert.equal(gaClientIdFromCookie("nonsense"), undefined);
    assert.equal(gaClientIdFromCookie("GA1.1.notanumber"), undefined);
  });
});

describe("attribution merge", () => {
  const first: AttributionSnapshot = {
    gclid: "first-click",
    gaClientId: "111.222",
    utmSource: "google",
    capturedAt: NOW,
  };

  it("keeps the first click for the whole window", () => {
    const merged = mergeAttribution(first, {
      gclid: "second-click",
      gaClientId: "333.444",
      capturedAt: "2026-09-25T10:00:00.000Z",
    });
    assert.equal(merged.gclid, "first-click");
    assert.equal(merged.utmSource, "google");
    assert.equal(merged.capturedAt, NOW);
  });

  it("refreshes device identifiers and the consent decision", () => {
    const merged = mergeAttribution(first, {
      gaClientId: "333.444",
      fbp: "fb.1.1.2",
      consent: { analytics: false, marketing: false },
      capturedAt: "2026-09-25T10:00:00.000Z",
    });
    assert.equal(merged.gaClientId, "333.444");
    assert.equal(merged.fbp, "fb.1.1.2");
    assert.deepEqual(merged.consent, { analytics: false, marketing: false });
  });

  it("fills in a click id that arrives later", () => {
    const merged = mergeAttribution({ gaClientId: "1.2" }, { gclid: "late-click" });
    assert.equal(merged.gclid, "late-click");
    assert.equal(merged.gaClientId, "1.2");
  });
});

describe("attribution cookie", () => {
  it("round-trips a snapshot including consent", () => {
    const raw = encodeURIComponent(
      JSON.stringify({ gclid: "abc12345", consent: { analytics: true, marketing: false } })
    );
    const parsed = parseAttributionCookie(decodeURIComponent(raw));
    assert.equal(parsed?.gclid, "abc12345");
    assert.deepEqual(parsed?.consent, { analytics: true, marketing: false });
  });

  it("rejects malformed or empty cookie values", () => {
    assert.equal(parseAttributionCookie("not json"), null);
    assert.equal(parseAttributionCookie(""), null);
    assert.equal(parseAttributionCookie(JSON.stringify({})), null);
  });

  it("ignores a consent object with the wrong shape", () => {
    const parsed = parseAttributionCookie(
      JSON.stringify({ gclid: "abc12345", consent: { analytics: "yes" } })
    );
    assert.equal(parsed?.gclid, "abc12345");
    assert.equal(parsed?.consent, undefined);
  });

  it("reads the cookie out of a raw Cookie header", () => {
    const header = `other=1; ${ATTRIBUTION_COOKIE}=${encodeURIComponent(
      JSON.stringify({ fbclid: "IwAR9999999" })
    )}; theme=dark`;
    const snapshot = readAttributionFromCookieHeader(header);
    assert.equal(snapshot?.fbclid, "IwAR9999999");
    assert.equal(readAttributionFromCookieHeader("other=1"), null);
  });
});

describe("cookie header parsing", () => {
  it("decodes values and keeps the first occurrence of a name", () => {
    const cookies = parseCookieHeader('a=1; b="quoted value"; c=%7B%7D; a=2');
    assert.equal(cookies.a, "1");
    assert.equal(cookies.b, "quoted value");
    assert.equal(cookies.c, "{}");
  });

  it("survives a malformed percent escape", () => {
    assert.equal(parseCookieHeader("bad=%E0%A4%A").bad, "%E0%A4%A");
  });
});

describe("compactAttribution", () => {
  it("drops blanks but keeps the consent object", () => {
    const compacted = compactAttribution({
      gclid: "abc12345",
      utmSource: "",
      gaClientId: undefined,
      consent: { analytics: true, marketing: true },
    });
    assert.deepEqual(compacted, {
      gclid: "abc12345",
      consent: { analytics: true, marketing: true },
    });
  });
});

describe("googleClickId", () => {
  it("prefers gclid, then the iOS web-to-app ids", () => {
    assert.equal(googleClickId({ gclid: "g", gbraid: "b", wbraid: "w" }), "g");
    assert.equal(googleClickId({ gbraid: "b", wbraid: "w" }), "b");
    assert.equal(googleClickId({ wbraid: "w" }), "w");
    assert.equal(googleClickId({}), undefined);
    assert.equal(googleClickId(null), undefined);
  });
});
