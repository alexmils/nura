/** Stamp timezone and language before sign-in so the server can store a place. */
export function stampBrowserPlace() {
  if (typeof document === "undefined") return;
  let timezone = "";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    timezone = "";
  }
  const language = typeof navigator !== "undefined" ? navigator.language || "" : "";
  const value = `${timezone}|${language}`.slice(0, 120);
  document.cookie = `nura_place=${encodeURIComponent(value)}; Path=/; Max-Age=86400; SameSite=Lax`;
}
