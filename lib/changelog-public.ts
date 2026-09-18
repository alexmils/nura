import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { rewriteRetiredBrandCopy } from "@/lib/brand";

export type ChangelogKind = "added" | "changed" | "fixed" | "removed";

export type ChangelogSection = {
  kind: ChangelogKind;
  heading: string;
  items: string[];
};

export type ChangelogRelease = {
  id: string;
  versionLabel: string | null;
  kindLabel: string;
  dateLabel: string;
  dateIso: string | null;
  unreleased: boolean;
  sections: ChangelogSection[];
};

const KIND_FROM_HEADING: Record<string, ChangelogKind> = {
  added: "added",
  new: "added",
  changed: "changed",
  improved: "changed",
  fixed: "fixed",
  removed: "removed",
  security: "fixed",
};

const HEADING_FOR_KIND: Record<ChangelogKind, string> = {
  added: "New",
  changed: "Improved",
  fixed: "Fixed",
  removed: "Removed",
};

const KIND_ORDER: ChangelogKind[] = ["added", "changed", "fixed", "removed"];

/** Living [Unreleased] dump — public page shows newest N per section. */
export const UNRELEASED_PUBLIC_CAP = 8;

const CHANGELOG_PATH = join(process.cwd(), "CHANGELOG.md");

/** Engineering / infra — never on the public notes page. Agents classify first: `.cursor/rules/changelog-split.mdc`. */
const INTERNAL_RE =
  /cursor rule|\.cursor\/|\bmem0\b|user_id:\s*["']?emdr|dockerfile|coolify|ghcr\.io|npm test|npm run lint|readlints|verify-before-done|git-commit-push|changelog-split|scripts\/|\.github\/|github actions|docker compose|\bdocker\b|\bpostgres(?:ql)?\b|start\.bat|reset\.bat|port \*\*3471|port \*\*5434|turbopack|outputfiletracing|revalidatetag|revalidatepath|force-dynamic|unstable_cache|\bisr\b|robots\.txt|tsx --test|node:test|postgresql rls|advisory lock|vapid_|cron_secret|workdir must|\.dockerignore|apple-design|apple hig|\binter font\b|nura-ui-designer|redpen-copy|page-copy-design-review|marketing-no-explain|turnstile-forms\.mdc|admin-nav-search|admin-settings-selection|product-ui rule|pre-push gate|actions docker|design lab|revalidate =|json-ld|lastmodified|changefreq|shouldnoindexpath|hreflang|buildpagemetadata|next\/image|srcsets|turnstile_secret|next_public_|--ui-|\/api\/|app_settings|healthcheck|get \/health|\bnext\.js\b|app router/i;

/** Admin, platform, marketing site, SEO — not in-app user features. */
const PLATFORM_RE =
  /\badmin\b|\/admin\b|platform_admin|platform settings|meta pixel|\bgtm\b|conversiontags?|complete registration|initiatecheckout|\beditorial\b|\bllms\.txt\b|\bsitemap\b|\brobots\b|\bhreflang\b|\bfraunces\b|source sans|type scale|masonry|\bblog\b|\/learn|\/changelog|\bwordmark\b|\bpreloader\b|cookie banner|\bsandbox\b|webhook secret|\bvisitorkey\b|\bhardening\b|css vars?|scoped under|frontend site|frontendshell|landing header|need help fab|guest help|help guest|guest contact|guest threads?|exit-intent|attorney-pending|clinical-team|launch-blockers|operator receptly|\bmarketing\b|\bsponsored\b|\badsense\b|addisplayunit|display ads|translate3d|60fps|role=\"button\"|mix-blend-mode|anti-aliased|chrome review|nura-circle-variants/i;

const FILE_PATH_RE =
  /(?:^|[\s(`])(?:app|lib|tests|docs|scripts|content)\/[\w./-]+\.(?:tsx?|css|mdc|md|mjs|json)/i;

/** Signed-in app: session, auth, billing, settings — not the marketing site. */
const APP_USER_RE =
  /\b(\/app|session|visual set|free session|self-guided|agent-guided|AI agent-guided|voice mode|intake|login|sign in|create account|password|passkey|onboarding|billing|upgrade|trial|settings|sidebar|thread|memory|help|crisis|delete account|account deletion|composer|check-in|immersive|google|charge hint|renews|guided|free mode|set running|informed consent|not-therapy|nps|danger zone|show\/hide|gamepad|animation|repeats)\b/i;

export function isForcedPublicItem(raw: string): boolean {
  return /^\s*\[public\]\s+/i.test(raw);
}

export function isForcedInternalItem(raw: string): boolean {
  return /^\s*\[internal\]\s+/i.test(raw);
}

function plainChangelogText(raw: string): string {
  return raw.replace(/[*`#[\]]/g, " ");
}

/** True when a CHANGELOG bullet should stay off `/changelog`. */
export function isInternalChangelogItem(raw: string): boolean {
  return !shouldShowOnPublicChangelog(raw);
}

export function shouldShowOnPublicChangelog(raw: string): boolean {
  if (isForcedInternalItem(raw)) return false;
  if (isForcedPublicItem(raw)) return true;
  const plain = plainChangelogText(raw);
  if (INTERNAL_RE.test(plain)) return false;
  if (PLATFORM_RE.test(plain)) return false;
  if (FILE_PATH_RE.test(plain) && !APP_USER_RE.test(plain)) return false;
  return APP_USER_RE.test(plain);
}

export function formatPublicChangelogItem(raw: string): string {
  let text = raw
    .replace(/^\s*\[(?:public|internal)\]\s+/i, "")
    .replace(/^\s*-\s+/, "")
    .trim();
  text = rewriteRetiredBrandCopy(text);
  text = text.replace(/\bBLS\b/g, "session");
  text = text.replace(/\bGuided vs Free\b/g, "AI agent-guided or Self-guided");
  text = text.replace(/\bGuided sessions\b/g, "AI agent-guided sessions");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/\s*\([^)]*\.(?:tsx?|css|mdc|md|mjs)[^)]*\)/g, "");
  text = text.replace(
    /(?:,\s*)?(?:app|lib|tests|docs|scripts)\/[\w./-]+\.(?:tsx?|css|mdc|md|mjs)(?:\s*\+\s*tests)?/gi,
    ""
  );
  text = text.replace(/\bon shared AuthField\b/gi, "");
  text = text.replace(/\s*\([^)]*\.[\w-]+[^)]*\)/g, "");
  text = text.replace(/\s*via localStorage\b(?:\s*\([^)]*\))?/gi, "");
  text = text.replace(/ \(same [^)]*mobile\)/gi, "");
  text = text.replace(/\bPanelLeft\b/g, "sidebar");
  text = text.replace(/\s*\(shared AuthShell\)/gi, "");
  text = text.replace(/\s{2,}/g, " ").trim();
  text = text.replace(/[.;:\s]+$/, (tail) => (tail.includes(".") ? "." : ""));
  const clause = text.split(/\s*[;—]\s+/)[0].trim();
  if (clause.length <= 180) return clause;
  return `${clause.slice(0, 177).replace(/\s+\S*$/, "")}…`;
}

function monthYearLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function parseReleaseHeading(line: string): {
  id: string;
  versionLabel: string | null;
  dateIso: string | null;
  unreleased: boolean;
} | null {
  const m = line.match(
    /^##\s+\[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?/
  );
  if (!m) return null;
  const id = m[1].trim();
  const unreleased = id.toLowerCase() === "unreleased";
  return {
    id: unreleased ? "unreleased" : id.toLowerCase().replace(/\s+/g, "-"),
    versionLabel: unreleased ? null : id,
    dateIso: m[2] ?? null,
    unreleased,
  };
}

function kindFromHeading(line: string): ChangelogKind | null {
  const m = line.match(/^###\s+(.+)$/);
  if (!m) return null;
  const key = m[1].trim().toLowerCase();
  return KIND_FROM_HEADING[key] ?? null;
}

function releaseKindLabel(sections: ChangelogSection[]): string {
  const kinds = new Set(sections.map((s) => s.kind));
  if (kinds.has("added")) return "Feature release";
  if (kinds.has("changed")) return "Update";
  if (kinds.has("fixed")) return "Fixes";
  if (kinds.has("removed")) return "Removed";
  return "Notes";
}

function finishRelease(
  heading: ReturnType<typeof parseReleaseHeading>,
  buckets: Partial<Record<ChangelogKind, string[]>>
): ChangelogRelease | null {
  if (!heading) return null;
  const sections: ChangelogSection[] = [];
  for (const kind of KIND_ORDER) {
    const items = buckets[kind];
    if (!items?.length) continue;
    sections.push({
      kind,
      heading: HEADING_FOR_KIND[kind],
      items,
    });
  }
  if (!sections.length) return null;
  return {
    id: heading.id,
    versionLabel: heading.versionLabel,
    kindLabel: releaseKindLabel(sections),
    dateLabel: heading.unreleased
      ? "Now"
      : heading.dateIso
        ? monthYearLabel(heading.dateIso)
        : heading.versionLabel || "Release",
    dateIso: heading.dateIso,
    unreleased: heading.unreleased,
    sections,
  };
}

/** Parse Keep a Changelog markdown into public releases (newest items first). */
export function parseChangelogMarkdown(markdown: string): ChangelogRelease[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const releases: ChangelogRelease[] = [];
  let heading: ReturnType<typeof parseReleaseHeading> = null;
  let kind: ChangelogKind | null = null;
  let buckets: Partial<Record<ChangelogKind, string[]>> = {};

  const flush = () => {
    const done = finishRelease(heading, buckets);
    if (done) releases.push(done);
    heading = null;
    kind = null;
    buckets = {};
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      heading = parseReleaseHeading(line);
      continue;
    }
    if (!heading) continue;
    if (line.startsWith("### ")) {
      kind = kindFromHeading(line);
      continue;
    }
    const bullet = line.match(/^- (.+)$/);
    if (!bullet || !kind) continue;
    const raw = bullet[1].trim();
    if (!raw || isInternalChangelogItem(raw)) continue;
    const text = formatPublicChangelogItem(raw);
    if (!text || /\bBLS\b/.test(text)) continue;
    if (!buckets[kind]) buckets[kind] = [];
    buckets[kind]!.push(text);
  }
  flush();

  for (const release of releases) {
    for (const section of release.sections) {
      section.items.reverse();
      if (release.unreleased && section.items.length > UNRELEASED_PUBLIC_CAP) {
        section.items = section.items.slice(0, UNRELEASED_PUBLIC_CAP);
      }
    }
  }
  return releases;
}

export function loadChangelogMarkdown(): string {
  try {
    return readFileSync(CHANGELOG_PATH, "utf8");
  } catch {
    return "";
  }
}

export function loadPublicChangelog(): ChangelogRelease[] {
  return parseChangelogMarkdown(loadChangelogMarkdown());
}

export function changelogFileMtime(): Date | null {
  try {
    return statSync(CHANGELOG_PATH).mtime;
  } catch {
    return null;
  }
}
