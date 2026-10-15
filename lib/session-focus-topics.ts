export const FOCUS_MIN_PEOPLE = 3;

export const FOCUS_NOTE = "Counts only. A theme shows after 3 people.";

/** Strips the trauma stem inside post-traumatic before the trauma check. */
export const POST_TRAUMATIC_SQL =
  "post[-[:space:]]?traumat[[:alpha:]]*|创伤后应激障碍?|посттравматич[[:alpha:]]*|心的外傷後?";

type FocusTopic = {
  key: string;
  label: string;
  /** Search query to aim at. Not a quote from a session. */
  search: string;
  /** Blog category, when one exists. */
  blogPath: string | null;
  /** One line for the marketing table. */
  aim: string;
  patterns: readonly string[];
};

/** Fixed word list. Not caller input, and not a diagnosis. */
export const FOCUS_TOPICS: readonly FocusTopic[] = [
  {
    key: "ptsd",
    label: "PTSD",
    search: "PTSD EMDR",
    blogPath: "/blog/category/ptsd",
    aim: "Search and ads for PTSD EMDR. Send the click to the PTSD category.",
    patterns: ["ptsd", "post-traumatic", "post traumatic", "posttraumat", "tept", "tspt", "ptbs", "ptss", "dpts", "птср", "创伤后应激", "創傷後", "心的外傷"],
  },
  {
    key: "trauma",
    label: "Trauma",
    search: "trauma EMDR",
    blogPath: "/blog/category/trauma",
    aim: "Search and ads for trauma EMDR. Send the click to the Trauma category.",
    patterns: ["trauma", "traumat", "травм", "创伤", "創傷", "トラウマ", "트라우마", "صدمة", "טראומה"],
  },
  {
    key: "anxiety",
    label: "Anxiety",
    search: "anxiety EMDR",
    blogPath: "/blog/category/anxiety",
    aim: "Search and ads for anxiety EMDR. Send the click to the Anxiety category.",
    patterns: ["anxiety", "anxious", "anksiozn", "ansiedad", "angoiss", "angst", "ansia", "ansiedade", "тревог", "тривог", "szorong", "ångest", "ahdist", "قلق", "חרד", "चिंता", "焦虑", "焦慮", "불안", "lo âu", "cemas"],
  },
  {
    key: "panic",
    label: "Panic",
    search: "panic EMDR",
    blogPath: "/blog/category/panic",
    aim: "Search and ads for panic EMDR. Send the click to the Panic category.",
    patterns: ["panik", "pánico", "panique", "panico", "pânico", "паник", "pánico", "恐慌", "パニック", "공황", "ذعر"],
  },
  {
    key: "grief",
    label: "Grief",
    search: "grief EMDR",
    blogPath: "/blog/category/grief",
    aim: "Search and ads for grief EMDR. Send the click to the Grief category.",
    patterns: ["grief", "bereave", "gubitak", "tugovan", "žalost", "zalost", "duelo", "deuil", "trauer", "luto", "lutto", "rouw", "горе", "żałob", "gyász", "keder", "sorg", "حزن", "哀伤", "哀傷", "애도"],
  },
  {
    key: "sleep",
    label: "Sleep",
    search: "insomnia EMDR",
    blogPath: null,
    aim: "No blog category yet. Aim search and ads at insomnia EMDR until a Sleep page exists.",
    patterns: ["insomnia", "insomni", "nesanica", "nightmare", "noćna mora", "nocna mora", "can't sleep", "cannot sleep", "ne mogu da spavam", "schlaflos", "бессон", "unettom", "أرق", "失眠", "不眠", "불면"],
  },
  {
    key: "relationships",
    label: "Relationships",
    search: "relationship EMDR",
    blogPath: null,
    aim: "No blog category yet. Aim search and ads at relationship EMDR until a page exists.",
    patterns: ["relationship", "breakup", "break-up", "raskid", "relación", "relacion", "beziehung", "relação", "relazione", "relatie", "отношен", "związek", "ilişki", "علاقة", "分手", "別れ", "이별"],
  },
  {
    key: "childhood",
    label: "Childhood",
    search: "childhood trauma EMDR",
    blogPath: "/blog/category/childhood-memories",
    aim: "Search and ads for childhood trauma EMDR. Send the click to Childhood memories.",
    patterns: ["childhood", "detinjstv", "djetinjstv", "as a child", "when i was a child", "bio dete", "bila dete", "bio dijete", "bila dijete", "infancia", "enfance", "kindheit", "infanzia", "jeugd", "детств", "dzieciństw", "çocukluk", "barndom", "طفولة", "童年", "子供の頃", "어린 시절"],
  },
  {
    key: "accident",
    label: "Accident",
    search: "accident EMDR",
    blogPath: null,
    aim: "No blog category yet. Aim search and ads at accident EMDR until a page exists.",
    patterns: ["accident", "car crash", "nesreć", "nesrec", "saobraćaj", "saobracaj", "accidente", "unfall", "acidente", "ongeluk", "авария", "wypadek", "baleset", "حادث", "事故", "사고"],
  },
  {
    key: "low_mood",
    label: "Low mood",
    search: "depression EMDR",
    blogPath: null,
    aim: "No blog category yet. Aim search and ads at depression EMDR until a page exists.",
    patterns: ["depression", "depressed", "depresij", "depress", "dépress", "депресс", "דיכאון", "اكتئاب", "抑郁", "憂鬱", "우울", "trầm cảm"],
  },
  {
    key: "phobia",
    label: "Phobia",
    search: "phobia EMDR",
    blogPath: "/blog/category/phobias",
    aim: "Search and ads for phobia EMDR. Send the click to the Phobias category.",
    patterns: ["phobia", "fobij", "fobi", "phobie", "фоби", "恐惧症", "恐怖症", "공포증"],
  },
  {
    key: "anger",
    label: "Anger",
    search: "anger EMDR",
    blogPath: null,
    aim: "No blog category yet. Aim search and ads at anger EMDR until a page exists.",
    patterns: ["anger", "rage", "ljutnj", "furious", "colère", "wut", "raiva", "rabbia", "woede", "гнев", "złość", "öfke", "غضب", "愤怒", "怒り", "분노"],
  },
  {
    key: "shame",
    label: "Shame or guilt",
    search: "shame EMDR",
    blogPath: null,
    aim: "No blog category yet. Aim search and ads at shame EMDR until a page exists.",
    patterns: ["shame", "guilt", "stid", "krivic", "vergüenza", "culpa", "honte", "scham", "schuld", "vergonha", "vergogna", "стыд", "вина", "wstyd", "utanç", "skam", "skuld", "羞耻", "内疚", "죄책"],
  },
  {
    key: "abuse",
    label: "Abuse",
    search: "abuse EMDR",
    blogPath: null,
    aim: "No blog category yet. Aim search and ads at abuse EMDR until a page exists.",
    patterns: ["abuse", "assault", "zlostavljan", "nasilj", "abuso", "abus", "missbrauch", "misbruik", "насили", "przemoc", "istismar", "إساءة", "虐待", "학대"],
  },
  {
    key: "stress",
    label: "Stress",
    search: "stress EMDR",
    blogPath: null,
    aim: "No blog category yet. Aim search and ads at stress EMDR until a page exists.",
    patterns: ["burnout", "stressed", "stress", "stres", "izgaranj", "estrés", "estresse", "стресс", "stressz", "压力", "ストレス", "스트레스", "căng thẳng"],
  },
];

