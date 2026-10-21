/**
 * Origin robots.txt — search + AI answers on public pages, no training,
 * session app closed. Cloudflare managed robots.txt must stay **off** so this
 * file is not prepended with named-bot `Disallow: /` groups (those override
 * any later Allow for the same user-agent).
 */

import { frontendAiGroundingAllowPaths } from "@/lib/public-paths";

export const ROBOTS_CONTENT_SIGNAL =
  "search=yes,ai-input=yes,ai-train=no";

/** Retrieve-and-cite crawlers (not model-training). */
export const AI_GROUNDING_USER_AGENTS = [
  "OAI-SearchBot",
  "PerplexityBot",
  "ChatGPT-User",
] as const;

/** Training / extended-use crawlers — stay off the whole site. */
export const AI_TRAINING_USER_AGENTS = [
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "Bytespider",
  "meta-externalagent",
] as const;

/**
 * Public marketing paths grounding bots may fetch (`$` = exact home).
 * Built from `frontendAiGroundingAllowPaths()` so new hubs inherit Allow
 * automatically (/privacy and /terms stay off by design).
 */
export function aiGroundingAllowPaths(): string[] {
  return [
    "/$",
    ...frontendAiGroundingAllowPaths(),
    "/llms.txt",
    "/sitemap.xml",
    "/feed.xml",
    "/rss.xml",
    "/blog/rss.xml",
  ];
}

export const ROBOTS_DISALLOW = [
  "/app",
  "/admin",
  "/api",
  "/health",
] as const;

export function buildRobotsTxt(origin: string): string {
  const lines: string[] = [
    "# Nura: crawl public pages for search and AI answers. Do not train.",
    "# /app, /admin, /api, and /health are not marketing pages — stay out.",
    "# /privacy and /terms are public to users but not listed for AI grounding.",
    "",
    "User-agent: *",
    `Content-Signal: ${ROBOTS_CONTENT_SIGNAL}`,
    "Allow: /",
    ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`),
    "",
  ];

  const allow = aiGroundingAllowPaths();

  for (const agent of AI_GROUNDING_USER_AGENTS) {
    lines.push(`User-agent: ${agent}`);
    lines.push(`Content-Signal: ${ROBOTS_CONTENT_SIGNAL}`);
    for (const path of allow) {
      lines.push(`Allow: ${path}`);
    }
    lines.push("Disallow: /");
    lines.push("");
  }

  for (const agent of AI_TRAINING_USER_AGENTS) {
    lines.push(`User-agent: ${agent}`);
    lines.push("Disallow: /");
    lines.push("");
  }

  lines.push(`Sitemap: ${origin.replace(/\/$/, "")}/sitemap.xml`);
  lines.push("");
  return lines.join("\n");
}
