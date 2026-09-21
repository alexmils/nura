/**
 * Server-side persistence for ad attribution.
 *
 * Imported only from route handlers and the Stripe webhook — `lib/attribution.ts`
 * holds the capture helpers the browser bundle gets.
 */

import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  compactAttribution,
  mergeAttribution,
  readAttributionFromCookieHeader,
  type AttributionSnapshot,
} from "@/lib/attribution";

export async function saveUserAttribution(
  userId: string,
  snapshot: AttributionSnapshot
): Promise<void> {
  const existing = await getUserAttribution(userId);
  const merged = mergeAttribution(existing, snapshot);
  if (!Object.keys(merged).length) return;
  await ensureSchemaReady();
  await getPool().query(
    `INSERT INTO user_attribution (
       user_id, gclid, gbraid, wbraid, fbclid, fbc, fbp, ga_client_id,
       landing_page, referrer, utm_source, utm_medium, utm_campaign,
       utm_term, utm_content, consent_analytics, consent_marketing,
       captured_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       gclid = COALESCE(user_attribution.gclid, EXCLUDED.gclid),
       gbraid = COALESCE(user_attribution.gbraid, EXCLUDED.gbraid),
       wbraid = COALESCE(user_attribution.wbraid, EXCLUDED.wbraid),
       fbclid = COALESCE(user_attribution.fbclid, EXCLUDED.fbclid),
       fbc = COALESCE(user_attribution.fbc, EXCLUDED.fbc),
       fbp = COALESCE(EXCLUDED.fbp, user_attribution.fbp),
       ga_client_id = COALESCE(EXCLUDED.ga_client_id, user_attribution.ga_client_id),
       landing_page = COALESCE(user_attribution.landing_page, EXCLUDED.landing_page),
       referrer = COALESCE(user_attribution.referrer, EXCLUDED.referrer),
       utm_source = COALESCE(user_attribution.utm_source, EXCLUDED.utm_source),
       utm_medium = COALESCE(user_attribution.utm_medium, EXCLUDED.utm_medium),
       utm_campaign = COALESCE(user_attribution.utm_campaign, EXCLUDED.utm_campaign),
       utm_term = COALESCE(user_attribution.utm_term, EXCLUDED.utm_term),
       utm_content = COALESCE(user_attribution.utm_content, EXCLUDED.utm_content),
       consent_analytics = COALESCE(EXCLUDED.consent_analytics, user_attribution.consent_analytics),
       consent_marketing = COALESCE(EXCLUDED.consent_marketing, user_attribution.consent_marketing),
       captured_at = COALESCE(user_attribution.captured_at, EXCLUDED.captured_at),
       updated_at = NOW()`,
    [
      userId,
      merged.gclid ?? null,
      merged.gbraid ?? null,
      merged.wbraid ?? null,
      merged.fbclid ?? null,
      merged.fbc ?? null,
      merged.fbp ?? null,
      merged.gaClientId ?? null,
      merged.landingPage ?? null,
      merged.referrer ?? null,
      merged.utmSource ?? null,
      merged.utmMedium ?? null,
      merged.utmCampaign ?? null,
      merged.utmTerm ?? null,
      merged.utmContent ?? null,
      merged.consent ? merged.consent.analytics : null,
      merged.consent ? merged.consent.marketing : null,
      merged.capturedAt ?? null,
    ]
  );
}

export async function getUserAttribution(
  userId: string
): Promise<AttributionSnapshot | null> {
  await ensureSchemaReady();
  const { rows } = await getPool().query<Record<string, string | boolean | null>>(
    `SELECT gclid, gbraid, wbraid, fbclid, fbc, fbp, ga_client_id, landing_page,
            referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
            consent_analytics, consent_marketing, captured_at
     FROM user_attribution WHERE user_id = $1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  const asText = (v: unknown) =>
    typeof v === "string" && v ? v : undefined;
  const snapshot: AttributionSnapshot = {
    gclid: asText(row.gclid),
    gbraid: asText(row.gbraid),
    wbraid: asText(row.wbraid),
    fbclid: asText(row.fbclid),
    fbc: asText(row.fbc),
    fbp: asText(row.fbp),
    gaClientId: asText(row.ga_client_id),
    landingPage: asText(row.landing_page),
    referrer: asText(row.referrer),
    utmSource: asText(row.utm_source),
    utmMedium: asText(row.utm_medium),
    utmCampaign: asText(row.utm_campaign),
    utmTerm: asText(row.utm_term),
    utmContent: asText(row.utm_content),
    capturedAt: asText(row.captured_at),
  };
  if (
    typeof row.consent_analytics === "boolean" &&
    typeof row.consent_marketing === "boolean"
  ) {
    snapshot.consent = {
      analytics: row.consent_analytics,
      marketing: row.consent_marketing,
    };
  }
  const cleaned = compactAttribution(snapshot);
  return Object.keys(cleaned).length ? cleaned : null;
}

/**
 * Persist whatever the attribution cookie holds for a signed-in user. Called on
 * signup and again at checkout, so the click survives the days between the ad
 * click and the Stripe webhook that reports the charge.
 *
 * Never throws: attribution must not be able to break registration or checkout.
 */
export async function persistAttributionFromCookie(
  userId: string,
  cookieHeader: string | null | undefined
): Promise<void> {
  try {
    const snapshot = readAttributionFromCookieHeader(cookieHeader);
    if (!snapshot) return;
    await saveUserAttribution(userId, snapshot);
  } catch (err) {
    console.warn("[attribution] persist failed", err);
  }
}
