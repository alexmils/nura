/**
 * Multilingual opening for AI agent-guided sessions.
 *
 * Only the FIRST agent line is localized. It cycles through the major world
 * languages on screen until the person writes something, then it locks to the
 * language they wrote in and the agent keeps replying in that language for the
 * rest of the session (see `languageInstruction`).
 *
 * App chrome stays English (`protocol-knowledge.ts`); only the guide's spoken
 * lines follow the user.
 */

export interface SessionLanguage {
  /** BCP-47-ish code. Stored on the thread and used in prompts. */
  code: string;
  /** English name, used in the prompt instruction. */
  name: string;
  /** Native endonym shown as the small language kicker. */
  native: string;
  /** Localized opening line. Short, warm, no em dash, no BLS jargon. */
  welcome: string;
  /**
   * Latin-script function words that reliably appear in this language.
   * Languages written in another script are detected by script instead.
   */
  hints?: string[];
}

/** The canonical English opening (also the stored fallback line). */
export const ENGLISH_WELCOME =
  "Welcome. In a few words, what would you like to work on today?";

/**
 * Rotation order: English first (safe default), then a tour of the majors.
 * `zh-Hant` is included on purpose so traditional-Chinese readers see their script.
 */
export const SESSION_LANGUAGES: SessionLanguage[] = [
  {
    code: "en",
    name: "English",
    native: "English",
    welcome: ENGLISH_WELCOME,
    hints: [
      "the",
      "and",
      "today",
      "what",
      "would",
      "like",
      "want",
      "work",
      "feel",
      "about",
      "with",
      "help",
      "anxiety",
      "anxious",
      "stress",
      "think",
      "memory",
    ],
  },
  {
    code: "es",
    name: "Spanish",
    native: "Español",
    welcome: "Bienvenido. En pocas palabras, ¿en qué te gustaría trabajar hoy?",
    hints: [
      "hola",
      "hoy",
      "quiero",
      "trabajar",
      "ansiedad",
      "siento",
      "estoy",
      "necesito",
      "mucho",
      "pero",
      "porque",
      "también",
      "conmigo",
      "ayuda",
    ],
  },
  {
    code: "fr",
    name: "French",
    native: "Français",
    welcome:
      "Bienvenue. En quelques mots, sur quoi aimeriez-vous travailler aujourd'hui ?",
    hints: [
      "bonjour",
      "aujourd",
      "voudrais",
      "travailler",
      "anxiété",
      "mon",
      "avec",
      "pour",
      "beaucoup",
      "mais",
      "parce",
      "aussi",
      "aider",
      "besoin",
      "je",
    ],
  },
  {
    code: "de",
    name: "German",
    native: "Deutsch",
    welcome: "Willkommen. In wenigen Worten, woran möchtest du heute arbeiten?",
    hints: [
      "hallo",
      "ich",
      "heute",
      "möchte",
      "arbeiten",
      "angst",
      "bin",
      "nicht",
      "mir",
      "mich",
      "aber",
      "weil",
      "sehr",
      "hilfe",
    ],
  },
  {
    code: "pt",
    name: "Portuguese",
    native: "Português",
    welcome:
      "Bem-vindo. Em poucas palavras, no que você gostaria de trabalhar hoje?",
    hints: [
      "olá",
      "hoje",
      "quero",
      "trabalhar",
      "ansiedade",
      "sinto",
      "estou",
      "preciso",
      "muito",
      "mas",
      "porque",
      "também",
      "ajuda",
      "você",
    ],
  },
  {
    code: "it",
    name: "Italian",
    native: "Italiano",
    welcome:
      "Benvenuto. In poche parole, su cosa ti piacerebbe lavorare oggi?",
    hints: [
      "ciao",
      "oggi",
      "vorrei",
      "lavorare",
      "ansia",
      "sono",
      "perché",
      "anche",
      "molto",
      "aiuto",
      "non",
      "che",
      "con",
    ],
  },
  {
    code: "nl",
    name: "Dutch",
    native: "Nederlands",
    welcome: "Welkom. In een paar woorden, waar wil je vandaag aan werken?",
    hints: [
      "ik",
      "vandaag",
      "wil",
      "werken",
      "angst",
      "ben",
      "niet",
      "mij",
      "heel",
      "omdat",
      "maar",
      "hulp",
    ],
  },
  {
    code: "sr",
    name: "Serbian",
    native: "Srpski",
    welcome:
      "Dobro došli. U nekoliko reči, na čemu biste danas želeli da radite?",
    hints: [
      // Written with and without diacritics (phones usually drop them).
      "šta",
      "sta",
      "gde",
      "želim",
      "zelim",
      "hoću",
      "hocu",
      "danas",
      "osećam",
      "osecam",
      "osećaj",
      "osecaj",
      "osećanja",
      "nedovoljnost",
      "nedovolj",
      "vreme",
      "uopšte",
      "uopste",
      "takođe",
      "takodje",
      "nešto",
      "nesto",
      "mnogo",
      "kako",
      "molim",
      "radim",
      "život",
      "zivot",
      "svakodnev",
      "posao",
      "posla",
      "poslu",
      "ljudi",
      "pomoć",
      "pomoc",
      "sada",
      "posle",
      "jako",
      "veoma",
      "strah",
      "tuga",
      "tužn",
      "tuzn",
      "umor",
      "najviše",
      "najvise",
      "razumem",
      "osećaš",
      "osecas",
    ],
  },
  {
    code: "hr",
    name: "Croatian",
    native: "Hrvatski",
    welcome:
      "Dobro došli. U nekoliko riječi, na čemu biste danas željeli raditi?",
    hints: [
      "što",
      "sto",
      "gdje",
      "želim",
      "zelim",
      "danas",
      "osjećam",
      "osjecam",
      "osjećaj",
      "osjecaj",
      "vrijeme",
      "uopće",
      "uopce",
      "također",
      "takoder",
      "nešto",
      "nesto",
      "raditi",
      "kako",
      "molim",
      "život",
      "zivot",
      "posao",
      "posla",
      "poslu",
      "ljudi",
      "pomoć",
      "pomoc",
      "sada",
      "jako",
      "veoma",
      "strah",
      "tuga",
      "umor",
    ],
  },
  {
    code: "ru",
    name: "Russian",
    native: "Русский",
    welcome:
      "Добро пожаловать. В нескольких словах, над чем вы хотели бы поработать сегодня?",
  },
  {
    code: "uk",
    name: "Ukrainian",
    native: "Українська",
    welcome:
      "Вітаю. У кількох словах, над чим ви хотіли б сьогодні попрацювати?",
  },
  {
    code: "pl",
    name: "Polish",
    native: "Polski",
    welcome: "Witamy. W kilku słowach, nad czym chciałbyś dziś pracować?",
    hints: [
      "dzisiaj",
      "dzis",
      "chcę",
      "chce",
      "pracować",
      "pracowac",
      "lęk",
      "lek",
      "jestem",
      "się",
      "sie",
      "że",
      "ze",
      "ale",
      "bardzo",
      "pomóc",
      "pomoc",
      "nie",
      "czuję",
      "czuje",
      "moje",
      "mnie",
    ],
  },
  {
    code: "cs",
    name: "Czech",
    native: "Čeština",
    welcome: "Vítejte. V několika slovech, na čem byste dnes chtěli pracovat?",
    hints: [
      "dnes",
      "chci",
      "pracovat",
      "úzkost",
      "uzkost",
      "jsem",
      "se",
      "že",
      "ze",
      "ale",
      "protože",
      "protoze",
      "moc",
      "pomoct",
      "cítím",
      "citim",
    ],
  },
  {
    code: "sk",
    name: "Slovak",
    native: "Slovenčina",
    welcome: "Vitajte. V niekoľkých slovách, na čom by ste dnes chceli pracovať?",
    hints: [
      "dnes",
      "chcem",
      "pracovať",
      "pracovat",
      "úzkosť",
      "uzkost",
      "som",
      "sa",
      "že",
      "ze",
      "ale",
      "pretože",
      "pretoze",
      "veľmi",
      "velmi",
      "pomôcť",
      "citim",
    ],
  },
  {
    code: "sl",
    name: "Slovenian",
    native: "Slovenščina",
    welcome: "Dobrodošli. V nekaj besedah, na čem bi danes radi delali?",
    hints: [
      "danes",
      "želim",
      "zelim",
      "delati",
      "teskoba",
      "sem",
      "da",
      "nekaj",
      "lahko",
      "vendar",
      "zelo",
      "pomagaj",
      "čutim",
      "cutim",
    ],
  },
  {
    code: "bg",
    name: "Bulgarian",
    native: "Български",
    welcome:
      "Добре дошли. С няколко думи, върху какво бихте искали да работите днес?",
  },
  {
    code: "mk",
    name: "Macedonian",
    native: "Македонски",
    welcome:
      "Добредојдовте. Со неколку зборови, на што би сакале да работите денес?",
  },
  {
    code: "ro",
    name: "Romanian",
    native: "Română",
    welcome:
      "Bine ați venit. În câteva cuvinte, la ce ați dori să lucrați astăzi?",
    hints: [
      "astăzi",
      "vreau",
      "lucra",
      "anxietate",
      "sunt",
      "dar",
      "pentru",
      "foarte",
      "ajutor",
      "mă",
      "nu",
    ],
  },
  {
    code: "hu",
    name: "Hungarian",
    native: "Magyar",
    welcome: "Üdvözöljük. Néhány szóban, min szeretne ma dolgozni?",
    hints: [
      "szeretnék",
      "dolgozni",
      "szorongás",
      "vagyok",
      "nem",
      "és",
      "mert",
      "nagyon",
      "segíts",
      "velem",
    ],
  },
  {
    code: "el",
    name: "Greek",
    native: "Ελληνικά",
    welcome:
      "Καλώς ήρθατε. Με λίγα λόγια, σε τι θα θέλατε να δουλέψετε σήμερα;",
  },
  {
    code: "tr",
    name: "Turkish",
    native: "Türkçe",
    welcome:
      "Hoş geldiniz. Birkaç kelimeyle, bugün ne üzerinde çalışmak istersiniz?",
    hints: [
      "bugün",
      "bugun",
      "üzerinde",
      "uzerinde",
      "çalışmak",
      "calismak",
      "istiyorum",
      "kaygı",
      "kaygi",
      "endişe",
      "endise",
      "ama",
      "için",
      "icin",
      "bana",
      "yardım",
      "yardim",
      "çok",
      "cok",
      "hissediyorum",
    ],
  },
  {
    code: "sv",
    name: "Swedish",
    native: "Svenska",
    welcome: "Välkommen. Med några ord, vad vill du arbeta med i dag?",
    hints: [
      "jag",
      "idag",
      "vill",
      "arbeta",
      "ångest",
      "är",
      "inte",
      "med",
      "men",
      "eftersom",
      "hjälp",
    ],
  },
  {
    code: "da",
    name: "Danish",
    native: "Dansk",
    welcome: "Velkommen. Med få ord, hvad vil du gerne arbejde med i dag?",
    hints: [
      "jeg",
      "gerne",
      "arbejde",
      "angst",
      "ikke",
      "fordi",
      "hjælp",
      "meget",
    ],
  },
  {
    code: "nb",
    name: "Norwegian",
    native: "Norsk",
    welcome: "Velkommen. Med noen få ord, hva vil du jobbe med i dag?",
    hints: ["jeg", "jobbe", "engstelig", "ikke", "fordi", "hjelp", "veldig"],
  },
  {
    code: "fi",
    name: "Finnish",
    native: "Suomi",
    welcome:
      "Tervetuloa. Muutamalla sanalla, minkä parissa haluaisit työskennellä tänään?",
    hints: [
      "minä",
      "tänään",
      "haluan",
      "työskennellä",
      "ahdistus",
      "olen",
      "mutta",
      "koska",
      "apua",
      "en",
    ],
  },
  {
    code: "he",
    name: "Hebrew",
    native: "עברית",
    welcome: "ברוכים הבאים. בכמה מילים, על מה תרצו לעבוד היום?",
  },
  {
    code: "ar",
    name: "Arabic",
    native: "العربية",
    welcome: "أهلاً بك. ببضع كلمات، على ماذا تود أن تعمل اليوم؟",
  },
  {
    code: "fa",
    name: "Persian",
    native: "فارسی",
    welcome: "خوش آمدید. در چند کلمه، امروز روی چه چیزی می‌خواهید کار کنید؟",
  },
  {
    code: "ur",
    name: "Urdu",
    native: "اردو",
    welcome: "خوش آمدید۔ چند الفاظ میں بتائیے، آج آپ کس چیز پر کام کرنا چاہیں گے؟",
  },
  {
    code: "hi",
    name: "Hindi",
    native: "हिन्दी",
    welcome: "स्वागत है। कुछ शब्दों में बताइए, आज आप किस चीज़ पर काम करना चाहेंगे?",
  },
  {
    code: "bn",
    name: "Bengali",
    native: "বাংলা",
    welcome: "স্বাগতম। কয়েকটি শব্দে বলুন, আজ আপনি কী নিয়ে কাজ করতে চান?",
  },
  {
    code: "ta",
    name: "Tamil",
    native: "தமிழ்",
    welcome:
      "வரவேற்கிறோம். சில வார்த்தைகளில், இன்று எதில் வேலை செய்ய விரும்புகிறீர்கள்?",
  },
  {
    code: "te",
    name: "Telugu",
    native: "తెలుగు",
    welcome:
      "స్వాగతం. కొన్ని మాటల్లో, ఈరోజు మీరు ఏ విషయంపై పని చేయాలనుకుంటున్నారు?",
  },
  {
    code: "zh",
    name: "Chinese (Simplified)",
    native: "中文",
    welcome: "欢迎。用几句话说说，今天你想处理什么？",
  },
  {
    code: "zh-Hant",
    name: "Chinese (Traditional)",
    native: "繁體中文",
    welcome: "歡迎。用幾句話說說，今天你想處理什麼？",
  },
  {
    code: "ja",
    name: "Japanese",
    native: "日本語",
    welcome: "ようこそ。ひと言で、今日は何に取り組みたいですか？",
  },
  {
    code: "ko",
    name: "Korean",
    native: "한국어",
    welcome: "환영합니다. 몇 마디로, 오늘 무엇을 다루고 싶으신가요?",
  },
  {
    code: "th",
    name: "Thai",
    native: "ไทย",
    welcome: "ยินดีต้อนรับ เล่าสั้น ๆ ว่าวันนี้อยากทำเรื่องอะไร",
  },
  {
    code: "vi",
    name: "Vietnamese",
    native: "Tiếng Việt",
    welcome: "Chào mừng. Trong vài từ, hôm nay bạn muốn làm việc với điều gì?",
    hints: ["hôm", "nay", "muốn", "việc", "lắng", "tôi", "nhưng", "giúp", "rất"],
  },
  {
    code: "id",
    name: "Indonesian",
    native: "Indonesia",
    welcome:
      "Selamat datang. Dalam beberapa kata, apa yang ingin Anda kerjakan hari ini?",
    hints: [
      "saya",
      "ingin",
      "bekerja",
      "kecemasan",
      "tidak",
      "dengan",
      "untuk",
      "sangat",
      "membantu",
    ],
  },
  {
    code: "ms",
    name: "Malay",
    native: "Melayu",
    welcome:
      "Selamat datang. Dalam beberapa patah perkataan, apa yang ingin anda kerjakan hari ini?",
    hints: [
      "saya",
      "mahu",
      "bekerja",
      "kebimbangan",
      "tidak",
      "dengan",
      "untuk",
      "sangat",
      "tolong",
      "tetapi",
    ],
  },
  {
    code: "fil",
    name: "Filipino",
    native: "Filipino",
    welcome:
      "Maligayang pagdating. Sa ilang salita, ano ang gusto mong pagtuunan ng pansin ngayon?",
    hints: [
      "ako",
      "gusto",
      "ngayon",
      "magtrabaho",
      "pagod",
      "hindi",
      "pero",
      "para",
      "tulungan",
      "sobra",
    ],
  },
  {
    code: "sw",
    name: "Swahili",
    native: "Kiswahili",
    welcome:
      "Karibu. Kwa maneno machache, ungependa kufanyia kazi nini leo?",
    hints: [
      "karibu",
      "leo",
      "nataka",
      "kufanya",
      "kazi",
      "wasiwasi",
      "lakini",
      "sana",
      "nisaidie",
    ],
  },
];

