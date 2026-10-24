/**
 * Dissociation screening for guided sessions (self-help scope, no diagnosis).
 *
 * Standard EMDR preparation screens for dissociation before any processing:
 * frequent derealization / depersonalization needs a slower, more grounded
 * session, and signs of severe dissociation (losing time, memory gaps, being
 * unable to come back, or dissociation together with self-harm risk) mean
 * self-guided processing is not the right fit and a trained EMDR therapist is.
 *
 * Levels stored on the thread (`threads.dissociation`):
 * - "screening": the user said yes to feeling unreal / disconnected, severity
 *   not known yet. The guide asks one gentle follow-up before moving on.
 * - "cautious": mild, occasional or stress-related. Processing may go ahead
 *   with extra grounding, a milder start, short sets and frequent check-ins.
 * - "severe": no reprocessing sets in this app. Grounding and resources only,
 *   plus a recommendation to work with a trained EMDR therapist.
 * Levels only go up within a thread; crisis / risk handling stays first.
 *
 * Pure: no DB or fetch, so the behaviour is pinned by tests.
 */
import type { ProtocolPhase, Thread } from "./types";
import type { SessionInterpretation } from "./session-interpreter";
import { isCrisisText } from "./crisis-detect";

export type DissociationLevel = "screening" | "cautious" | "severe";

const RANK: Record<DissociationLevel, number> = {
  screening: 1,
  cautious: 2,
  severe: 3,
};

const BLS_PHASES: ProtocolPhase[] = ["desensitization", "installation", "body_scan"];

export function asDissociationLevel(value: unknown): DissociationLevel | null {
  return value === "screening" || value === "cautious" || value === "severe"
    ? value
    : null;
}

/** Higher of two levels; a cautious answer after screening is an upgrade. */
export function maxDissociation(
  ...levels: (DissociationLevel | null | undefined)[]
): DissociationLevel | null {
  let best: DissociationLevel | null = null;
  for (const level of levels) {
    if (level && (!best || RANK[level] > RANK[best])) best = level;
  }
  return best;
}

/** Lowercase, no accents, Serbian latin folded (č->c, š->s, ž->z, đ->dj). */
function norm(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/[đĐ]/g, "dj")
    .replace(/ß/g, "ss")
    .replace(/[łŁ]/g, "l")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** A guide line that asks about dissociation (the screening question or its follow-up). */
const QUESTION_RE =
  /(unreal|disconnected|detached|depersonali|dereali|dissociat|zone out|zoning out|spac(e|ing) out|outside (of )?your (body|self)|not in your body|lose (track of )?time|losing time|gaps in (your )?memory|memory gaps|hard to come back|come back to the (here|present)|unwirklich|losgelost|losgeloest|neben dir|neben sich|nicht in (deinem|ihrem) korper|zeit verlier|gedachtnisluck|gedaechtnisluck|schwer zuruck|irreal|desconectad|fuera de (tu|su) cuerpo|pierdes (la nocion del )?tiempo|pierde (la nocion del )?tiempo|lagunas|te cuesta volver|le cuesta volver|irreale|distaccat|scollegat|fuori dal (tuo|proprio) corpo|perdi (la cognizione del )?tempo|vuoti di memoria|fatica a tornare|irreel|deconnecte|detache|hors de (ton|votre) corps|perds la notion du temps|perdez la notion du temps|trous de memoire|du mal a revenir|desligad|fora do (seu|teu) corpo|perde a nocao do tempo|perdes a nocao do tempo|lapsos de memoria|dificil voltar|onwerkelijk|los van (jezelf|uzelf)|tijd kwijt|nierealn|odlaczon|tracisz poczucie czasu|nestvarn|odvojen|odsutn|kao da nis(i|te) u svom telu|izvan (svog )?tela|gubi(s|te) (pojam o )?vreme|rupe u pamcenju|tesko (da )?se vrati)/;

/** The user describing dissociation themselves. */
const DISSOC_SELF_RE =
  /(unreal|disconnected|detached|depersonali|dereali|dissociat|zone out|zoning out|spac(e|ing) out|outside (of )?my (body|self)|not in my body|out of my body|on autopilot|like a dream|unwirklich|neben mir|nicht in meinem korper|losgelost|losgeloest|wie im traum|wie im film|irreal|desconectad[oa] de mi|fuera de mi cuerpo|como en un sueno|como en una pelicula|irreale|distaccat[oa] da me|fuori dal mio corpo|come in un sogno|irreel|deconnecte|detache de moi|hors de mon corps|comme dans un reve|desligad[oa] de mim|fora do meu corpo|como num sonho|como em um sonho|onwerkelijk|als in een droom|nierealn|jak we snie|nestvarn|odvojen(o|a)? od sebe|kao da nisam (u svom telu|tu|ja)|izvan (svog )?tela|iskljucim se|kao u snu)/;

