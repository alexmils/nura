/**
 * Deterministic crisis / self-harm detection for the no-AI fallback path and
 * the dissociation screen. The interpreter (LLM) is the primary reader; this
 * is the safety net when it is off, errored or cut off.
 *
 * Covers clear first-person intent in English, German, Spanish, Italian,
 * French, Portuguese, Dutch and Polish (+ Serbian, kept from before). Text is
 * folded first (case, accents, umlauts, ß, ł, curly apostrophes), so "não
 * quero mais viver" and "nao quero mais viver" read the same.
 *
 * Conservative on purpose: figures of speech ("I'm dying to try", "this is
 * killing me", "me muero de ganas", "je meurs d'envie", "das bringt mich um")
 * do not trigger, and a negated wish ("no quiero morir", "non voglio morire")
 * does not either. Clear first-person intent always does.
 *
 * Pure: no DB or fetch.
 */

export type CrisisLanguage = "en" | "de" | "es" | "it" | "fr" | "pt" | "nl" | "pl" | "sr";

/** Lowercase, no accents, ß->ss, ł->l, đ->dj, æ/œ->ae/oe, curly quotes -> '. */
export function foldCrisisText(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/[\u2018\u2019\u02bc\u00b4\u0060]/g, "'")
    .replace(/ß/g, "ss")
    .replace(/[łŁ]/g, "l")
    .replace(/[đĐ]/g, "dj")
    .replace(/[æÆ]/g, "ae")
    .replace(/[œŒ]/g, "oe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Any language: suicide words and self-harm nouns. */
const SHARED: RegExp[] = [
  /\bsuicid\w*/, // suicide, suicidal, suicidio, suicídio, suicidarme, se suicider
  /\bselbstmord\w*|\bsuizid\w*|\bzelfmoord\w*|\bsamoboj\w*|\bsamoubist\w*/,
  /\bself[- ]?harm\w*|\bselbstverletz\w*|\bautolesi\w*|\bautomutil\w*|\bzelfbeschadig\w*|\bsamookalecz\w*/,
];

const BY_LANGUAGE: [CrisisLanguage, RegExp[]][] = [
  [
    "en",
    [
      /\b(i|i'm|im|i am)( really| just| honestly| seriously)? (want to|wanna|wish i could|would like to|need to|have decided to|decided to) die\b/,
      /\b(want|wanna|going|gonna|plan(ning)?|intend|trying|thinking (about|of)|think about|decided) (to )?(kill(ing)?|hurt(ing)?|harm(ing)?|cut(ting)?) myself\b/,
      // "kill myself" always; hurt / harm / cut only as ongoing self-harm, so
      // "I hurt myself at the gym" does not trigger.
      /\bkill(ing)? myself\b|\b(hurting|harming|cutting) myself\b/,
      /\bend(ing)? (my (own )?life|it all)\b/,
      /\btake my (own )?life\b/,
      /\b(do ?n'?t|do not|no longer|don't really) want to (live|be alive|exist|wake up|be here)( anymore| any more)?\s*([.!?,]|$)/,
      /\b(do ?n'?t|do not) want to (live|be alive|be here) any ?more\b/,
      /\bno (reason|point) (to live|in living|to go on|in going on|to keep living)\b/,
      /\bbetter off dead\b/,
      /\bwish i (was|were) dead\b/,
      /\b(not safe|unsafe)\b/,
      /\bcan'?t breathe\b/,
      /\bpanic attack/,
    ],
  ],
  [
    "de",
    [
      /\bich (will|mochte|moechte|wurde gern|wuerde gern) (jetzt |einfach |nur noch )?(sterben|tot sein)\b/,
      /\bmich (umbringen|toten|toeten|selbst toten|verletzen|ritzen)\b/,
      /\bmir (etwas|was) (an)?tun\b|\bmir (etwas|was) anzutun\b/,
      /\bmir das leben (zu )?nehmen\b/,
      /\b(will|mag|kann|mochte|moechte) nicht mehr leben\b/,
      /\bnicht mehr (am leben sein|da sein) (will|mochte|moechte)\b|\b(will|mochte|moechte) nicht mehr (da sein|am leben sein)\b/,
      /\blebensmude\b|\blebensmuede\b/,
      /\bkein(en)? grund (mehr )?(zu leben|weiterzuleben)\b/,
    ],
  ],
  [
    "es",
    [
      /(?<!\bno )\b(quiero|quisiera|deseo) (morir(me)?|matarme|suicidarme|hacerme dano|desaparecer para siempre)\b/,
      /(?<!\bno )\bme quiero (morir|matar|suicidar)\b/,
      /\b(voy a|pienso en|he pensado en) (matarme|suicidarme|hacerme dano|quitarme la vida)\b/,
      /\bquitarme la vida\b/,
      /\bno quiero (seguir )?(vivir|viviendo|estar vivo|estar viva)\b/,
      /\bno (tengo|hay) (razones|motivos|razon|motivo) para (vivir|seguir)\b/,
      /\bhacerme dano\b/,
    ],
  ],
  [
    "it",
    [
      /(?<!\bnon )\b(voglio|vorrei) (morire|uccidermi|ammazzarmi|suicidarmi|farmi del male|togliermi la vita)\b/,
      /(?<!\bnon )\bmi voglio (uccidere|ammazzare|suicidare)\b/,
      /\bnon voglio (piu )?vivere\b/,
      /\btogliermi la vita\b/,
      /\bfarmi del male\b/,
      /\bnon (ho|c'e) (nessun |un )?motivo (per|di) vivere\b/,
    ],
  ],
  [
    "fr",
    [
      /\bje (veux|voudrais) (mourir|me tuer|me suicider|me faire du mal|en finir)\b/,
      /\bje vais (me tuer|me suicider|me faire du mal|en finir)\b/,
      /\bj'ai envie (de (mourir|me tuer|me suicider|me faire du mal)|d'en finir|de en finir)\b/,
      /\bje (ne )?veux plus vivre\b/,
      /\bje n'ai plus envie de vivre\b/,
      /\bmettre fin a (mes jours|ma vie)\b/,
      /\bme faire du mal\b/,
      /\bme scarifier\b/,
      /\b(aucune|pas de) raison de vivre\b/,
    ],
  ],
  [
    "pt",
    [
      /(?<!\bnao )\b(quero|queria) (morrer|me matar|matar-me|me machucar|me ferir|sumir para sempre|tirar minha vida)\b/,
      /\b(vou|penso em|pensando em) (me matar(?! de rir)|me machucar|tirar (a )?minha (propria )?vida)\b/,
      /\bnao quero (mais )?viver\b/,
      /\btirar (a )?minha (propria )?vida\b/,
      /\bme matar\b(?! de rir)/,
      /\bnao (tenho|ha) (razao|motivo|razoes|motivos) para viver\b/,
    ],
  ],
  [
    "nl",
    [
      /\bik wil (dood|sterven|dood zijn)\b/,
      /\b(ik wil|wil ik) niet meer (leven|verder|er zijn)\b/,
      /\bmezelf (van kant maken|iets aandoen|pijn doen|doden)\b/,
      /\bmijn leven beeindigen\b/,
    ],
  ],
  [
    "pl",
    [
      /\bchce (umrzec|sie zabic|zabic sie)\b/,
      /\b(zabic sie|zabije sie)\b/,
      /\bnie chce (juz )?zyc\b/,
      /\b(zrobic sobie krzywde|skrzywdzic siebie|zrobie sobie krzywde)\b/,
      /\bodebrac sobie zycie\b/,
    ],
  ],
  [
    "sr",
    [
      /\bubi(ti|jem) se\b|\bda se ubijem\b/,
      /\bpovredi(m|ti) sebe\b|\bda se povredim\b/,
      /\bne zelim (vise )?da zivim\b/,
      /\bnisam bezbed(an|na)\b/,
      /\bnapad panike\b/,
      /\bne mogu da disem\b/,
    ],
  ],
];

export interface CrisisMatch {
  /** Language of the phrase that matched, null for a shared word ("suicide"). */
  language: CrisisLanguage | null;
}

/** Clear crisis / self-harm language in the message, or null. */
export function detectCrisis(text: string | null | undefined): CrisisMatch | null {
  const t = foldCrisisText(text);
  if (!t) return null;
  for (const [language, patterns] of BY_LANGUAGE) {
    if (patterns.some((re) => re.test(t))) return { language };
  }
  if (SHARED.some((re) => re.test(t))) return { language: null };
  return null;
}

export function isCrisisText(text: string | null | undefined): boolean {
  return detectCrisis(text) != null;
}

/**
 * Grounding / crisis line for the no-AI fallback, in the guide's reply
 * language. English is the default; app UI stays English regardless.
 */
const GROUNDING_LINES: Record<string, string> = {
  en: "Let's pause and ground. Cross your arms for a butterfly hug, or picture your safe place. When you feel steadier, tell me what you notice. If you are in crisis, please seek professional or emergency help.",
  de: "Lass uns kurz innehalten und dich erden. Verschränke die Arme zur Schmetterlingsumarmung oder stell dir deinen sicheren Ort vor. Wenn du dich etwas stabiler fühlst, sag mir, was du bemerkst. Wenn du in einer Krise bist, hol dir bitte professionelle Hilfe oder ruf den Notruf.",
  es: "Hagamos una pausa para conectar con el presente. Cruza los brazos para darte un abrazo de mariposa o imagina tu lugar seguro. Cuando te sientas un poco más estable, dime qué notas. Si estás en crisis, por favor busca ayuda profesional o llama a emergencias.",
  it: "Facciamo una pausa per radicarti nel presente. Incrocia le braccia per un abbraccio della farfalla, oppure immagina il tuo posto sicuro. Quando ti senti un po' più stabile, dimmi cosa noti. Se sei in crisi, cerca aiuto professionale o chiama i servizi di emergenza.",
  fr: "Faisons une pause pour revenir au présent. Croise les bras pour un câlin papillon, ou imagine ton lieu sûr. Quand tu te sens un peu plus stable, dis-moi ce que tu remarques. Si tu es en crise, demande l'aide d'un professionnel ou appelle les urgences.",
  pt: "Vamos fazer uma pausa para voltar ao presente. Cruze os braços num abraço de borboleta ou imagine o seu lugar seguro. Quando se sentir um pouco mais estável, diga-me o que nota. Se estiver em crise, procure ajuda profissional ou ligue para os serviços de emergência.",
  nl: "Laten we even pauzeren en gronden. Sla je armen over elkaar voor een vlinderknuffel, of stel je je veilige plek voor. Als je je wat stabieler voelt, vertel me wat je merkt. Ben je in crisis, zoek dan professionele hulp of bel de hulpdiensten.",
  pl: "Zatrzymajmy się na chwilę i wróćmy do tu i teraz. Skrzyżuj ręce i obejmij się jak w uścisku motyla albo wyobraź sobie swoje bezpieczne miejsce. Gdy poczujesz się trochę stabilniej, powiedz mi, co zauważasz. Jeśli jesteś w kryzysie, poszukaj pomocy specjalisty lub zadzwoń na numer alarmowy.",
  sr: "Hajde da zastanemo i prizemimo se. Prekrsti ruke za zagrljaj leptira ili zamisli svoje sigurno mesto. Kada se osetiš malo stabilnije, reci mi šta primećuješ. Ako si u krizi, potraži stručnu pomoć ili pozovi hitnu službu.",
};

export function groundingFallbackLine(code?: string | null): string {
  return (code && GROUNDING_LINES[code]) || GROUNDING_LINES.en!;
}

/** Codes that have a localized grounding / crisis line. */
export const GROUNDING_LINE_LANGUAGES = Object.keys(GROUNDING_LINES);