const LANGUAGE_BY_CODE = new Map(
  SESSION_LANGUAGES.map((lang) => [lang.code, lang])
);
/** Every known opening line (any language) — used for idempotent rewriting. */
const WELCOME_LINES = new Set(
  SESSION_LANGUAGES.map((lang) => lang.welcome.trim())
);

export function languageByCode(code?: string | null): SessionLanguage | null {
  if (!code) return null;
  return LANGUAGE_BY_CODE.get(code) ?? null;
}

/** Opening line for a language code, falling back to English. */
export function welcomeLineFor(code?: string | null): string {
  return languageByCode(code)?.welcome ?? ENGLISH_WELCOME;
}

/** True when this agent line is the (localizable) opening welcome. */
export function isWelcomeOpening(text?: string | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return trimmed === ENGLISH_WELCOME || WELCOME_LINES.has(trimmed);
}

/**
 * System-prompt line that pins the reply language once it is known.
 * Returns an empty string for English (the default) so no noise is added.
 */
export function languageInstruction(code?: string | null): string {
  const lang = languageByCode(code);
  if (!lang || lang.code === "en") return "";
  return `The user writes in ${lang.name} (${lang.code}). Reply only in ${lang.name}, in the script the user used, and keep replying in it until the user switches. Score scales and app labels stay as the app shows them.`;
}

