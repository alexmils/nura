import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectCrisis,
  groundingFallbackLine,
  GROUNDING_LINE_LANGUAGES,
} from "../lib/crisis-detect.ts";
import { classifyDissociation } from "../lib/dissociation-screen.ts";
import { heuristicTurn } from "../lib/agent-turn.ts";

const CRISIS_POSITIVE: [string, string][] = [
  // en
  ["en", "I want to die"],
  ["en", "i really wanna die"],
  ["en", "I'm going to kill myself"],
  ["en", "I want to hurt myself"],
  ["en", "I keep cutting myself"],
  ["en", "I don\u2019t want to live anymore"],
  ["en", "I don't want to be alive."],
  ["en", "there is no reason to live"],
  ["en", "I just want to end it all"],
  ["en", "I'm thinking about suicide"],
  ["en", "I feel suicidal"],
  // de
  ["de", "Ich will sterben"],
  ["de", "ich möchte sterben"],
  ["de", "ich moechte sterben"],
  ["de", "ich will mich umbringen"],
  ["de", "Ich will nicht mehr leben"],
  ["de", "ich könnte mir etwas antun"],
  ["de", "ich denke an Selbstmord"],
  ["de", "Suizidgedanken"],
  // es
  ["es", "Quiero morir"],
  ["es", "quiero matarme"],
  ["es", "Quiero hacerme daño"],
  ["es", "quiero hacerme dano"],
  ["es", "No quiero vivir"],
  ["es", "me quiero morir"],
  ["es", "pienso en el suicidio"],
  // it
  ["it", "Voglio morire"],
  ["it", "voglio uccidermi"],
  ["it", "Voglio farmi del male"],
  ["it", "Non voglio più vivere"],
  ["it", "non voglio piu vivere"],
  ["it", "penso al suicidio"],
  // fr
  ["fr", "Je veux mourir"],
  ["fr", "je veux me tuer"],
  ["fr", "Je veux me faire du mal"],
  ["fr", "Je ne veux plus vivre"],
  ["fr", "je veux plus vivre"],
  ["fr", "j\u2019ai envie d'en finir"],
  ["fr", "j'ai envie de mourir"],
  ["fr", "je pense au suicide"],
  // pt
  ["pt", "Quero morrer"],
  ["pt", "quero me matar"],
  ["pt", "Quero me machucar"],
  ["pt", "Não quero mais viver"],
  ["pt", "nao quero mais viver"],
  ["pt", "penso em suicídio"],
  // nl / pl
  ["nl", "ik wil dood"],
  ["nl", "ik wil niet meer leven"],
  ["nl", "ik denk aan zelfmoord"],
  ["pl", "chcę umrzeć"],
  ["pl", "nie chcę już żyć"],
  ["pl", "myślę o samobójstwie"],
  // sr (kept)
  ["sr", "ne želim da živim"],
];

const CRISIS_NEGATIVE: [string, string][] = [
  ["en", "I'm dying to try EMDR"],
  ["en", "this is killing me"],
  ["en", "this commute will kill me, haha"],
  ["en", "I hurt myself at the gym yesterday"],
  ["en", "I don't want to live in this city forever"],
  ["en", "I don't want to die"],
  ["en", "let's end it here for today"],
  ["de", "das bringt mich um"],
  ["de", "ich sterbe vor Hunger"],
  ["de", "ich will nicht sterben"],
  ["es", "me muero de ganas de probarlo"],
  ["es", "no quiero morir"],
  ["es", "me mata de risa"],
  ["it", "muoio dalla voglia di provarlo"],
  ["it", "non voglio morire"],
  ["it", "sto morendo dal ridere"],
  ["fr", "je meurs d'envie d'essayer"],
  ["fr", "ça me tue"],
  ["fr", "mort de rire"],
  ["fr", "je ne veux pas mourir"],
  ["pt", "estou morrendo de vontade de tentar"],
  ["pt", "isso me mata"],
  ["pt", "não quero morrer"],
  ["pt", "vou me matar de rir"],
  ["nl", "ik ga dood van het lachen"],
  ["pl", "umieram ze śmiechu"],
];

describe("multilingual crisis detection (no-AI fallback)", () => {
  it("flags clear first-person crisis phrases in every covered language", () => {
    for (const [lang, text] of CRISIS_POSITIVE) {
      assert.ok(detectCrisis(text), `${lang}: should flag "${text}"`);
    }
  });

  it("does not over-trigger on figures of speech or negated wishes", () => {
    for (const [lang, text] of CRISIS_NEGATIVE) {
      assert.equal(detectCrisis(text), null, `${lang}: should NOT flag "${text}"`);
    }
  });

  it("is case- and accent-insensitive", () => {
    assert.ok(detectCrisis("NÃO QUERO MAIS VIVER"));
    assert.ok(detectCrisis("ICH WILL STERBEN"));
    assert.ok(detectCrisis("Je Ne Veux Plus Vivre"));
  });

  it("reports the language of the matched phrase", () => {
    assert.equal(detectCrisis("ich will sterben")?.language, "de");
    assert.equal(detectCrisis("quiero morir")?.language, "es");
    assert.equal(detectCrisis("voglio morire")?.language, "it");
    assert.equal(detectCrisis("je veux mourir")?.language, "fr");
    assert.equal(detectCrisis("quero morrer")?.language, "pt");
  });

  it("routes the fallback turn to grounding with no set", () => {
    for (const text of ["ich will sterben", "quiero matarme", "voglio farmi del male", "je veux me tuer", "quero me matar"]) {
      const r = heuristicTurn({ thread: { phase: "desensitization" }, userMessage: text, userTurns: 5 });
      assert.equal(r.patch.phase, "grounding", text);
      assert.equal(r.interpretation.riskFlag, true, text);
      assert.equal(r.interpretation.startSet, false, text);
    }
  });

  it("has a short grounding / crisis line per guide language, English default", () => {
    for (const code of ["en", "de", "es", "it", "fr", "pt", "nl", "pl"]) {
      assert.ok(GROUNDING_LINE_LANGUAGES.includes(code), code);
      const line = groundingFallbackLine(code);
      assert.ok(line.length > 40, code);
      assert.equal(line.includes("\u2014"), false, `${code}: no em dash`);
    }
    assert.match(groundingFallbackLine("de"), /Notruf/);
    assert.match(groundingFallbackLine("es"), /emergencias/);
    assert.match(groundingFallbackLine("it"), /emergenza/);
    assert.match(groundingFallbackLine("fr"), /urgences/);
    assert.match(groundingFallbackLine("pt"), /emergência/);
    assert.equal(groundingFallbackLine(null), groundingFallbackLine("en"));
    assert.equal(groundingFallbackLine("ja"), groundingFallbackLine("en"));
  });
});

