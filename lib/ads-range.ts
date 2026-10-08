/** Client-safe range constants. Ads loaders stay server-only. */
export const ADS_RANGES = ["7", "28", "90", "all"] as const;
export type AdsRange = (typeof ADS_RANGES)[number];

export function isAdsRange(value: unknown): value is AdsRange {
  return typeof value === "string" && (ADS_RANGES as readonly string[]).includes(value);
}

/** Sentinel account id meaning every account the token can read. */
export const ADS_ALL_ACCOUNTS = "all";

export const ADS_RANGE_LABELS: Record<AdsRange, string> = {
  "7": "Last 7 days",
  "28": "Last 28 days",
  "90": "Last 90 days",
  all: "All time",
};
