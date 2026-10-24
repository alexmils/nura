/**
 * Problem reports: pure rules (no DB, no mailer) so tests can pin them.
 * Storage and side effects live in lib/problem-reports.ts.
 *
 * Detection is deterministic and runs on the server for every guided chat
 * turn, next to the fallback crisis check (lib/crisis-detect.ts). It looks
 * for a person telling the guide that the APP is not working: the ball is
 * missing or stuck, there is no sound, a page or session does not load, a
 * button does nothing, the app crashed or shows an error.
 *
 * Conservative on purpose: every pattern ties the complaint to something
 * technical (ball, sound, screen, page, app, button, error...). Emotional
 * language such as "I can't see a way out", "I feel stuck", "my mind froze"
 * or "I have no voice" never matches.
 *
 * Languages: English, German, Spanish, Italian, French and Serbian (Latin
 * script). Text is folded first (case, accents, umlauts, curly apostrophes).
 */

import { isCrisisText } from "./crisis-detect";

export type ProblemCategory = "ball" | "audio" | "loading" | "button" | "crash" | "other";
export type ProblemLanguage = "en" | "de" | "es" | "it" | "fr" | "sr";
export type ProblemReportStatus = "new" | "confirmed" | "dismissed" | "winback_sent";

/** Where a report came from. */
export type ProblemSource = "guide_session" | "help_chat" | "admin";
export const PROBLEM_SOURCES: readonly ProblemSource[] = ["guide_session", "help_chat", "admin"];
export const PROBLEM_SOURCE_LABEL: Record<ProblemSource, string> = {
  guide_session: "AI guide session",
  help_chat: "Help chat",
  admin: "Admin",
};
export function isProblemSource(v: unknown): v is ProblemSource {
  return typeof v === "string" && (PROBLEM_SOURCES as readonly string[]).includes(v);
}

/**
 * Short line the help chat adds to its reply when it logged a report, in the
 * language the person wrote in (English when unknown).
 */
const ACK_LINES: Record<ProblemLanguage, string> = {
  en: "I have passed this on to our team as a technical problem report, so someone can look into it.",
  de: "Ich habe das als technisches Problem an unser Team weitergegeben, damit es sich jemand ansieht.",
  es: "He enviado esto a nuestro equipo como un informe de problema t\u00e9cnico para que alguien lo revise.",
  it: "Ho inoltrato la segnalazione al nostro team come problema tecnico, cos\u00ec qualcuno potr\u00e0 controllare.",
  fr: "J'ai transmis cela \u00e0 notre \u00e9quipe comme signalement de probl\u00e8me technique, pour que quelqu'un s'en occupe.",
  sr: "Prijava tehni\u010dkog problema je prosle\u0111ena na\u0161em timu, da neko to proveri.",
};
export function problemReportAckLine(language: string | null | undefined): string {
  return (language && ACK_LINES[language as ProblemLanguage]) || ACK_LINES.en;
}

/**
 * Help chat: report + confirmation line, or null. Crisis language always
 * wins (no report, no line), the same priority as the guided sessions.
 */
export function helpChatProblemDecision(
  text: string | null | undefined
): { category: ProblemCategory; language: ProblemLanguage | null; ackLine: string } | null {
  if (isCrisisText(text)) return null;
  const match = detectAppProblem(text);
  if (!match) return null;
  return { ...match, ackLine: problemReportAckLine(match.language) };
}

export const PROBLEM_REPORT_STATUSES: readonly ProblemReportStatus[] = [
  "new",
  "confirmed",
  "dismissed",
  "winback_sent",
];

export const PROBLEM_CATEGORY_LABEL: Record<ProblemCategory, string> = {
  ball: "Ball not visible / stuck",
  audio: "No sound / voice",
  loading: "Page or session not loading",
  button: "Button not working",
  crash: "App crash / error",
  other: "Other app problem",
};

export const PROBLEM_STATUS_LABEL: Record<ProblemReportStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  dismissed: "Dismissed",
  winback_sent: "Win-back sent",
};

/** Same user + same session within this window merges into one report. */
export const PROBLEM_MERGE_WINDOW_MS = 6 * 60 * 60 * 1000;
/** At most one admin alert email per user in this window. */
export const PROBLEM_ALERT_WINDOW_MS = 6 * 60 * 60 * 1000;
export const PROBLEM_EXCERPT_MAX = 500;
export const PROBLEM_NOTE_MAX = 2000;
export const PROBLEM_REPORTS_ADMIN_PATH = "/admin/billing?tab=problems";

