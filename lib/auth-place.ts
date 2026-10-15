import { countryCentroid } from "@/lib/country-centroids";
import { countryDisplayName, normalizeCountryCode } from "@/lib/emergency-by-country";
import { sqlUserCountsInStats } from "@/lib/stats-scope";
import { ensureSchemaReady, getPool } from "@/lib/db";

export const PLACE_COOKIE = "nura_place";

const TIMEZONE = /^[A-Za-z0-9_+\/-]{1,64}$/;
const LANGUAGE = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8}){0,3}$/;

export type AuthPlaceKind = "signup" | "login";

export type PlaceCityCount = {
  label: string;
  users: number;
};

export type PlaceCount = {
  key: string;
  label: string;
  count: number;
  /** Distinct people. Sign-in rows can repeat for the same account. */
  users: number;
  cities: PlaceCityCount[];
  sharePct: number;
  lat: number | null;
  lng: number | null;
};

export type PlaceBucket = {
  total: number;
  countries: PlaceCount[];
  languages: PlaceCount[];
  timezones: PlaceCount[];
  browsers: PlaceCount[];
};

export type PlaceSummary = {
  days: number;
  generatedAt: string;
  /** Time zone and language come from the browser. Country and city come from the network only behind a trusted proxy. Without that, the city is the time zone place. */
  note: string;
  signups: PlaceBucket;
  signIns: PlaceBucket;
};

export const PLACE_SUMMARY_NOTE =
  "Time zone and language come from the browser. Country and city come from the network only behind a trusted proxy. Without that, the city is the time zone place.";

export function placeShare(count: number, total: number): number {
  if (total <= 0 || count <= 0) return 0;
  return Math.round((count / total) * 100);
}

export function browserFamily(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return "Opera";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  if (!ua.trim()) return "Unknown";
  return "Other";
}

export function parsePlaceSignal(input: {
  timezone?: unknown;
  language?: unknown;
}): { timezone: string | null; language: string | null } {
  const timezone =
    typeof input.timezone === "string" && TIMEZONE.test(input.timezone.trim())
      ? input.timezone.trim()
      : null;
  const languageRaw =
    typeof input.language === "string" ? input.language.trim() : "";
  const language = LANGUAGE.test(languageRaw) ? languageRaw.replace("_", "-") : null;
  return { timezone, language };
}

export function parsePlaceCookie(header: string | null): {
  timezone: string | null;
  language: string | null;
} {
  if (!header) return { timezone: null, language: null };
  const match = header.match(new RegExp(`(?:^|;\\s*)${PLACE_COOKIE}=([^;]*)`));
  if (!match?.[1]) return { timezone: null, language: null };
  let decoded = match[1];
  try {
    decoded = decodeURIComponent(match[1]);
  } catch {
    decoded = match[1];
  }
  const [timezone, language] = decoded.split("|");
  return parsePlaceSignal({ timezone, language });
}

export function projectPin(
  lat: number,
  lng: number,
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: ((lng + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  };
}

/** `en-US` and `en_GB` both count as `en`. */
export function languageGroupKey(code: string | null | undefined): string | null {
  if (!code) return null;
  const primary = code.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return /^[a-z]{2,3}$/.test(primary) ? primary : null;
}

function languageLabel(code: string): string {
  const primary = languageGroupKey(code) ?? code;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(primary) ?? code;
  } catch {
    return code;
  }
}

/** A new account is also a sign-in, so the map does not drop that country later. */
export function authPlaceKinds(firstVisit: boolean): AuthPlaceKind[] {
  return firstVisit ? ["signup", "login"] : ["login"];
}

function trustProxy(): boolean {
  return process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true";
}

/** Cloudflare country header, and only when this app is configured to trust the proxy. */
export function trustedCountryCode(request: Request): string | null {
  if (!trustProxy()) return null;
  return normalizeCountryCode(request.headers.get("cf-ipcountry"));
}

const GENERIC_ZONE = new Set([
  "eastern",
  "central",
  "pacific",
  "mountain",
  "utc",
  "gmt",
  "universal",
  "greenwich",
]);

/** Keep a short place name. Reject markup and generic zone labels. */
export function cleanCityName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    /* already plain text */
  }
  value = value.replace(/[_+]/g, " ").replace(/\s+/g, " ").trim();
  if (value.length < 2 || value.length > 80) return null;
  if (/[<>]/.test(value) || GENERIC_ZONE.has(value.toLowerCase())) return null;
  if (!/\p{L}/u.test(value)) return null;
  return value;
}

