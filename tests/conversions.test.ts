import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  buildGa4MpPayload,
  buildGoogleAdsClickConversion,
  buildMetaCapiEvent,
  centsToUnits,
  clampGa4Timestamp,
  formatGoogleAdsDateTime,
  sha256Hex,
  GA4_MAX_BACKDATE_MS,
} from "@/lib/conversions/payloads";
import {
  buildConversionConfig,
  conversionChannelStatus,
  describeConversionChannels,
} from "@/lib/conversions/config";
import { ga4ValidationMessages } from "@/lib/conversions/ga4";

const NOW = new Date("2026-09-21T10:00:00.000Z");

describe("GA4 Measurement Protocol payload", () => {
  it("carries the stored client_id so the event finds the original session", () => {
    const payload = buildGa4MpPayload({
      clientId: "1234567890.1758448800",
      userId: "user_1",
      name: "purchase",
      params: {
        transaction_id: "in_123",
        value: 99,
        currency: "USD",
        empty: undefined,
        alsoEmpty: null,
      },
      occurredAt: NOW,
      now: NOW,
    });

    assert.equal(payload.client_id, "1234567890.1758448800");
    assert.equal(payload.user_id, "user_1");
    assert.equal(payload.timestamp_micros, NOW.getTime() * 1000);
    assert.deepEqual(payload.events, [
      {
        name: "purchase",
        params: { transaction_id: "in_123", value: 99, currency: "USD" },
      },
    ]);
  });

  it("omits user_id when the caller has none", () => {
    const payload = buildGa4MpPayload({
      clientId: "1.2",
      name: "purchase",
      occurredAt: NOW,
      now: NOW,
    });
    assert.equal("user_id" in payload, false);
  });

  it("clamps a webhook retry that arrives past the 72 hour window", () => {
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000);
    const clamped = clampGa4Timestamp(fiveDaysAgo, NOW);
    assert.equal(clamped.getTime(), NOW.getTime() - GA4_MAX_BACKDATE_MS + 60_000);
  });

  it("leaves a recent event and a clock-skewed future event alone", () => {
    const tenMinutesAgo = new Date(NOW.getTime() - 10 * 60 * 1000);
    assert.equal(clampGa4Timestamp(tenMinutesAgo, NOW).getTime(), tenMinutesAgo.getTime());
    const skewed = new Date(NOW.getTime() + 60_000);
    assert.equal(clampGa4Timestamp(skewed, NOW).getTime(), NOW.getTime());
  });
});

describe("GA4 debug validation messages", () => {
  it("reports nothing for a clean payload", () => {
    assert.deepEqual(ga4ValidationMessages('{"validationMessages": []}'), []);
  });

  it("surfaces the reasons Google gives", () => {
    assert.deepEqual(
      ga4ValidationMessages(
        JSON.stringify({
          validationMessages: [
            { description: "Event at index 0 has an invalid name", validationCode: "NAME_INVALID" },
            { description: "Missing currency" },
            { validationCode: "VALUE_INVALID" },
          ],
        })
      ),
      [
        "Event at index 0 has an invalid name",
        "Missing currency",
        "VALUE_INVALID",
      ]
    );
  });

  it("stays quiet on an unparseable body", () => {
    assert.deepEqual(ga4ValidationMessages(""), []);
    assert.deepEqual(ga4ValidationMessages("<html>502</html>"), []);
  });
});

describe("Meta Conversions API payload", () => {
  it("hashes identifiers and keeps the event id for browser dedupe", () => {
    const event = buildMetaCapiEvent({
      eventName: "Purchase",
      eventId: "in_123",
      occurredAt: NOW,
      sourceUrl: "https://nurahelp.com/",
      valueCents: 14_99,
      currency: "usd",
      plan: "monthly",
      email: "Person@Example.com ",
      externalId: "user_1",
      fbp: "fb.1.1.2",
      fbc: "fb.1.1.fbclid",
      clientIp: "1.2.3.4",
      userAgent: "test-agent",
    });

    assert.equal(event.event_name, "Purchase");
    assert.equal(event.event_id, "in_123");
    assert.equal(event.event_time, Math.floor(NOW.getTime() / 1000));
    assert.equal(event.action_source, "website");
    assert.equal(event.event_source_url, "https://nurahelp.com/");

    const userData = event.user_data as Record<string, unknown>;
    assert.deepEqual(userData.em, [sha256Hex("person@example.com")]);
    assert.deepEqual(userData.external_id, [sha256Hex("user_1")]);
    assert.equal(userData.fbp, "fb.1.1.2");
    assert.equal(userData.client_ip_address, "1.2.3.4");

    const custom = event.custom_data as Record<string, unknown>;
    assert.equal(custom.value, 14.99);
    assert.equal(custom.currency, "USD");
    assert.equal(custom.content_name, "monthly");
    assert.equal(custom.order_id, "in_123");
  });

  it("leaves user_data fields out when nothing identifies the user", () => {
    const event = buildMetaCapiEvent({
      eventName: "Purchase",
      eventId: "in_456",
      occurredAt: NOW,
    });
    assert.deepEqual(event.user_data, {});
    assert.equal("event_source_url" in event, false);
  });
});

describe("Google Ads click conversion payload", () => {
  it("formats the date time the way the API expects", () => {
    assert.equal(formatGoogleAdsDateTime(NOW), "2026-09-21 10:00:00+00:00");
  });

  it("uses gbraid when there is no gclid (iOS / ATT)", () => {
    const conversion = buildGoogleAdsClickConversion({
      customerId: "3522581611327832",
      conversionActionId: "12345",
      clickId: "gbraid-value",
      clickIdField: "gbraid",
      occurredAt: NOW,
      valueCents: 9_900,
      currency: "usd",
      orderId: "in_789",
    });
    assert.equal(conversion.gbraid, "gbraid-value");
    assert.equal("gclid" in conversion, false);
    assert.equal(
      conversion.conversionAction,
      "customers/3522581611327832/conversionActions/12345"
    );
    assert.equal(conversion.conversionValue, 99);
    assert.equal(conversion.currencyCode, "USD");
    assert.equal(conversion.orderId, "in_789");
  });
});

