import { ensureSchemaReady, getPool } from "@/lib/db";
import {
  assertTopicKey,
  FOCUS_NOTE,
  FOCUS_TOPICS,
  FOCUS_MIN_PEOPLE,
  focusLanguageKey,
  POST_TRAUMATIC_SQL,
  focusShare,
  redactFocusTopics,
  topicRegexSource,
  type FocusLanguageCount,
  type FocusTopicCount,
  type SessionFocus,
} from "@/lib/session-focus-topics";

export type { FocusLanguageCount, FocusTopicCount, SessionFocus } from "@/lib/session-focus-topics";
export {
  FOCUS_MIN_PEOPLE,
  FOCUS_NOTE,
  classifyFocus,
  redactFocusTopics,
} from "@/lib/session-focus-topics";

export function clampFocusDays(value: number): number {
  if (!Number.isFinite(value)) return 90;
  return Math.min(365, Math.max(7, Math.round(value)));
}

/** Outer query returns counts only. Message text stays inside the grouped subquery. */
export function buildFocusAggregateQuery(days: number): { text: string; values: unknown[] } {
  const values: unknown[] = [days];
  const flags = FOCUS_TOPICS.map((topic) => {
    assertTopicKey(topic.key);
    values.push(topicRegexSource(topic.patterns));
    const param = `$${values.length}`;
    if (topic.key === "trauma") {
      return `BOOL_OR(regexp_replace(m.content, '${POST_TRAUMATIC_SQL}', ' ', 'gi') ~* ${param}) AS trauma`;
    }
    return `BOOL_OR(m.content ~* ${param}) AS ${topic.key}`;
  });
  const any = FOCUS_TOPICS.map((topic) => topic.key).join(" OR ");
  const text = `
    SELECT
      COUNT(*)::int AS sessions,
      COUNT(DISTINCT user_id)::int AS people,
      ${FOCUS_TOPICS.map((topic) => `COUNT(*) FILTER (WHERE ${topic.key})::int AS ${topic.key}_sessions`).join(",\n      ")},
      ${FOCUS_TOPICS.map((topic) => `COUNT(DISTINCT user_id) FILTER (WHERE ${topic.key})::int AS ${topic.key}_people`).join(",\n      ")},
      COUNT(*) FILTER (WHERE NOT (${any}))::int AS unclear_sessions,
      COUNT(DISTINCT user_id) FILTER (WHERE NOT (${any}))::int AS unclear_people
    FROM (
      SELECT t.user_id,
        ${flags.join(",\n        ")}
      FROM messages m
      JOIN threads t ON t.id = m.thread_id
      JOIN users u ON u.id = t.user_id
      WHERE m.role = 'user'
        AND length(trim(m.content)) >= 8
        AND m.created_at >= NOW() - ($1::int * INTERVAL '1 day')
        AND u.stats_excluded IS NOT TRUE
      GROUP BY t.user_id, t.id
    ) sessions
  `;
  return { text, values };
}

function num(value: unknown): number {
  return Number(value) || 0;
}

function languageLabel(code: string): string {
  if (!code || code === "unknown") return "Not set";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export const FOCUS_LANGUAGE_SQL = `SELECT lang_key AS key,
              COUNT(DISTINCT thread_id)::int AS sessions,
              COUNT(DISTINCT user_id)::int AS people
       FROM (
         SELECT t.id AS thread_id,
                t.user_id,
                CASE
                  WHEN code ~ '^[a-z]{2,3}-[a-z]{2}$' THEN split_part(code, '-', 1)
                  WHEN code ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$' THEN code
                  ELSE 'unknown'
                END AS lang_key
         FROM messages m
         JOIN threads t ON t.id = m.thread_id
         JOIN users u ON u.id = t.user_id
         CROSS JOIN LATERAL (
           SELECT COALESCE(NULLIF(lower(trim(t.agent_language)), ''), 'unknown') AS code
         ) lang
         WHERE m.role = 'user'
           AND length(trim(m.content)) >= 8
           AND m.created_at >= NOW() - ($1::int * INTERVAL '1 day')
           AND u.stats_excluded IS NOT TRUE
       ) tagged
       GROUP BY lang_key`;

export async function getSessionFocus(daysInput = 90): Promise<SessionFocus> {
  await ensureSchemaReady();
  const days = clampFocusDays(daysInput);
  const query = buildFocusAggregateQuery(days);
  const pool = getPool();
  const [result, languageResult] = await Promise.all([
    pool.query<Record<string, unknown>>(query.text, query.values),
    pool.query<{ key: string | null; sessions: string; people: string }>(FOCUS_LANGUAGE_SQL, [days]),
  ]);
  const row = result.rows[0] ?? {};
  const sessions = num(row.sessions);
  const counted: FocusTopicCount[] = FOCUS_TOPICS.map((topic) => ({
    key: topic.key,
    label: topic.label,
    search: topic.search,
    blogPath: topic.blogPath,
    aim: topic.aim,
    sessions: num(row[`${topic.key}_sessions`]),
    people: num(row[`${topic.key}_people`]),
    sharePct: focusShare(num(row[`${topic.key}_sessions`]), sessions),
  }));
  const redacted = redactFocusTopics(counted);
  const languageRows = new Map<string, { sessions: number; people: number }>();
  for (const language of languageResult.rows) {
    const key = focusLanguageKey(language.key);
    const prev = languageRows.get(key) ?? { sessions: 0, people: 0 };
    languageRows.set(key, {
      sessions: prev.sessions + num(language.sessions),
      people: prev.people + num(language.people),
    });
  }
  let hiddenLanguages = 0;
  const languages: FocusLanguageCount[] = [];
  for (const [key, value] of languageRows) {
    if (value.people > 0 && value.people < FOCUS_MIN_PEOPLE) {
      hiddenLanguages += 1;
      continue;
    }
    if (value.people < FOCUS_MIN_PEOPLE) continue;
    languages.push({
      key,
      label: languageLabel(key),
      sessions: value.sessions,
      people: value.people,
      sharePct: focusShare(value.sessions, sessions),
    });
  }
  languages.sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label));

  const unclearPeople = num(row.unclear_people);
  const unclearHidden = unclearPeople > 0 && unclearPeople < FOCUS_MIN_PEOPLE;

  return {
    days,
    generatedAt: new Date().toISOString(),
    note: FOCUS_NOTE,
    sessions,
    people: num(row.people),
    topics: redacted.topics,
    hiddenTopics: redacted.hiddenTopics,
    languages,
    hiddenLanguages,
    unclearHidden,
    unclear: {
      key: "unclear",
      label: "No clear topic",
      search: "",
      blogPath: null,
      aim: "No matched theme. Not a search target.",
      sessions: unclearHidden ? 0 : num(row.unclear_sessions),
      people: unclearHidden ? 0 : unclearPeople,
      sharePct: unclearHidden ? 0 : focusShare(num(row.unclear_sessions), sessions),
    },
  };
}