/* ------------------------------------------------------------------ */
/* Detection                                                           */
/* ------------------------------------------------------------------ */

type ScriptId =
  | "kana"
  | "hangul"
  | "cjk"
  | "greek"
  | "hebrew"
  | "arabic"
  | "thai"
  | "devanagari"
  | "bengali"
  | "tamil"
  | "telugu"
  | "cyrillic"
  | "latin";

const SCRIPT_PATTERNS: { id: ScriptId; re: RegExp }[] = [
  { id: "kana", re: /[\u3040-\u30ff]/ },
  { id: "hangul", re: /[\u1100-\u11ff\uac00-\ud7af]/ },
  { id: "cjk", re: /[\u4e00-\u9fff]/ },
  { id: "greek", re: /[\u0370-\u03ff]/ },
  { id: "hebrew", re: /[\u0590-\u05ff]/ },
  { id: "arabic", re: /[\u0600-\u06ff\u0750-\u077f]/ },
  { id: "thai", re: /[\u0e00-\u0e7f]/ },
  { id: "devanagari", re: /[\u0900-\u097f]/ },
  { id: "bengali", re: /[\u0980-\u09ff]/ },
  { id: "tamil", re: /[\u0b80-\u0bff]/ },
  { id: "telugu", re: /[\u0c00-\u0c7f]/ },
  { id: "cyrillic", re: /[\u0400-\u04ff]/ },
];