export type FocusTopicCount = {
  key: string;
  label: string;
  sessions: number;
  people: number;
  sharePct: number;
  search: string;
  blogPath: string | null;
  aim: string;
};

export type FocusLanguageCount = {
  key: string;
  label: string;
  sessions: number;
  people: number;
  sharePct: number;
};

export type SessionFocus = {
  days: number;
  generatedAt: string;
  note: string;
  sessions: number;
  people: number;
  topics: FocusTopicCount[];
  hiddenTopics: number;
  languages: FocusLanguageCount[];
  hiddenLanguages: number;
  /** True when the no-topic count is below the people threshold. */
  unclearHidden: boolean;
  unclear: FocusTopicCount;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function assertTopicKey(key: string): void {
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    throw new Error(`Bad focus topic key: ${key}`);
  }
}

/** Chinese, Japanese, Korean, and Thai do not put spaces between words. */
function unspacedScript(pattern: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0e00-\u0e7f]/.test(pattern);
}

/** Stems that must not match a longer word (`sorg` vs `sorgfältig`). */
const WHOLE_WORD = new Set(["sorg", "горе"]);

function patternSource(pattern: string, boundary: string): string {
  const body = escapeRegex(pattern.toLowerCase());
  if (unspacedScript(pattern)) return body;
  const start = `(?:^|${boundary})(?:${body})`;
  if (WHOLE_WORD.has(pattern.toLowerCase())) return `${start}(?:${boundary}|$)`;
  return start;
}

/** Postgres regex: word-start plus a fixed stem. */
export function topicRegexSource(patterns: readonly string[]): string {
  return patterns.map((pattern) => patternSource(pattern, "[^[:alpha:]]")).join("|");
}

function topicJsRegex(patterns: readonly string[]): RegExp {
  return new RegExp(
    patterns.map((pattern) => patternSource(pattern, "[^\\p{L}]")).join("|"),
    "iu"
  );
}

/** Drop the trauma stem that only exists inside a PTSD phrase. */
export function textForTraumaMatch(text: string): string {
  return text
    .replace(/post[-\s]?traumat\p{L}*/giu, " ")
    .replace(/创伤后应激障碍?/g, " ")
    .replace(/посттравматич\p{L}*/giu, " ")
    .replace(/心的外傷後?/g, " ");
}

/** Which topic keys a piece of text would count toward. Used to keep the word list honest. */
export function classifyFocus(text: string): string[] {
  const hay = ` ${text}`;
  return FOCUS_TOPICS.filter((topic) => {
    const sample = topic.key === "trauma" ? textForTraumaMatch(hay) : hay;
    return topicJsRegex(topic.patterns).test(sample);
  }).map((topic) => topic.key);
}

export function focusShare(count: number, total: number): number {
  if (total <= 0 || count <= 0) return 0;
  return Math.round((count / total) * 100);
}

const LANGUAGE_CODE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i;

/** `en-US` and `en` share a row. `zh-Hant` stays separate from `zh`. */
export function focusLanguageKey(raw: string | null | undefined): string {
  const code = (raw ?? "").trim().toLowerCase();
  if (!code || code === "unknown" || !LANGUAGE_CODE.test(code)) return "unknown";
  const [primary, second] = code.split("-");
  if (second && /^[a-z]{2}$/.test(second)) return primary || "unknown";
  return second ? `${primary}-${second}` : primary || "unknown";
}

/** Hide a theme until enough different people used those words. */
export function redactFocusTopics(topics: FocusTopicCount[]): {
  topics: FocusTopicCount[];
  hiddenTopics: number;
} {
  const hiddenTopics = topics.filter(
    (topic) => topic.sessions > 0 && topic.people < FOCUS_MIN_PEOPLE
  ).length;
  const safe = topics.map((topic) =>
    topic.sessions > 0 && topic.people < FOCUS_MIN_PEOPLE
      ? { ...topic, sessions: 0, people: 0, sharePct: 0 }
      : topic
  );
  safe.sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label));
  return { topics: safe, hiddenTopics };
}
