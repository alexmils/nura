import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authPlaceKinds,
  browserFamily,
  cityFromTimezone,
  cleanCityName,
  languageGroupKey,
  parsePlaceCookie,
  parsePlaceSignal,
  placeCity,
  placeShare,
  projectPin,
  trustedCity,
  trustedCountryCode,
} from "../lib/auth-place.ts";
import { largestSubpathCenter } from "../lib/place-geometry.ts";

describe("auth place signals", () => {
  it("keeps a real timezone and language", () => {
    assert.deepEqual(
      parsePlaceSignal({ timezone: "Europe/Belgrade", language: "sr-RS" }),
      { timezone: "Europe/Belgrade", language: "sr-RS" }
    );
  });

  it("drops junk timezone and language", () => {
    assert.deepEqual(
      parsePlaceSignal({ timezone: "https://evil.test", language: "<script>" }),
      { timezone: null, language: null }
    );
  });

  it("reads the browser cookie", () => {
    const header = "other=1; nura_place=Europe%2FBelgrade%7Csr-RS";
    assert.deepEqual(parsePlaceCookie(header), {
      timezone: "Europe/Belgrade",
      language: "sr-RS",
    });
  });

  it("names common browsers", () => {
    assert.equal(
      browserFamily(
        "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36"
      ),
      "Chrome"
    );
    assert.equal(browserFamily("Mozilla/5.0 Edg/120.0"), "Edge");
    assert.equal(browserFamily(""), "Unknown");
  });

  it("rounds share and projects a pin", () => {
    assert.equal(placeShare(1, 4), 25);
    assert.equal(placeShare(1, 10), 10);
    assert.equal(placeShare(0, 0), 0);
    const pin = projectPin(0, 0, 360, 180);
    assert.equal(pin.x, 180);
    assert.equal(pin.y, 90);
  });

  it("counts a new account as a sign-in too", () => {
    assert.deepEqual(authPlaceKinds(true), ["signup", "login"]);
    assert.deepEqual(authPlaceKinds(false), ["login"]);
  });

  it("groups regional language tags", () => {
    assert.equal(languageGroupKey("en-US"), "en");
    assert.equal(languageGroupKey("en_GB"), "en");
    assert.equal(languageGroupKey("sr"), "sr");
    assert.equal(languageGroupKey("not a language"), null);
  });

  it("reads country only when the proxy is trusted", () => {
    const prev = process.env.TRUST_PROXY;
    const request = new Request("http://localhost", {
      headers: { "cf-ipcountry": "RS" },
    });
    delete process.env.TRUST_PROXY;
    assert.equal(trustedCountryCode(request), null);
    process.env.TRUST_PROXY = "true";
    assert.equal(trustedCountryCode(request), "RS");
    process.env.TRUST_PROXY = "true";
    assert.equal(
      trustedCountryCode(
        new Request("http://localhost", { headers: { "cf-ipcountry": "XX" } })
      ),
      null
    );
    if (prev === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = prev;
  });

  it("reads a city from the time zone, and from the proxy when trusted", () => {
    assert.equal(cityFromTimezone("Europe/Belgrade"), "Belgrade");
    assert.equal(cityFromTimezone("America/Argentina/Buenos_Aires"), "Buenos Aires");
    assert.equal(cityFromTimezone("Etc/GMT+2"), null);
    assert.equal(cityFromTimezone("US/Eastern"), null);
    assert.equal(cleanCityName("New%20York"), "New York");
    assert.equal(cleanCityName("<script>"), null);

    const prev = process.env.TRUST_PROXY;
    const request = new Request("http://localhost", {
      headers: {
        cookie: "nura_place=Europe%2FBelgrade%7Csr",
        "cf-ipcity": "Novi Sad",
      },
    });
    delete process.env.TRUST_PROXY;
    assert.equal(trustedCity(request), null);
    assert.equal(placeCity(request, "Europe/Belgrade"), "Belgrade");
    process.env.TRUST_PROXY = "true";
    assert.equal(trustedCity(request), "Novi Sad");
    assert.equal(placeCity(request, "Europe/Belgrade"), "Novi Sad");
    if (prev === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = prev;
  });

  it("puts a pin on the longest landmass", () => {
    const pin = largestSubpathCenter(
      "M0 0L10 0L10 10L0 10Z M100 100L110 100L110 102"
    );
    assert.ok(pin);
    assert.equal(pin.x, 5);
    assert.equal(pin.y, 5);
  });
});