const LETTER_RE = /[\p{L}\p{N}]/gu;
/**
 * Han characters whose simplified and traditional forms differ, most-used first.
 * A message is Traditional when it carries more traditional forms than simplified.
 */
const HAN_VARIANTS: [string, string][] = [
  ["们", "們"],
  ["这", "這"],
  ["说", "說"],
  ["么", "麼"],
  ["学", "學"],
  ["国", "國"],
  ["东", "東"],
  ["与", "與"],
  ["为", "為"],
  ["对", "對"],
  ["开", "開"],
  ["关", "關"],
  ["时", "時"],
  ["间", "間"],
  ["样", "樣"],
  ["处", "處"],
  ["虑", "慮"],
  ["爱", "愛"],
  ["乐", "樂"],
  ["语", "語"],
  ["点", "點"],
  ["见", "見"],
  ["华", "華"],
  ["电", "電"],
  ["话", "話"],
  ["车", "車"],
  ["书", "書"],
  ["长", "長"],
  ["门", "門"],
  ["问", "問"],
  ["头", "頭"],
  ["还", "還"],
  ["进", "進"],
  ["远", "遠"],
  ["动", "動"],
  ["员", "員"],
  ["风", "風"],
  ["飞", "飛"],
  ["马", "馬"],
  ["鸟", "鳥"],
  ["鱼", "魚"],
  ["龙", "龍"],
];
const SIMPLIFIED_HAN = new Set(HAN_VARIANTS.map(([simp]) => simp));
const TRADITIONAL_HAN = new Set(HAN_VARIANTS.map(([, trad]) => trad));
const SERBIAN_CYR = /[љћђ]/;
const MACEDONIAN_CYR = /[ќѓѕ]/;
const UKRAINIAN_CYR = /[їєґ]/;
const RUSSIAN_CYR = /[ыэё]/;
const URDU_ARABIC = /[ےھٹڈڑںۂ]/;
/** Persian-only letterforms (Urdu shares them, so Urdu markers are checked first). */
const PERSIAN_ARABIC = /[پچژگکی]/;