/** Severe signs: lost time, memory gaps, can't come back. */
const SEVERE_RE =
  /(los(e|t|ing) (track of )?time|time (just )?(disappears|goes missing)|gaps? in (my )?memory|memory gaps?|black ?outs?|blank(ed)? out for|can'?t remember (what happened|where i was|doing)|don'?t remember (what happened|doing|how i got)|(hard|difficult|takes (me )?(hours|ages|a long time)) to (come|get) back|can'?t (come|get) back|for hours|find myself (somewhere|in places)|verliere (die |jedes gefuhl fur die |das zeitgefuhl)?zeit|zeit verliere|zeitgefuhl verlier|gedachtnisluck|gedaechtnisluck|filmriss|(komme|finde) (nur )?(schwer|kaum|nicht) (mehr )?zuruck|stundenlang|pierdo (la nocion del |el )?tiempo|lagunas( mentales| de memoria)?|no recuerdo (que|lo que) (paso|hice)|me cuesta (mucho )?volver|no puedo volver|durante horas|perdo (la cognizione del |il senso del |il )?tempo|vuoti di memoria|non ricordo (cosa|che cosa|quello che)|faccio (molta )?fatica a tornare|non riesco a tornare|per ore|perds (la notion du|le fil du) temps|trous de memoire|je ne me souviens (pas|plus) (de ce|ce qui)|du mal a revenir|pendant des heures|perco (a nocao do |o )?tempo|lapsos de memoria|brancos de memoria|nao (me )?lembro (do que|o que)|dificil voltar|nao consigo voltar|por horas|verlies (de |het besef van )?tijd|geheugengaten|urenlang|trace (poczucie )?czas|luki w pamieci|godzinami|gubim (pojam o )?vreme|izgubim (pojam o )?vreme|rupe u pamcenju|ne secam se (sta|gde|kako)|ne mogu da se vratim|tesko (mi je da )?se vra(tim|cam)|satima)/;

/** Frequent / strong, but not on its own severe. */
const FREQUENT_RE =
  /\b(all the time|always|often|a lot|constantly|every ?day|daily|most days|frequently|zone out|zoning out|space out|not in my body|outside (of )?my body|standig|staendig|immer|oft|haufig|haeufig|jeden tag|taglich|taeglich|dauernd|todo el tiempo|siempre|a menudo|con frecuencia|muy seguido|cada dia|todos los dias|sempre|spesso|ogni giorno|tutto il tempo|di continuo|continuamente|tout le temps|souvent|toujours|chaque jour|tous les jours|o tempo todo|frequentemente|muitas vezes|todo dia|todos os dias|vaak|altijd|elke dag|czesto|ciagle|zawsze|codziennie|stalno|cesto|uvek|uvijek|svaki dan|svakodnevno|kao da nisam u svom telu|izvan (svog )?tela|iskljucim se|odlutam)\b/;

const MILD_RE =
  /\b(sometimes|a little|a bit|rarely|once or twice|occasionally|not often|mild(ly)?|now and then|manchmal|ab und zu|selten|ein bisschen|ein wenig|a veces|de vez en cuando|un poco|rara vez|pocas veces|a volte|ogni tanto|un po|raramente|qualche volta|parfois|de temps en temps|un peu|rarement|as vezes|de vez em quando|um pouco|soms|af en toe|een beetje|zelden|czasami|czasem|troche|rzadko|ponekad|malo|retko|rijetko|par puta|nekad)\b/;

const NEG_RE =
  /^(no|nope|never|not really|nah|nein|nie|niemals|nicht wirklich|nunca|non|mai|jamais|pas vraiment|nao|nee|nooit|ne|nikad|nikada|nisam|ne bas|nema)\b/;
const AFFIRM_RE =
  /^(yes|yeah|yep|yup|i do|definitely|sure|ja|si|oui|sim|tak|da|jesam|imam|naravno|desava se)\b/;
const NOW_RE =
  /\b(right now|just now|at the moment|currently|as we speak|gerade|jetzt|im moment|ahora( mismo)?|en este momento|adesso|in questo momento|maintenant|en ce moment|agora|neste momento|op dit moment|teraz|w tej chwili|sada|trenutno|upravo)\b/;

/** Crisis / self-harm words: shared multilingual detector (lib/crisis-detect.ts). */

export interface DissociationScreen {
  /** Level after this turn (never lower than the stored one). */
  level: DissociationLevel | null;
  /** The level changed this turn. */
  changed: boolean;
  /** The message answers a screening question about everyday life, not "now". */
  screeningAnswer: boolean;
  /** The user is dissociating in the session right now: ground first. */
  presentNow: boolean;
}

export function classifyDissociation(input: {
  userMessage: string;
  /** Guide line the user is answering (the screening question). */
  lastAgentMessage?: string | null;
  current?: DissociationLevel | null;
  phase?: ProtocolPhase;
  /** Crisis / self-harm signal this turn. */
  risk?: boolean;
}): DissociationScreen {
  const t = norm(input.userMessage);
  const current = input.current ?? null;
  const asked = QUESTION_RE.test(norm(input.lastAgentMessage));
  const inScreen = asked || current === "screening";
  const selfReport = DISSOC_SELF_RE.test(t);
  const phase = input.phase ?? "intake";
  const midSession = BLS_PHASES.includes(phase) || phase === "assessment";

  let level: DissociationLevel | null = null;
  if (t) {
    if (SEVERE_RE.test(t) && (inScreen || selfReport)) {
      level = "severe";
    } else if (inScreen) {
      const neg = NEG_RE.test(t) && !FREQUENT_RE.test(t);
      if (neg) {
        // "No" to the first question: nothing to flag. "No" to the follow-up
        // (no lost time, can come back): the earlier yes stays, cautiously.
        level = current === "screening" ? "cautious" : null;
      } else if (current === "screening") {
        level = "cautious";
      } else if (MILD_RE.test(t) && !FREQUENT_RE.test(t)) {
        level = "cautious";
      } else {
        level = "screening";
      }
    } else if (selfReport) {
      level = MILD_RE.test(t) && !FREQUENT_RE.test(t) ? "cautious" : "screening";
    }
    if (input.risk && (level || current)) level = "severe";
  }

  const merged = maxDissociation(current, level);
  const presentNow = selfReport && (NOW_RE.test(t) || (midSession && !asked));
  return {
    level: merged,
    changed: merged !== current,
    screeningAnswer: inScreen && level != null && !presentNow,
    presentNow,
  };
}

/** riskNotes that only describe dissociation, not self-harm or crisis. */
function riskIsDissociationOnly(notes: string | null): boolean {
  const n = norm(notes);
  if (!n) return true;
  if (/(suicid|self|harm|kill|crisis|unsafe|not safe|die|death|abuse|violence)/.test(n)) {
    return false;
  }
  return /(dissociat|unreal|dereali|depersonali|disconnect|detach)/.test(n);
}

/**
 * Turn-level screening. Adjusts the interpretation before the phase patch is
 * built: answering "do you ever feel unreal?" about daily life is history, not
 * being out of the window right now, so it must not send the session to the
 * safe place (that is what happened on 2026-10-23).
 */
export function screenDissociationTurn(input: {
  thread: Pick<Thread, "phase" | "dissociation">;
  userMessage: string;
  lastAgentMessage?: string | null;
  interpretation: SessionInterpretation;
}): { interpretation: SessionInterpretation; screen: DissociationScreen } {
  const interp = { ...input.interpretation };
  const crisis =
    isCrisisText(input.userMessage) ||
    (interp.riskFlag && !riskIsDissociationOnly(interp.riskNotes));
  const base = classifyDissociation({
    userMessage: input.userMessage,
    lastAgentMessage: input.lastAgentMessage,
    current: input.thread.dissociation ?? null,
    phase: input.thread.phase,
    risk: crisis,
  });
  const fromModel = asDissociationLevel(interp.dissociation);
  const level = maxDissociation(base.level, fromModel);
  const screen: DissociationScreen = {
    ...base,
    level,
    changed: level !== (input.thread.dissociation ?? null),
  };

  if (screen.screeningAnswer && !screen.presentNow && !crisis) {
    interp.outOfWindow = false;
    interp.needsGrounding = false;
    if (interp.riskFlag) {
      interp.riskFlag = false;
      interp.riskNotes = null;
    }
    if (interp.distress === "overwhelm") interp.distress = "elevated";
  }
  if (screen.presentNow) {
    interp.outOfWindow = true;
    interp.needsGrounding = true;
    interp.startSet = false;
  }
  if (screen.level === "severe" || screen.level === "screening") {
    interp.startSet = false;
  }
  interp.dissociation = screen.level;
  return { interpretation: interp, screen };
}

/**
 * Phase consequences of the level, applied on top of the normal patch.
 * Crisis handling (riskFlag -> grounding) runs before this and is kept.
 */
export function dissociationPatch(
  thread: Pick<Thread, "phase" | "dissociation" | "intakeComplete">,
  screen: DissociationScreen,
  patch: Partial<Thread>
): Partial<Thread> {
  const out: Partial<Thread> = { ...patch };
  if (screen.changed && screen.level) out.dissociation = screen.level;
  const next = out.phase ?? thread.phase;

  if (screen.presentNow) {
    // Happening now: ground first (intake already routes outOfWindow there).
    if (thread.phase !== "intake") {
      out.phase = "grounding";
      out.incomplete = true;
    }
    return out;
  }

  if (screen.level === "screening") {
    // Finish the follow-up before anything moves on.
    if (out.phase && out.phase !== thread.phase) delete out.phase;
    if (out.intakeComplete && !thread.intakeComplete) delete out.intakeComplete;
  } else if (screen.level === "severe") {
    if (next === "assessment" || BLS_PHASES.includes(next)) out.phase = "grounding";
    else if (thread.phase === "intake" && !out.phase) out.phase = "grounding";
    out.incomplete = true;
  }
  return out;
}

/** Guide prompt block for the current level (empty when nothing is flagged). */
export function dissociationGuideBlock(level: DissociationLevel | null | undefined): string {
  switch (level) {
    case "screening":
      return [
        "Dissociation screening (do this before anything else):",
        "The user just said they have moments of feeling unreal or disconnected from themselves. First acknowledge it warmly and calmly (it is common, especially under stress, and it helps to know).",
        "Then ask ONE gentle follow-up about how strong it is, for example: when it happens, do they lose track of time or have gaps in memory, or is it hard to come back to the here and now? (You may also ask whether it happens outside stress.)",
        "Do NOT move on to the safe place, a target, or the next intake step in this reply. Do not diagnose.",
      ].join("\n");
    case "cautious":
      return [
        "Dissociation noted (mild or stress-related). Go ahead, carefully:",
        "- Make sure the safe place and the stop signal are solid before any set, and remind them they can stop anytime (say stop or press pause).",
        "- Start low: a milder target, or a smaller and less intense part of it.",
        "- Keep sets short and few; after every set do a quick here-and-now check (feet on the floor, notice the room) before asking what they notice.",
        "- If they start to feel unreal, far away or numb during processing, stop and ground before anything else.",
      ].join("\n");
    case "severe":
      return [
        "Dissociation is significant (losing time or memory gaps, hard to come back, or together with risk). Safety rule for the rest of this session:",
        "- Do NOT start or continue processing sets, and do not ask for a target image, SUDs or VoC.",
        "- Kindly explain that self-guided processing is not the right fit for now; it is about keeping them safe, not about them doing anything wrong.",
        "- Offer grounding only: safe place, butterfly hug, slow breathing, naming things they can see and hear.",
        "- Recommend working with a trained EMDR therapist, who can pace this safely with them.",
        "- Crisis rules still come first: if there is any self-harm risk or they feel unsafe, encourage professional or emergency help.",
      ].join("\n");
    default:
      return "";
  }
}

/** Fixed lines when the model is unavailable (English, like the other fallbacks). */
export function dissociationFallbackLine(
  level: DissociationLevel | null | undefined
): string | null {
  if (level === "screening") {
    return "Thank you for telling me, that is common, especially under stress. When it happens, do you ever lose track of time, or find it hard to come back to the here and now?";
  }
  if (level === "severe") {
    return "Thank you for telling me. Because of how strong this is, working through memories on your own here is not the right fit for now. Let's stay with grounding: feel your feet on the floor and name three things you can see. A trained EMDR therapist can help you with this safely, at your pace.";
  }
  return null;
}