describe("centsToUnits", () => {
  it("avoids floating point noise", () => {
    assert.equal(centsToUnits(1499), 14.99);
    assert.equal(centsToUnits(0), 0);
    assert.equal(centsToUnits(9900), 99);
  });
});

describe("conversion channel configuration", () => {
  it("skips every channel when nothing is configured", () => {
    const config = buildConversionConfig(null);
    assert.equal(config.ga4, null);
    assert.equal(config.meta, null);
    assert.equal(config.googleAds, null);
  });

  it("pairs the stored measurement id with the stored api secret", () => {
    const config = buildConversionConfig({
      ga4MeasurementId: "G-66YC11GTZE",
      ga4ApiSecret: "stored-secret",
    });
    assert.deepEqual(config.ga4, {
      measurementId: "G-66YC11GTZE",
      apiSecret: "stored-secret",
    });
  });

  it("never treats a half-configured GA4 as ready", () => {
    assert.equal(
      buildConversionConfig({ ga4MeasurementId: "G-66YC11GTZE" }).ga4,
      null
    );
    assert.equal(buildConversionConfig({ ga4ApiSecret: "stored-secret" }).ga4, null);
  });

  it("ignores the environment: Admin is the only source", () => {
    // A fallback would make "cleared in Admin" indistinguishable from "never
    // set", and the env value would keep sending through a removed credential.
    const prev = process.env.GA4_API_SECRET;
    process.env.GA4_API_SECRET = "from-env";
    try {
      const config = buildConversionConfig({ ga4MeasurementId: "G-66YC11GTZE" });
      assert.equal(config.ga4, null);
    } finally {
      if (prev === undefined) delete process.env.GA4_API_SECRET;
      else process.env.GA4_API_SECRET = prev;
    }
  });

  it("normalises a formatted Meta pixel id and keeps the test code", () => {
    const config = buildConversionConfig({
      metaPixelId: "1120 6509 7729 4654",
      metaCapiAccessToken: "token",
      metaTestEventCode: "TEST123",
    });
    assert.equal(config.meta?.pixelId, "1120650977294654");
    assert.equal(config.meta?.testEventCode, "TEST123");
  });

  it("requires a pixel id and a token together", () => {
    assert.equal(
      buildConversionConfig({ metaPixelId: "1120650977294654" }).meta,
      null
    );
    assert.equal(buildConversionConfig({ metaCapiAccessToken: "token" }).meta, null);
  });

  it("omits the Meta test code when it is blank", () => {
    const config = buildConversionConfig({
      metaPixelId: "1120650977294654",
      metaCapiAccessToken: "token",
      metaTestEventCode: "   ",
    });
    assert.equal("testEventCode" in (config.meta ?? {}), false);
  });

  it("requires every Google field before enabling the channel", () => {
    const complete = {
      googleAdsCustomerId: "352-258-1611",
      googleAdsConversionActionId: "12345",
      googleAdsDeveloperToken: "dev-token",
      googleAdsOAuthClientId: "cid",
      googleAdsOAuthClientSecret: "csecret",
      googleAdsOAuthRefreshToken: "refresh",
    };
    const { googleAdsOAuthRefreshToken: _missing, ...incomplete } = complete;
    assert.equal(buildConversionConfig(incomplete).googleAds, null);

    const config = buildConversionConfig({ ...complete, googleAdsApiVersion: "v22" });
    assert.equal(config.googleAds?.customerId, "3522581611");
    assert.equal(config.googleAds?.conversionActionId, "12345");
    // An absent manager id stays absent rather than becoming an empty header.
    assert.equal(config.googleAds?.loginCustomerId, undefined);
    assert.equal(config.googleAds?.apiVersion, "v22");
  });

  it("reports readiness without leaking secrets", () => {
    const status = conversionChannelStatus({
      ga4MeasurementId: "G-66YC11GTZE",
      ga4ApiSecret: "super-secret",
      metaPixelId: "1120650977294654",
      metaCapiAccessToken: "super-secret-2",
    });
    assert.equal(status.ga4.configured, true);
    assert.equal(status.meta.configured, true);
    assert.equal(status.googleAds.configured, false);
    assert.equal(status.ga4.missing.length, 0);
    assert.equal(JSON.stringify(status).includes("super-secret"), false);
  });

  it("names what a half-configured channel is still waiting for", () => {
    // A bare `pixelId: null` left the admin guessing which field was empty.
    const status = conversionChannelStatus({
      ga4MeasurementId: "G-66YC11GTZE",
      ga4ApiSecret: "super-secret",
      metaPixelId: "1120650977294654",
    });
    assert.equal(status.meta.pixelId, "1120650977294654");
    assert.deepEqual(status.meta.missing, ["Conversions API access token"]);

    const empty = conversionChannelStatus({});
    assert.deepEqual(empty.ga4.missing, [
      "Google Analytics measurement ID",
      "Measurement Protocol API secret",
    ]);
    assert.equal(empty.googleAds.missing.length, 6);
  });

  it("describes which channels are live", () => {
    assert.equal(describeConversionChannels(buildConversionConfig(null)), "none");
    assert.equal(
      describeConversionChannels(
        buildConversionConfig({
          ga4MeasurementId: "G-66YC11GTZE",
          ga4ApiSecret: "stored-secret",
        })
      ),
      "GA4"
    );
  });
});