/** Lowercase, no accents, sz->ss, dj for the Serbian d-stroke, straight apostrophes. */
export function foldProblemText(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/[\u2018\u2019\u02bc\u00b4\u0060]/g, "'")
    .replace(/\u00df/g, "ss")
    .replace(/[\u0111\u0110]/g, "dj")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type Rule = [ProblemCategory, RegExp];

/** Up to ~40 characters inside one sentence between the thing and the verb. */
const NEAR = "[^.!?\\n]{0,40}";
const near = (a: string, b: string) => new RegExp(`${a}${NEAR}${b}`);

const SHARED: Rule[] = [
  ["crash", /\b(bug|bugs|buggy|bugged)\b(?! me\b)/],
  ["crash", /\b(error (code|message)|internal server error|http ?[45]\d\d|error [45]\d\d|404 (error|not found))\b/],
  ["crash", /\btechnical (problem|issue|glitch|error|difficult(y|ies))\b/],
];

const EN_STATE =
  "(stuck|frozen|froze|not moving|doesn'?t move|does not move|won'?t move|isn'?t moving|is not moving|stopped moving|disappeared|vanished|missing|not (showing|visible|appearing|there)|doesn'?t (show|appear|start)|does not (show|appear|start)|won'?t (start|show|appear|load)|isn'?t (there|showing|visible|appearing)|is gone|not loading)";
const EN_BROKEN =
  "(not working|doesn'?t work|does not work|isn'?t working|is not working|won'?t work|stopped working|broken|cuts? out|cutting out|keeps cutting|is muted|crackl\\w*|distorted)";
const EN_APP = "(app|application|site|website|web ?page|page|screen|browser|tab|session|player)";
/** No "session" here: "this session I feel stuck" is not a crash. */
const EN_APP_CRASH = "(app|application|site|website|web ?page|page|screen|browser)";