const QUESTION: Record<string, string> = {
  en: "Do you ever experience moments when things feel unreal or like you are disconnected from yourself?",
  de: "Hast du manchmal Momente, in denen sich alles unwirklich anfühlt oder du dich von dir selbst losgelöst fühlst?",
  es: "¿Tienes a veces momentos en los que todo parece irreal o te sientes desconectado de ti?",
  it: "Ti capita di avere momenti in cui tutto sembra irreale o ti senti distaccato da te stesso?",
  fr: "Vous arrive-t-il d'avoir des moments où tout semble irréel ou où vous vous sentez déconnecté de vous-même ?",
  pt: "Você tem momentos em que tudo parece irreal ou se sente desligado de si mesmo?",
  nl: "Heb je weleens momenten waarop alles onwerkelijk voelt?",
  pl: "Czy masz czasem chwile, w których wszystko wydaje się nierealne?",
};

const DISSOCIATION_TABLE: [string, string, "screening" | "cautious" | "severe" | null][] = [
  ["en", "yes all the time when im stressed", "screening"],
  ["en", "sometimes, a little", "cautious"],
  ["en", "yes and I lose time", "severe"],
  ["en", "No", null],
  ["de", "ja, ständig", "screening"],
  ["de", "oft, wenn ich gestresst bin", "screening"],
  ["de", "manchmal, ein bisschen", "cautious"],
  ["de", "ja, ich verliere Zeit", "severe"],
  ["de", "ich habe Gedächtnislücken", "severe"],
  ["de", "nein", null],
  ["es", "sí, todo el tiempo", "screening"],
  ["es", "a menudo", "screening"],
  ["es", "a veces, un poco", "cautious"],
  ["es", "sí, y tengo lagunas", "severe"],
  ["es", "pierdo la noción del tiempo", "severe"],
  ["es", "no", null],
  ["it", "sì, spesso", "screening"],
  ["it", "sempre quando sono stressato", "screening"],
  ["it", "a volte, un po'", "cautious"],
  ["it", "perdo la cognizione del tempo", "severe"],
  ["it", "ho vuoti di memoria", "severe"],
  ["it", "no, mai", null],
  ["fr", "oui, tout le temps", "screening"],
  ["fr", "souvent", "screening"],
  ["fr", "parfois, un peu", "cautious"],
  ["fr", "je perds la notion du temps", "severe"],
  ["fr", "j'ai des trous de mémoire", "severe"],
  ["fr", "non, jamais", null],
  ["pt", "sim, o tempo todo", "screening"],
  ["pt", "frequentemente", "screening"],
  ["pt", "às vezes, um pouco", "cautious"],
  ["pt", "perco a noção do tempo", "severe"],
  ["pt", "tenho lapsos de memória", "severe"],
  ["pt", "não", null],
  ["nl", "ja, vaak", "screening"],
  ["nl", "soms, een beetje", "cautious"],
  ["nl", "ik heb geheugengaten", "severe"],
  ["pl", "tak, często", "screening"],
  ["pl", "czasami, trochę", "cautious"],
  ["pl", "mam luki w pamięci", "severe"],
];

describe("multilingual dissociation screening", () => {
  it("classifies screening answers per language (frequent / mild / severe / no)", () => {
    for (const [lang, answer, expected] of DISSOCIATION_TABLE) {
      assert.equal(
        classifyDissociation({ userMessage: answer, lastAgentMessage: QUESTION[lang] }).level,
        expected,
        `${lang}: "${answer}"`
      );
    }
  });

  it("recognizes first-person reports without a screening question", () => {
    for (const text of [
      "ich fühle mich oft wie neben mir",
      "a menudo me siento fuera de mi cuerpo",
      "spesso mi sento fuori dal mio corpo",
      "souvent je me sens hors de mon corps",
      "muitas vezes me sinto fora do meu corpo",
    ]) {
      assert.equal(classifyDissociation({ userMessage: text }).level, "screening", text);
    }
  });

  it("dissociating right now during processing grounds first, in any language", () => {
    for (const text of ["ich fühle mich gerade unwirklich", "ahora mismo me siento irreal", "adesso mi sento irreale", "je me sens irréel en ce moment", "agora me sinto irreal"]) {
      const r = classifyDissociation({ userMessage: text, lastAgentMessage: "What do you notice now?", phase: "desensitization" });
      assert.equal(r.presentNow, true, text);
    }
  });

  it("a follow-up 'no' after a yes stays cautious in every language", () => {
    for (const text of ["nein", "no", "non", "não", "nee"]) {
      assert.equal(
        classifyDissociation({ userMessage: text, lastAgentMessage: "When it happens, do you lose track of time?", current: "screening" }).level,
        "cautious",
        text
      );
    }
  });
});