const SPLIT_RE = new RegExp("[^\\p{L}\\p{N}]+", "u");

/** Letters NFD does not decompose; fold them so "đ" == "d", "æ" == "ae". */
const SPECIAL_FOLD: Record<string, string> = {
  đ: "d",
  Đ: "d",
  ø: "o",
  Ø: "o",
  æ: "ae",
  Æ: "ae",
  ß: "ss",
  ł: "l",
  Ł: "l",
  þ: "th",
  ð: "d",
  ı: "i",
};

/**
 * Case- and accent-insensitive form of a word. People type Serbian, Polish or
 * Turkish without diacritics all the time, so hints and tokens are compared
 * folded.
 */
function fold(value: string): string {
  const swapped = value.replace(
    /[đĐøØæÆßłŁþðı]/g,
    (char) => SPECIAL_FOLD[char] ?? char
  );
  return swapped
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hintSet(hints: string[] | undefined): Set<string> {
  return new Set((hints ?? []).map(fold));
}

const HINTS_BY_CODE = new Map<string, Set<string>>(
  SESSION_LANGUAGES.map((lang) => [lang.code, hintSet(lang.hints)])
);

/**
 * A hint scores 2 when it is long enough to act as a stem, otherwise 1. Two
 * points are needed to trust a Latin script: either two ordinary words, or one
 * unmistakable one.
 */
const STRONG_HINT_LEN = 6;
const LATIN_MIN_SCORE = 2;

function scoreScript(text: string): { id: ScriptId; count: number } | null {
  const letters = text.match(LETTER_RE)?.length ?? 0;
  if (letters === 0) return null;
  let best: { id: ScriptId; count: number } | null = null;
  for (const { id, re } of SCRIPT_PATTERNS) {
    const matches = text.match(new RegExp(re.source, "gu"));
    const count = matches?.length ?? 0;
    if (count === 0) continue;
    if (!best || count > best.count) best = { id, count };
  }
  if (!best) return null;
  // A stray character in an otherwise Latin message must not win.
  if (best.count < 2 || best.count < letters * 0.4) return null;
  return best;
}

function detectCyrillic(text: string): SessionLanguage {
  if (MACEDONIAN_CYR.test(text)) return LANGUAGE_BY_CODE.get("mk")!;
  if (SERBIAN_CYR.test(text)) return LANGUAGE_BY_CODE.get("sr")!;
  if (UKRAINIAN_CYR.test(text)) return LANGUAGE_BY_CODE.get("uk")!;
  if (/\u0458/.test(text)) return LANGUAGE_BY_CODE.get("sr")!;
  if (/\u0456/.test(text)) return LANGUAGE_BY_CODE.get("uk")!;
  if (RUSSIAN_CYR.test(text)) return LANGUAGE_BY_CODE.get("ru")!;
  if (/\u044A/.test(text)) return LANGUAGE_BY_CODE.get("bg")!;
  return LANGUAGE_BY_CODE.get("ru")!;
}

function detectArabic(text: string): SessionLanguage {
  if (URDU_ARABIC.test(text)) return LANGUAGE_BY_CODE.get("ur")!;
  if (PERSIAN_ARABIC.test(text)) return LANGUAGE_BY_CODE.get("fa")!;
  return LANGUAGE_BY_CODE.get("ar")!;
}

function detectHan(text: string): SessionLanguage {
  let simplified = 0;
  let traditional = 0;
  for (const char of text) {
    if (TRADITIONAL_HAN.has(char)) traditional += 1;
    else if (SIMPLIFIED_HAN.has(char)) simplified += 1;
  }
  return LANGUAGE_BY_CODE.get(traditional > simplified ? "zh-Hant" : "zh")!;
}

function scriptToLanguage(id: ScriptId, text: string): SessionLanguage {
  switch (id) {
    case "kana":
      return LANGUAGE_BY_CODE.get("ja")!;
    case "hangul":
      return LANGUAGE_BY_CODE.get("ko")!;
    case "cjk":
      return detectHan(text);
    case "greek":
      return LANGUAGE_BY_CODE.get("el")!;
    case "hebrew":
      return LANGUAGE_BY_CODE.get("he")!;
    case "arabic":
      return detectArabic(text);
    case "thai":
      return LANGUAGE_BY_CODE.get("th")!;
    case "devanagari":
      return LANGUAGE_BY_CODE.get("hi")!;
    case "bengali":
      return LANGUAGE_BY_CODE.get("bn")!;
    case "tamil":
      return LANGUAGE_BY_CODE.get("ta")!;
    case "telugu":
      return LANGUAGE_BY_CODE.get("te")!;
    case "cyrillic":
      return detectCyrillic(text);
    default:
      return LANGUAGE_BY_CODE.get("en")!;
  }
}

function detectLatin(text: string): SessionLanguage | null {
  const tokens = new Set(fold(text).split(SPLIT_RE).filter(Boolean));
  if (tokens.size === 0) return null;

  let best: SessionLanguage | null = null;
  let bestScore = 0;

  for (const lang of SESSION_LANGUAGES) {
    const hints = HINTS_BY_CODE.get(lang.code);
    if (!hints?.size) continue;
    let score = 0;
    for (const token of tokens) {
      if (hints.has(token)) {
        score += token.length >= STRONG_HINT_LEN ? 2 : 1;
        continue;
      }
      // Light stemming: an inflection ("nedovoljnosti") matches its hint
      // ("nedovolj") so inflected Slavic words still count.
      if (token.length <= STRONG_HINT_LEN) continue;
      for (const hint of hints) {
        if (hint.length >= STRONG_HINT_LEN && token.startsWith(hint)) {
          score += 2;
          break;
        }
      }
    }
    if (score === 0) continue;
    // Ties keep the earlier entry (English is first, so it wins by default).
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }

  if (!best || bestScore < LATIN_MIN_SCORE) return null;
  return best;
}

/**
 * Best-effort language of a free-text message. Returns `null` when unsure,
 * which keeps the app on English.
 */
export function detectSessionLanguage(
  text?: string | null
): SessionLanguage | null {
  if (!text) return null;
  const sample = text.trim().slice(0, 400);
  if (sample.length < 2) return null;

  const script = scoreScript(sample);
  if (script && script.id !== "latin") {
    return scriptToLanguage(script.id, sample);
  }
  return detectLatin(sample);
}
