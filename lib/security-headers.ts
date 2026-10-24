/**
 * Response headers for every document and asset.
 * CSP allows the tags the product actually loads (Turnstile, GA/GTM, Clarity,
 * AdSense, Meta via GTM, YouTube/Vimeo embeds, Stripe.js on /checkout) and
 * blocks everything else.
 * Inline scripts stay allowed because the early bootstrap and Next hydration
 * scripts are not nonce-tagged.
 */

export type SecurityHeader = { key: string; value: string };

const SCRIPT_HOSTS = [
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://www.clarity.ms",
  "https://scripts.clarity.ms",
  "https://challenges.cloudflare.com",
  "https://pagead2.googlesyndication.com",
  "https://googleads.g.doubleclick.net",
  "https://www.googleadservices.com",
  "https://www.google.com",
  "https://www.gstatic.com",
  "https://connect.facebook.net",
  // Stripe Checkout Elements (/checkout).
  "https://js.stripe.com",
  "https://*.js.stripe.com",
];

const CONNECT_HOSTS = [
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
  "https://www.googletagmanager.com",
  "https://stats.g.doubleclick.net",
  "https://www.google.com",
  "https://www.clarity.ms",
  "https://*.clarity.ms",
  "https://challenges.cloudflare.com",
  "https://pagead2.googlesyndication.com",
  "https://googleads.g.doubleclick.net",
  "https://www.facebook.com",
  "https://connect.facebook.net",
  "https://api.stripe.com",
  "https://merchant-ui-api.stripe.com",
  "https://checkout.stripe.com",
];

const FRAME_HOSTS = [
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://challenges.cloudflare.com",
  "https://www.googletagmanager.com",
  "https://td.doubleclick.net",
  "https://www.google.com",
  // Stripe card fields and 3D Secure challenges.
  "https://js.stripe.com",
  "https://*.js.stripe.com",
  "https://hooks.stripe.com",
];

function contentSecurityPolicy(env: string): string {
  const script = ["'self'", "'unsafe-inline'", ...SCRIPT_HOSTS];
  const connect = ["'self'", ...CONNECT_HOSTS];
  if (env !== "production") {
    script.push("'unsafe-eval'");
    connect.push("ws:", "http://localhost:*", "http://127.0.0.1:*");
  }
  const directives = [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: https:",
    `connect-src ${connect.join(" ")}`,
    `frame-src 'self' ${FRAME_HOSTS.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];
  if (env === "production") directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/** HSTS is omitted outside production so local http://localhost is not pinned. */
export function securityHeaders(env: string = process.env.NODE_ENV ?? "development"): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(env) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: [
        "camera=()",
        "microphone=(self)",
        "geolocation=()",
        // Wallet buttons (Apple Pay / Google Pay) inside the Stripe iframe.
        `payment=(self "https://js.stripe.com")`,
        "usb=()",
        "autoplay=(self)",
        `fullscreen=(self "https://www.youtube-nocookie.com" "https://www.youtube.com" "https://player.vimeo.com")`,
      ].join(", "),
    },
  ];
  if (env === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    });
  }
  return headers;
}

export function applySecurityHeaders(
  headers: { set(name: string, value: string): void },
  env?: string
): void {
  for (const header of securityHeaders(env)) {
    headers.set(header.key, header.value);
  }
}