const BY_LANGUAGE: [ProblemLanguage, Rule[]][] = [
  [
    "en",
    [
      ["ball", /\b(can'?t|cannot|can not|don'?t|do not|unable to|couldn'?t) see (the |a |any |your )?(moving )?(ball|dot)\b/],
      ["ball", near("\\b(the |a |that |this )?(ball|dot)\\b", `\\b${EN_STATE}\\b`)],
      ["ball", /\b(there'?s|there is|i see|i get|i got) no (ball|dot)\b/],
      ["ball", /\b(ball|dot) (is|was|keeps|kept) (stuck|frozen|freezing|jumping|glitching|lagging)\b/],
      ["audio", /\b(there'?s|there is|i get|i got|i have|i hear) no (sound|audio|volume)\b/],
      ["audio", /\b(can'?t|cannot|can not|don'?t|do not|unable to|couldn'?t) hear (you|the (sound|audio|voice|guide|tones?|beeps?)|any(thing| sound| audio)? from the app)\b/],
      ["audio", near("(?<!\\bmy )(?<!\\bmy own )\\b(sound|audio|voice|volume|mic|microphone|speaker|tones?|beeps?)\\b", `\\b${EN_BROKEN}\\b`)],
      ["loading", near(`\\b${EN_APP}\\b`, "\\b(won'?t|doesn'?t|does not|will not|isn'?t|is not|not|never) (load|loading|open|opening|start|starting)\\b")],
      ["loading", /\b(blank|white|black|empty|grey|gray) (page|screen)\b/],
      ["loading", /\b(stuck on|keeps|kept|just keeps) (loading|spinning|buffering)\b|\b(loading|spinner|spinning) (forever|for ever|endlessly|non ?stop)\b|\bstuck on (the )?loading\b/],
      ["button", near("\\b(button|buttons|link|start button|stop button|mic button|play button)\\b", "\\b(not working|doesn'?t work|does not work|isn'?t working|won'?t work|does nothing|doesn'?t do anything|does not do anything|nothing happens|unresponsive|not responding|won'?t (click|press|respond))\\b")],
      ["button", /\bnothing happens when i (click|tap|press|hit)\b/],
      ["button", /\b(can'?t|cannot|can not|unable to) (click|tap|press) (the |a |on |any )?(button|start|stop|play|link)\b/],
      ["crash", near(`\\b${EN_APP_CRASH}\\b`, "\\b(crash(ed|es|ing)?|froze|frozen|freez(es|ing)|hangs|hung|stuck|not working|doesn'?t work|does not work|isn'?t working|is not working|stopped working|broken|glitch(ed|es|ing|y)?|lag(s|ging|gy)?|not responding|keeps (closing|reloading|refreshing|crashing))\\b")],
      ["crash", /\b(got|get|getting|see|seeing|shows?|showing|says|saying|keep getting) (an |a |the )?error\b/],
    ],
  ],
  [
    "de",
    [
      ["ball", /\b(sehe|seh) (den |die |keinen |keine |das )?(ball|kugel|baelle|balle)\b[^.!?\n]{0,15}\bnicht\b|\bsehe (keinen ball|keine kugel)\b/],
      ["ball", near("\\b(ball|kugel)\\b", "\\b(nicht (zu sehen|sichtbar|da)|bewegt sich nicht|haengt|hangt|bleibt (stehen|haengen|hangen)|steckt fest|eingefroren|friert ein|verschwunden|ist weg|erscheint nicht|startet nicht)\\b")],
      ["ball", /\bkein(en)? (ball|kugel)\b/],
      ["audio", /\bkein(en)? (ton|sound|audio)\b/],
      ["audio", near("\\b(ton|sound|audio|lautsprecher|mikrofon|mikro)\\b", "\\b(funktioniert nicht|geht nicht|ist weg|kaputt|ist aus|fallt aus|faellt aus)\\b")],
      ["audio", /\b(hoere|hore|hoer|hor) (dich|euch|sie|den ton|die stimme) nicht\b/],
      ["loading", near("\\b(seite|app|website|webseite|bildschirm|sitzung)\\b", "\\b(laedt nicht|ladt nicht|lad nicht|wird nicht geladen|(oeffnet|offnet) (sich )?nicht|startet nicht|bleibt (weiss|schwarz|leer))\\b")],
      ["loading", /\b(weisser|weisse|weiss|schwarzer|schwarze|leerer|leere) (bildschirm|seite)\b/],
      ["loading", /\b(laedt|ladt) (ewig|endlos|die ganze zeit|immer noch)\b/],
      ["button", near("\\b(knopf|button|taste|schaltflaeche|schaltflache)\\b", "\\b(funktioniert nicht|geht nicht|reagiert nicht|tut nichts|passiert nichts)\\b")],
      ["button", /\bwenn ich (klicke|tippe|druecke|drucke)[^.!?\n]{0,25}\bpassiert nichts\b/],
      ["crash", near("\\b(app|anwendung|seite|website|webseite|bildschirm|browser|programm)\\b", "\\b(abgestuerzt|abgesturzt|stuerzt ab|sturzt ab|haengt|hangt|friert ein|eingefroren|funktioniert nicht|geht nicht|kaputt|reagiert nicht|spinnt)\\b")],
      ["crash", /\b(fehlermeldung|fehlercode|fehler ?code|technisches problem|technischer fehler)\b/],
    ],
  ],
  [
    "es",
    [
      ["ball", /\bno (veo|se ve|aparece|sale|se mueve) (la |el )?(pelota|bola|bolita|punto|circulo)\b/],
      ["ball", near("\\b(pelota|bola|bolita)\\b", "\\b(no se mueve|no aparece|no se ve|se queda (quieta|parada|congelada|pegada)|esta (quieta|parada|congelada|atascada|trabada)|se (congelo|trabo|atasco)|desaparecio)\\b")],
      ["audio", /\bno (hay|se oye|se escucha|escucho|oigo) (el |la |ningun |nada de )?(sonido|audio|voz)\b/],
      ["audio", /\bno te (oigo|escucho)\b/],
      ["audio", near("\\b(sonido|audio|microfono|altavoz)\\b", "\\b(no funciona|no va|no anda|falla)\\b")],
      ["loading", near("\\b(pagina|app|aplicacion|web|sitio|pantalla|sesion)\\b", "\\b(no carga|no (se )?abre|no inicia|no arranca|no empieza|se queda cargando|sigue cargando)\\b")],
      ["loading", /\bpantalla (en blanco|blanca|negra|vacia)\b/],
      ["button", near("\\b(boton|botones|enlace)\\b", "\\b(no funciona|no hace nada|no responde|no va)\\b")],
      ["button", /\b(hago clic|hago click|pulso|toco|presiono|le doy)[^.!?\n]{0,25}\bno (pasa|hace) nada\b/],
      ["crash", near("\\b(app|aplicacion|pagina|web|sitio|pantalla|navegador|programa)\\b", "\\b(se (cuelga|colgo|congela|congelo|cierra sola|cerro sola|bloquea|bloqueo|traba|trabo)|no funciona|no va|esta (rota|colgada|congelada|bloqueada)|fallo|falla|crasheo)\\b")],
      ["crash", /\b(mensaje de error|codigo de error|error tecnico|problema tecnico|fallo tecnico)\b/],
    ],
  ],
  [
    "it",
    [
      ["ball", /\bnon (vedo|si vede|appare|compare|si muove) (la |il |piu la )?(palla|pallina|punto|cerchio)\b/],
      ["ball", near("\\b(palla|pallina)\\b", "\\b(non si muove|non (si vede|appare|compare)|e ferma|e bloccata|si blocca|si e (bloccata|fermata)|congelata|sparita|scomparsa)\\b")],
      ["audio", /\bnon (c'e|si sente|sento) (il |l'|la |nessun |alcun )?(suono|audio|voce|volume)\b/],
      ["audio", /\bnon ti sento\b/],
      ["audio", near("\\b(suono|audio|microfono|altoparlante)\\b", "\\b(non funziona|non va|e rotto)\\b")],
      ["loading", near("\\b(pagina|app|applicazione|sito|schermo|schermata|sessione)\\b", "\\b(non (si )?carica|non (si )?apre|non (si )?avvia|non parte|resta (bianca|bianco|nera|nero)|continua a caricare|carica all'infinito)\\b")],
      ["loading", /\bschermo (bianco|nero|vuoto)\b|\bschermata (bianca|nera|vuota)\b/],
      ["button", near("\\b(pulsante|bottone|tasto|link)\\b", "\\b(non funziona|non fa (niente|nulla)|non risponde|non va)\\b")],
      ["button", /\b(clicco|premo|tocco)[^.!?\n]{0,25}\bnon succede (niente|nulla)\b/],
      ["crash", near("\\b(app|applicazione|pagina|sito|schermo|browser|programma)\\b", "\\b(si (blocca|e bloccata|chiude da sola|e chiusa|impalla|e impallata)|crasha|e crashata|non funziona|non va|e bloccata|e rotta)\\b")],
      ["crash", /\b(messaggio di errore|codice (di )?errore|problema tecnico|errore tecnico)\b/],
    ],
  ],
  [
    "fr",
    [
      ["ball", /\bje ne vois (pas|plus) (la |le )?(balle|boule|bille|point|cercle)\b/],
      ["ball", near("\\b(balle|boule|bille)\\b", "\\b(ne bouge (pas|plus)|bloquee?|figee?|coincee?|n'apparait pas|ne s'affiche pas|a disparu|disparait)\\b")],
      ["audio", /\b(pas de|aucun|plus de) (son|audio)\b/],
      ["audio", /\bje ne (t'|vous )entends (pas|plus)\b|\bje n'entends (pas|plus|rien) (la voix|le son|l'audio)\b/],
      ["audio", near("\\b(le son|l'audio|le micro|le microphone|la voix du guide)\\b", "\\b(ne (marche|fonctionne) (pas|plus)|coupe|est coupe)\\b")],
      ["loading", near("\\b(page|appli|application|app|site|ecran|seance|session)\\b", "\\b(ne (se )?charge (pas|plus)|ne s'ouvre pas|ne (se lance|demarre) pas|charge (a l'infini|sans fin|en boucle)|reste (blanche|blanc|noir|noire|vide))\\b")],
      ["loading", /\becran (blanc|noir|vide)\b/],
      ["button", near("\\b(bouton|lien)\\b", "\\b(ne (marche|fonctionne|repond) (pas|plus)|ne fait rien)\\b")],
      ["button", /\bquand je (clique|appuie|touche)[^.!?\n]{0,25}\b(il ne se passe rien|rien ne se passe)\b/],
      ["crash", near("\\b(appli|application|app|page|site|ecran|navigateur)\\b", "\\b(plante|a plante|crashe|a crashe|bugu?e|beugue|freeze|est figee?|est bloquee?|ne (marche|fonctionne|repond) (pas|plus)|se ferme toute seule)\\b")],
      ["crash", /\b(message d'erreur|code d'erreur|probleme technique|erreur technique)\b/],
    ],
  ],
  [
    "sr",
    [
      ["ball", /\bne (vidim|vidi se|pojavljuje se|pomera se|mrda|krece se) (vise )?(lopticu|loptica|loptu|lopta|kuglicu|kuglica|tackicu|tackica)\b/],
      ["ball", near("\\b(loptic\\w*|lopt[aeu]|kuglic\\w*|tackic\\w*)\\b", "\\b(ne (vidim|vidi|pomera|mrda|krece|pojavljuje|radi)|se ne (vidi|pomera|mrda|krece|pojavljuje)|zaglavil\\w*|zaledil\\w*|zamrznul\\w*|zakocil\\w*|stoji|nestal\\w*|stala)\\b")],
      ["audio", /\b(nema|ne cujem|ne cuje se|ne radi) (zvuk\w*|audio|glas vodica|glas aplikacije)\b/],
      ["audio", /\bne cujem (te|vas)\b/],
      ["audio", near("\\b(zvuk\\w*|audio|mikrofon\\w*|zvucnik\\w*)\\b", "\\b(ne radi|ne funkcionise|se prekida|seck\\w*)\\b")],
      ["loading", near("\\b(stranic\\w*|aplikacij\\w*|app|sajt\\w*|ekran|sesij\\w*)\\b", "\\b(ne (ucitava|otvara|pokrece|startuje)|se ne (ucitava|otvara|pokrece)|stalno (ucitava|se vrti))\\b")],
      ["loading", /\b(beo|beli|crn|crni|prazan) ekran\b/],
      ["button", near("\\b(dugme\\w*|dugmic\\w*|taster\\w*|link)\\b", "\\b(ne radi|ne reaguje|ne funkcionise|nista ne radi)\\b")],
      ["button", /\bkad (kliknem|pritisnem|stisnem|kucnem)[^.!?\n]{0,25}\bnista( se)? ne (desava|dogadja|dogodi|desi)\b/],
      ["crash", near("\\b(aplikacij\\w*|app|stranic\\w*|sajt\\w*|ekran|browser|pretrazivac)\\b", "\\b(ne radi|ne funkcionise|puca|pukla|zaglavil\\w*|zablokiral\\w*|zamrznul\\w*|zakocil\\w*|blokira|koci|se srusil\\w*|crash\\w*|krasir\\w*|se ugasil\\w*)\\b")],
      ["crash", /\b(izbacuje|javlja|pise|iskace|izlazi)( mi)? (neku |neka )?(gresk[au]|error)\b|\b(tehnicki problem|poruka o gresci)\b/],
    ],
  ],
];

/**
 * Body / feeling language ("a ball of anxiety in my chest is stuck"). When it
 * is there and nothing clearly technical is, the message is not a report.
 */
const EMOTIONAL_GUARD =
  /\b(ball|knot|lump|wave) (of|in) (my )?(anxiety|fear|tension|stress|anger|pain|panic|emotion|sadness|grief)\b|\bin my (chest|throat|stomach|belly|gut|body|heart)\b|\b(im|in meinem|in meiner) (hals|bauch|brust|magen|herz|korper|koerper)\b|\ben (el |mi )?(pecho|garganta|estomago|cuerpo|corazon)\b|\b(nel|nella) (petto|stomaco|gola|pancia|corpo|cuore)\b|\bdans (la |le |ma |mon )?(gorge|poitrine|ventre|estomac|corps|coeur)\b|\bu (grudima|stomaku|grlu|telu|srcu)\b/;
const TECH_STRONG =
  /\b(app|application|screen|page|button|browser|website|site|sound|audio|bildschirm|seite|knopf|anwendung|ton|pantalla|pagina|boton|aplicacion|sonido|schermo|pulsante|applicazione|suono|ecran|bouton|appli|son|ekran|dugme|aplikacij\w*|stranic\w*|zvuk\w*)\b/;

export interface AppProblemMatch {
  category: ProblemCategory;
  /** Language of the phrase that matched; null for a shared word ("bug"). */
  language: ProblemLanguage | null;
}

/**
 * The person describes an app malfunction, or null. Never throws (a bad
 * input just returns null), so the chat turn can call it inline.
 */
export function detectAppProblem(text: string | null | undefined): AppProblemMatch | null {
  try {
    const t = foldProblemText(typeof text === "string" ? text : "");
    if (!t || t.length < 4) return null;
    if (EMOTIONAL_GUARD.test(t) && !TECH_STRONG.test(t)) return null;
    for (const [language, rules] of BY_LANGUAGE) {
      for (const [category, re] of rules) {
        if (re.test(t)) return { category, language };
      }
    }
    for (const [category, re] of SHARED) {
      if (re.test(t)) return { category, language: null };
    }
    return null;
  } catch {
    return null;
  }
}

export function isAppProblemText(text: string | null | undefined): boolean {
  return detectAppProblem(text) != null;
}

/** Trimmed, single-spaced excerpt, cut on a word boundary with an ellipsis. */
export function problemExcerpt(text: string | null | undefined, max = PROBLEM_EXCERPT_MAX): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}\u2026`;
}

/**
 * A later message in the same session: keep the first complaint and add the
 * newest one, within the excerpt budget. A repeat of text already there is
 * not added twice.
 */
export function mergeProblemExcerpt(
  existing: string,
  incoming: string,
  max = PROBLEM_EXCERPT_MAX
): string {
  const next = problemExcerpt(incoming, max);
  if (!next) return existing;
  if (!existing) return next;
  if (existing.includes(next)) return existing;
  const sep = "\n\u2014\n";
  const joined = `${existing}${sep}${next}`;
  if (joined.length <= max) return joined;
  // Over budget: first complaint (shortened) + the newest one.
  const room = max - next.length - sep.length;
  if (room < 60) return problemExcerpt(next, max);
  const first = existing.split(sep)[0] ?? existing;
  return `${problemExcerpt(first, room)}${sep}${next}`;
}

export type ProblemReportLike = {
  userId: string;
  threadId: string | null;
  status: ProblemReportStatus;
  lastDetectedAt: string | Date;
};

/**
 * Merge a new detection into an existing report: same user, same session,
 * last seen within the window, and the report is still open (new or
 * confirmed). A dismissed or finished report starts a fresh one.
 */
export function shouldMergeProblemReport(
  existing: ProblemReportLike | null | undefined,
  incoming: { userId: string; threadId: string | null; now?: Date },
  windowMs = PROBLEM_MERGE_WINDOW_MS
): boolean {
  if (!existing) return false;
  if (existing.userId !== incoming.userId) return false;
  if ((existing.threadId ?? null) !== (incoming.threadId ?? null)) return false;
  if (existing.status !== "new" && existing.status !== "confirmed") return false;
  const now = (incoming.now ?? new Date()).getTime();
  const last = new Date(existing.lastDetectedAt).getTime();
  if (!Number.isFinite(last)) return false;
  return now - last >= 0 && now - last < windowMs;
}

/** One admin alert email per user per window (any of their reports). */
export function shouldSendProblemAlert(
  lastAlertAt: string | Date | null | undefined,
  now = new Date(),
  windowMs = PROBLEM_ALERT_WINDOW_MS
): boolean {
  if (!lastAlertAt) return true;
  const last = new Date(lastAlertAt).getTime();
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= windowMs;
}

const TRANSITIONS: Record<ProblemReportStatus, readonly ProblemReportStatus[]> = {
  new: ["confirmed", "dismissed"],
  confirmed: ["dismissed", "winback_sent", "new"],
  dismissed: ["new", "confirmed"],
  winback_sent: [],
};

/** Admin status changes. "winback_sent" is only reached by sending the email. */
export function canTransitionProblemReport(
  from: ProblemReportStatus,
  to: ProblemReportStatus
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isProblemReportStatus(v: unknown): v is ProblemReportStatus {
  return typeof v === "string" && (PROBLEM_REPORT_STATUSES as readonly string[]).includes(v);
}

/** Generating a win-back link needs a confirmed report. */
export function canGenerateWinback(status: ProblemReportStatus): boolean {
  return status === "confirmed";
}

export type ProblemEventType =
  | "detected"
  | "merged"
  | "admin_emailed"
  | "admin_email_skipped"
  | "admin_email_failed"
  | "confirmed"
  | "dismissed"
  | "reopened"
  | "note"
  | "link_generated"
  | "email_sent"
  | "email_failed";

export type ProblemEvent = {
  type: ProblemEventType;
  at: string;
  by?: string | null;
  detail?: string | null;
};

export const PROBLEM_EVENT_LABEL: Record<ProblemEventType, string> = {
  detected: "Detected in chat",
  merged: "Another message in the same session",
  admin_emailed: "Admin alert emailed",
  admin_email_skipped: "Admin alert skipped",
  admin_email_failed: "Admin alert failed",
  confirmed: "Confirmed as a real problem",
  dismissed: "Dismissed",
  reopened: "Reopened",
  note: "Note updated",
  link_generated: "Win-back link generated",
  email_sent: "Win-back email sent",
  email_failed: "Win-back email failed",
};

export function statusEventType(to: ProblemReportStatus): ProblemEventType {
  if (to === "confirmed") return "confirmed";
  if (to === "dismissed") return "dismissed";
  return "reopened";
}

export function problemEvent(
  type: ProblemEventType,
  opts: { now?: Date; by?: string | null; detail?: string | null } = {}
): ProblemEvent {
  return {
    type,
    at: (opts.now ?? new Date()).toISOString(),
    by: opts.by ?? null,
    detail: opts.detail ?? null,
  };
}

/* ---------------------------------------------------------------- */
/* Emails                                                           */
/* ---------------------------------------------------------------- */

export function escapeProblemHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plain text -> simple HTML: escaped, paragraphs on blank lines, links clickable. */
export function problemTextToHtml(text: string): string {
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const body = paragraphs
    .map((p) => {
      const html = escapeProblemHtml(p.trim())
        .replace(/(https?:\/\/[^\s<]+)/g, (url) => `<a href="${url}" style="color:#3c6e2f;word-break:break-all">${url}</a>`)
        .replace(/\n/g, "<br>");
      return html ? `<p style="margin:0 0 14px;line-height:1.55">${html}</p>` : "";
    })
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#2a3020;max-width:560px">${body}</div>`;
}

function formatUtc(d: Date): string {
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Short operator alert: who, when, what they wrote, where to look. */
export function buildProblemAlertEmail(input: {
  userEmail: string;
  userName?: string | null;
  detectedAt: Date;
  category: ProblemCategory;
  language: string | null;
  excerpt: string;
  threadTitle?: string | null;
  source?: ProblemSource;
  adminUrl: string;
}): { subject: string; text: string; html: string } {
  const who = input.userName?.trim() ? `${input.userName.trim()} <${input.userEmail}>` : input.userEmail;
  const subject = `Problem report: ${input.userEmail} (${PROBLEM_CATEGORY_LABEL[input.category]})`;
  const lines = [
    input.source === "help_chat"
      ? "Someone told the help chat that the app is not working."
      : "Someone told the AI guide that the app is not working.",
    "",
    `User: ${who}`,
    `Where: ${PROBLEM_SOURCE_LABEL[input.source ?? "guide_session"]}`,
    `Time: ${formatUtc(input.detectedAt)}`,
    `Category: ${PROBLEM_CATEGORY_LABEL[input.category]}`,
    `Language: ${input.language ?? "unknown"}`,
    ...(input.threadTitle ? [`Session: ${input.threadTitle}`] : []),
    "",
    "What they wrote:",
    input.excerpt,
    "",
    `Review it in admin: ${input.adminUrl}`,
    "",
    "You get at most one alert per user every 6 hours.",
  ];
  const text = lines.join("\n");
  return { subject, text, html: problemTextToHtml(text) };
}

export type WinbackEmailDraft = { to: string; subject: string; body: string };
export type WinbackMode = "trial" | "extend";

/** Still paying (and not leaving): the win-back moves the next payment. */
export function winbackModeFor(sub: { status?: string | null; cancelAtPeriodEnd?: boolean | null } | null | undefined): WinbackMode {
  return sub && (sub.status === "active" || sub.status === "trialing") && !sub.cancelAtPeriodEnd
    ? "extend"
    : "trial";
}

export const WINBACK_MODE_NOTE: Record<WinbackMode, string> = {
  extend:
    "Currently paying: redeeming the link moves their next payment 30 days later on the same subscription (no checkout, nothing charged).",
  trial:
    "Not paying: redeeming the link starts a 30-day free trial through Stripe Checkout (card on file, first charge after 30 days).",
};

/** Default customer email for a confirmed problem. The admin can edit it. */
export function buildWinbackEmailDraft(input: {
  to: string;
  name?: string | null;
  link: string;
  expiresAt: Date;
  brand?: string;
  trialDays?: number;
  /**
   * "trial": lapsed, a 30-day trial through checkout (card, no charge).
   * "extend": still paying, the next payment moves 30 days later.
   */
  mode?: WinbackMode;
}): WinbackEmailDraft {
  const brand = input.brand ?? "Nura";
  const days = input.trialDays ?? 30;
  const first = input.name?.trim().split(/\s+/)[0] || "there";
  if (input.mode === "extend") {
    const body = [
      `Hi ${first},`,
      "",
      `Thank you for telling us that something was not working in ${brand} during your session. We looked into it: the problem was on our side, and we are sorry it got in the way of your practice.`,
      "",
      `To make up for it, your next ${days} days of ${brand} are on us. Open your personal link to add them (it works once and is valid until ${formatLongDate(input.expiresAt)}):`,
      "",
      input.link,
      "",
      `Your plan stays as it is: we simply move your next payment ${days} days later. No checkout, no card details, nothing to pay.`,
      "",
      "If anything still does not work, just reply to this email and we will help.",
      "",
      `The ${brand} team`,
    ].join("\n");
    return { to: input.to, subject: `Your next ${days} days of ${brand} are on us`, body };
  }
  const body = [
    `Hi ${first},`,
    "",
    `Thank you for telling us that something was not working in ${brand} during your session. We looked into it: the problem was on our side, and we are sorry it got in the way of your practice.`,
    "",
    `To make up for it, we would like to give you ${days} days of ${brand} free. Use your personal link to start (it works once and is valid until ${formatLongDate(input.expiresAt)}):`,
    "",
    input.link,
    "",
    `You add a card at checkout, but nothing is charged for ${days} days, and you can cancel anytime before then.`,
    "",
    "If anything still does not work, just reply to this email and we will help.",
    "",
    `The ${brand} team`,
  ].join("\n");
  return { to: input.to, subject: `${days} days of ${brand} on us`, body };
}

/** The raw reactivation token inside an email body, or null. */
export function tokenFromWinbackBody(body: string, path = "/reactivate"): string | null {
  const re = new RegExp(`${path.replace(/[/]/g, "\\/")}\\?token=([A-Za-z0-9_%-]+)`);
  const m = body.match(re);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
}

/** The stored snapshot never keeps the live token (the DB only has its hash). */
export function redactWinbackToken(text: string, path = "/reactivate"): string {
  const re = new RegExp(`(${path.replace(/[/]/g, "\\/")}\\?token=)[A-Za-z0-9_%-]+`, "g");
  return text.replace(re, "$1[redacted]");
}

/** Subject/body the admin may send: non-empty, bounded, and still has the link. */
export function validateWinbackEmail(input: {
  subject: unknown;
  body: unknown;
}): { ok: true; subject: string; body: string } | { ok: false; error: string } {
  const subject = typeof input.subject === "string" ? input.subject.replace(/[\r\n]+/g, " ").trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!subject) return { ok: false, error: "Subject is empty" };
  if (subject.length > 200) return { ok: false, error: "Subject is too long" };
  if (!body) return { ok: false, error: "Body is empty" };
  if (body.length > 10_000) return { ok: false, error: "Body is too long" };
  if (!tokenFromWinbackBody(body)) return { ok: false, error: "The body must contain the win-back link" };
  return { ok: true, subject, body };
}

/** ADMIN_ALERT_EMAIL: comma list overrides; "off"/"none" disables; unset = default list. */
export function parseAdminAlertEnv(
  raw: string | null | undefined
): { mode: "default" } | { mode: "off" } | { mode: "list"; emails: string[] } {
  const v = (raw ?? "").trim();
  if (!v) return { mode: "default" };
  if (/^(off|none|false|0|disabled?)$/i.test(v)) return { mode: "off" };
  const emails = [
    ...new Set(
      v
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    ),
  ];
  return emails.length ? { mode: "list", emails } : { mode: "off" };
}