/** `Europe/Belgrade` → Belgrade. Offset zones stay empty. */
export function cityFromTimezone(timezone: string | null | undefined): string | null {
  if (!timezone || !timezone.includes("/") || /^etc\//i.test(timezone)) return null;
  return cleanCityName(timezone.split("/").pop());
}

/** Cloudflare city header, and only when this app is configured to trust the proxy. */
export function trustedCity(request: Request): string | null {
  if (!trustProxy()) return null;
  return cleanCityName(request.headers.get("cf-ipcity"));
}

export function placeCity(request: Request, timezone: string | null): string | null {
  return trustedCity(request) ?? cityFromTimezone(timezone);
}

function rowsToCounts(
  rows: { key: string | null; count: number; users?: number }[],
  total: number,
  labelFor: (key: string) => { label: string; lat?: number | null; lng?: number | null }
): PlaceCount[] {
  return rows.map((row) => {
    const key = row.key ?? "";
    const named = labelFor(key);
    return {
      key: key || "unknown",
      label: named.label,
      count: row.count,
      users: row.users ?? row.count,
      cities: [],
      sharePct: placeShare(row.count, total),
      lat: named.lat ?? null,
      lng: named.lng ?? null,
    };
  });
}

async function bucket(kind: AuthPlaceKind, days: number): Promise<PlaceBucket> {
  const pool = getPool();
  const scope = sqlUserCountsInStats("u");
  const base = `
    FROM auth_places p
    JOIN users u ON u.id = p.user_id
    WHERE p.kind = $1
      AND p.created_at >= NOW() - ($2::int * INTERVAL '1 day')
      AND ${scope}
  `;
  const [countries, languages, timezones, browsers, cities, total] = await Promise.all([
    pool.query<{ key: string | null; count: string; users: string }>(
      `SELECT NULLIF(p.country_code, '') AS key,
              COUNT(*)::int AS count,
              COUNT(DISTINCT p.user_id)::int AS users
       ${base}
       GROUP BY 1 ORDER BY count DESC`,
      [kind, days]
    ),
    pool.query<{ key: string | null; count: string }>(
      `SELECT NULLIF(split_part(replace(lower(p.language), '_', '-'), '-', 1), '') AS key,
              COUNT(*)::int AS count ${base}
       GROUP BY 1 ORDER BY count DESC LIMIT 12`,
      [kind, days]
    ),
    pool.query<{ key: string | null; count: string }>(
      `SELECT NULLIF(p.timezone, '') AS key, COUNT(*)::int AS count ${base}
       GROUP BY 1 ORDER BY count DESC LIMIT 12`,
      [kind, days]
    ),
    pool.query<{ key: string | null; count: string }>(
      `SELECT NULLIF(p.browser, '') AS key, COUNT(*)::int AS count ${base}
       GROUP BY 1 ORDER BY count DESC LIMIT 8`,
      [kind, days]
    ),
    pool.query<{ country: string | null; city: string | null; users: string }>(
      `SELECT NULLIF(p.country_code, '') AS country,
              NULLIF(p.city, '') AS city,
              COUNT(DISTINCT p.user_id)::int AS users
       ${base}
       GROUP BY 1, 2`,
      [kind, days]
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count ${base}`,
      [kind, days]
    ),
  ]);

  const num = (value: string | number) => Number(value) || 0;
  const mapRows = (rows: { key: string | null; count: string }[]) =>
    rows.map((row) => ({ key: row.key, count: num(row.count) }));

  const citiesByCountry = new Map<string, PlaceCityCount[]>();
  for (const row of cities.rows) {
    const code = normalizeCountryCode(row.country)?.toLowerCase();
    const label = cleanCityName(row.city);
    if (!code || !label) continue;
    const list = citiesByCountry.get(code) ?? [];
    list.push({ label, users: num(row.users) });
    citiesByCountry.set(code, list);
  }
  for (const list of citiesByCountry.values()) {
    list.sort((a, b) => b.users - a.users || a.label.localeCompare(b.label));
  }

  const totalCount = num(total.rows[0]?.count ?? 0);
  const countryRows = rowsToCounts(
    countries.rows.map((row) => ({
      key: row.key,
      count: num(row.count),
      users: num(row.users),
    })),
    totalCount,
    (key) => {
      const code = normalizeCountryCode(key);
      const pin = countryCentroid(code);
      return {
        label: code ? countryDisplayName(code) ?? code : "Unknown",
        lat: pin?.lat ?? null,
        lng: pin?.lng ?? null,
      };
    }
  ).map((row) => ({
    ...row,
    cities: (citiesByCountry.get(row.key.toLowerCase()) ?? []).slice(0, 8),
  }));
  return {
    total: totalCount,
    countries: countryRows,
    languages: rowsToCounts(mapRows(languages.rows), totalCount, (key) => ({
      label: key ? languageLabel(key) : "Unknown",
    })),
    timezones: rowsToCounts(mapRows(timezones.rows), totalCount, (key) => ({
      label: key || "Unknown",
    })),
    browsers: rowsToCounts(mapRows(browsers.rows), totalCount, (key) => ({
      label: key || "Unknown",
    })),
  };
}

export function clampPlaceDays(value: number): number {
  if (!Number.isFinite(value)) return 90;
  return Math.min(365, Math.max(7, Math.round(value)));
}

export async function getPlaceSummary(daysInput = 90): Promise<PlaceSummary> {
  await ensureSchemaReady();
  const days = clampPlaceDays(daysInput);
  const [signups, signIns] = await Promise.all([
    bucket("signup", days),
    bucket("login", days),
  ]);
  return {
    days,
    generatedAt: new Date().toISOString(),
    note: PLACE_SUMMARY_NOTE,
    signups,
    signIns,
  };
}

export async function recordAuthPlaces(
  request: Request,
  userId: string,
  firstVisit: boolean
): Promise<void> {
  try {
    const fromCookie = parsePlaceCookie(request.headers.get("cookie"));
    const country = trustedCountryCode(request);
    const city = placeCity(request, fromCookie.timezone);
    const browser = browserFamily(request.headers.get("user-agent"));
    const pool = getPool();
    for (const kind of authPlaceKinds(firstVisit)) {
      await pool.query(
        `INSERT INTO auth_places
          (id, user_id, kind, country_code, city, timezone, language, browser, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          crypto.randomUUID(),
          userId,
          kind,
          country,
          city,
          fromCookie.timezone,
          fromCookie.language,
          browser === "Unknown" ? null : browser,
        ]
      );
    }
  } catch (err) {
    console.warn("[auth-place]", err);
  }
}
