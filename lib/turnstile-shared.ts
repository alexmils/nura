/** Client-safe Turnstile constants (no secrets). */

/** Public sitekey (safe in client bundles). Prefer NEXT_PUBLIC_TURNSTILE_SITE_KEY. */
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ||
  "0x4AAAAAAEwsZmygyW6qxk-M";

/** JSON / form field name for the widget token. */
export const TURNSTILE_TOKEN_FIELD = "cf-turnstile-response" as const;

export type TurnstileAction =
  | "login"
  | "signup"
  | "forgot-password"
  | "reset-password"
  | "create-password"
  | "help-guest"
  | "newsletter";
