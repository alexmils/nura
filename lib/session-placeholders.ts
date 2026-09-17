/**
 * Composer placeholders in the session language.
 *
 * The chat composer is the one piece of chrome the person writes into, so its
 * hint follows the language the guide answers in (`thread.agentLanguage`)
 * instead of the English app chrome. Everything else stays English on purpose:
 * buttons, chips, phase labels, and the SUDs / VoC scale names are the same
 * words the protocol prompt tells the model to keep.
 *
 * Scale names stay English inside the sentence ("SUDs 0–10", "VoC 0–7") because
 * the guide is instructed to use them exactly as the app shows them.
 */

import type { ProtocolPhase } from "./types";

export interface ComposerPlaceholders {
  /** Generic, mid-conversation hint. */
  message: string;
  /** Intake: nothing to rate yet. */
  typeHere: string;
  /** After a set: what came up. */
  notice: string;
  /** Installation: how true the positive belief feels. */
  howTrue: string;
  /** Body scan. */
  bodyScan: string;
  /** A set was stopped before it finished, so there is nothing to rate. */
  setStopped: string;
}

/** Kinds a placeholder can be resolved to (mirrors the composer states). */
export type ComposerPlaceholderKind =
  | "message"
  | "typeHere"
  | "rating"
  | "howTrue"
  | "bodyScan"
  | "notice"
  | "setStopped";

/**
 * English is the source of truth and the fallback for any language without an
 * entry, so a missing translation degrades to English instead of breaking.
 */
export const COMPOSER_PLACEHOLDERS_EN: ComposerPlaceholders = {
  message: "Message the guide…",
  typeHere: "Type here…",
  notice: "What do you notice now?",
  howTrue: "How true does the positive belief feel now?",
  bodyScan: "Any tension left in the body?",
  setStopped: "Run the set again, or say what you noticed…",
};

export const COMPOSER_PLACEHOLDERS: Record<string, ComposerPlaceholders> = {
  en: COMPOSER_PLACEHOLDERS_EN,
  es: {
    message: "Escribe a la guía…",
    typeHere: "Escribe aquí…",
    notice: "¿Qué notas ahora?",
    howTrue: "¿Cuánto sientes que es cierta la creencia positiva?",
    bodyScan: "¿Queda tensión en el cuerpo?",
    setStopped: "Repite la serie, o cuenta qué notaste…",
  },
  fr: {
    message: "Écrire au guide…",
    typeHere: "Écrire ici…",
    notice: "Que remarquez-vous maintenant ?",
    howTrue: "À quel point la croyance positive vous semble-t-elle vraie ?",
    bodyScan: "Reste-t-il une tension dans le corps ?",
    setStopped: "Refaites la série, ou dites ce que vous avez remarqué…",
  },
  de: {
    message: "Dem Guide schreiben…",
    typeHere: "Hier schreiben…",
    notice: "Was nimmst du jetzt wahr?",
    howTrue: "Wie wahr fühlt sich der positive Glaube jetzt an?",
    bodyScan: "Ist noch Spannung im Körper?",
    setStopped: "Set erneut starten, oder sag, was du bemerkt hast…",
  },
  pt: {
    message: "Escrever para o guia…",
    typeHere: "Escreva aqui…",
    notice: "O que nota agora?",
    howTrue: "Quão verdadeira a crença positiva parece agora?",
    bodyScan: "Resta tensão no corpo?",
    setStopped: "Repita a série, ou diga o que notou…",
  },
  it: {
    message: "Scrivi alla guida…",
    typeHere: "Scrivi qui…",
    notice: "Cosa noti adesso?",
    howTrue: "Quanto ti sembra vera la convinzione positiva adesso?",
    bodyScan: "Resta tensione nel corpo?",
    setStopped: "Ripeti la serie, o racconta cosa hai notato…",
  },
  nl: {
    message: "Bericht aan de gids…",
    typeHere: "Typ hier…",
    notice: "Wat merk je nu?",
    howTrue: "Hoe waar voelt de positieve overtuiging nu?",
    bodyScan: "Is er nog spanning in je lichaam?",
    setStopped: "Start de set opnieuw, of vertel wat je merkte…",
  },
  sr: {
    message: "Pišite vodiču…",
    typeHere: "Upišite ovde…",
    notice: "Šta sada primećujete?",
    howTrue: "Koliko vam je pozitivno uverenje sada istinito?",
    bodyScan: "Ima li još napetosti u telu?",
    setStopped: "Pokrenite set ponovo ili napišite šta ste primetili…",
  },
  hr: {
    message: "Pišite vodiču…",
    typeHere: "Upišite ovdje…",
    notice: "Što sada primjećujete?",
    howTrue: "Koliko vam je pozitivno uvjerenje sada istinito?",
    bodyScan: "Ima li još napetosti u tijelu?",
    setStopped: "Pokrenite set ponovno ili napišite što ste primijetili…",
  },
  ru: {
    message: "Написать гиду…",
    typeHere: "Введите здесь…",
    notice: "Что вы замечаете сейчас?",
    howTrue: "Насколько правдоподобно звучит позитивное убеждение?",
    bodyScan: "Осталось ли напряжение в теле?",
    setStopped: "Запустите сет снова или напишите, что заметили…",
  },
  uk: {
    message: "Написати гіду…",
    typeHere: "Введіть тут…",
    notice: "Що ви помічаєте зараз?",
    howTrue: "Наскільки правдивим здається позитивне переконання?",
    bodyScan: "Чи залишилося напруження в тілі?",
    setStopped: "Запустіть сет знову або напишіть, що помітили…",
  },
  pl: {
    message: "Napisz do przewodnika…",
    typeHere: "Wpisz tutaj…",
    notice: "Co teraz zauważasz?",
    howTrue: "Jak prawdziwe wydaje się teraz to przekonanie?",
    bodyScan: "Czy w ciele zostało jeszcze napięcie?",
    setStopped: "Uruchom set ponownie albo napisz, co zauważyłeś…",
  },
  cs: {
    message: "Napsat průvodci…",
    typeHere: "Pište zde…",
    notice: "Čeho si teď všímáte?",
    howTrue: "Jak pravdivě teď zní to pozitivní přesvědčení?",
    bodyScan: "Zůstalo v těle napětí?",
    setStopped: "Spusťte set znovu, nebo napište, čeho jste si všimli…",
  },
  sk: {
    message: "Napísať sprievodcovi…",
    typeHere: "Píšte tu…",
    notice: "Čo si teraz všímate?",
    howTrue: "Ako pravdivo teraz znie to pozitívne presvedčenie?",
    bodyScan: "Zostalo v tele napätie?",
    setStopped: "Spustite set znova, alebo napíšte, čo ste si všimli…",
  },
  sl: {
    message: "Piši vodniku…",
    typeHere: "Pišite tukaj…",
    notice: "Kaj zdaj opažate?",
    howTrue: "Kako resnično se zdaj zdi to pozitivno prepričanje?",
    bodyScan: "Je v telesu ostala napetost?",
    setStopped: "Zaženite set znova ali napišite, kaj ste opazili…",
  },
  bg: {
    message: "Пишете на водача…",
    typeHere: "Въведете тук…",
    notice: "Какво забелязвате сега?",
    howTrue: "Колко вярно ви се струва положителното убеждение сега?",
    bodyScan: "Остана ли напрежение в тялото?",
    setStopped: "Пуснете сета отново или напишете какво забелязахте…",
  },
  mk: {
    message: "Пишете на водичот…",
    typeHere: "Внесете овде…",
    notice: "Што забележувате сега?",
    howTrue: "Колку ви е сега вистинито позитивното уверување?",
    bodyScan: "Остана ли напнатост во телото?",
    setStopped: "Пуштете го сетот повторно или напишете што забележавте…",
  },
  ro: {
    message: "Scrie ghidului…",
    typeHere: "Scrie aici…",
    notice: "Ce observi acum?",
    howTrue: "Cât de adevărată ți se pare acum convingerea pozitivă?",
    bodyScan: "A mai rămas tensiune în corp?",
    setStopped: "Rulează setul din nou sau spune ce ai observat…",
  },
  hu: {
    message: "Írj az útmutatónak…",
    typeHere: "Írj ide…",
    notice: "Mit veszel észre most?",
    howTrue: "Mennyire érzed most igaznak a pozitív meggyőződést?",
    bodyScan: "Maradt-e feszültség a testedben?",
    setStopped: "Indítsd újra a szettet, vagy írd le, mit vettél észre…",
  },
  el: {
    message: "Γράψε στον οδηγό…",
    typeHere: "Γράψε εδώ…",
    notice: "Τι παρατηρείς τώρα;",
    howTrue: "Πόσο αληθινή σου φαίνεται τώρα η θετική πεποίθηση;",
    bodyScan: "Έμεινε ένταση στο σώμα;",
    setStopped: "Ξεκίνησε ξανά το σετ ή γράψε τι παρατήρησες…",
  },
  tr: {
    message: "Rehbere yaz…",
    typeHere: "Buraya yaz…",
    notice: "Şimdi ne fark ediyorsun?",
    howTrue: "Olumlu inanç şimdi ne kadar doğru geliyor?",
    bodyScan: "Bedeninde hâlâ gerginlik var mı?",
    setStopped: "Seti yeniden başlat ya da ne fark ettiğini yaz…",
  },
  sv: {
    message: "Skriv till guiden…",
    typeHere: "Skriv här…",
    notice: "Vad märker du nu?",
    howTrue: "Hur sant känns det positiva antagandet nu?",
    bodyScan: "Finns det spänning kvar i kroppen?",
    setStopped: "Starta setet igen, eller skriv vad du märkte…",
  },
  da: {
    message: "Skriv til guiden…",
    typeHere: "Skriv her…",
    notice: "Hvad bemærker du nu?",
    howTrue: "Hvor sandt føles den positive overbevisning nu?",
    bodyScan: "Er der stadig spænding i kroppen?",
    setStopped: "Start sættet igen, eller skriv hvad du bemærkede…",
  },
  nb: {
    message: "Skriv til guiden…",
    typeHere: "Skriv her…",
    notice: "Hva legger du merke til nå?",
    howTrue: "Hvor sant føles den positive overbevisningen nå?",
    bodyScan: "Er det stramning igjen i kroppen?",
    setStopped: "Start settet på nytt, eller skriv hva du la merke til…",
  },
  fi: {
    message: "Kirjoita oppaalle…",
    typeHere: "Kirjoita tähän…",
    notice: "Mitä huomaat nyt?",
    howTrue: "Kuinka tosi se myönteinen uskomus tuntuu nyt?",
    bodyScan: "Jäikö kehoon jännitystä?",
    setStopped: "Käynnistä setti uudelleen tai kirjoita, mitä huomasit…",
  },
  he: {
    message: "לכתוב למדריך…",
    typeHere: "כתבו כאן…",
    notice: "מה שמתם לב אליו עכשיו?",
    howTrue: "עד כמה ההאמנה החיובית נשמעת נכונה עכשיו?",
    bodyScan: "נשאר מתח בגוף?",
    setStopped: "הפעילו את הסט שוב, או כתבו מה שמתם לב אליו…",
  },
  ar: {
    message: "راسل المرشد…",
    typeHere: "اكتب هنا…",
    notice: "ماذا تلاحظ الآن؟",
    howTrue: "إلى أي مدى تبدو الفكرة الإيجابية صادقة الآن؟",
    bodyScan: "هل بقي توتر في الجسم؟",
    setStopped: "شغّل المجموعة مرة أخرى، أو اكتب ما لاحظته…",
  },
  fa: {
    message: "پیام به راهنما…",
    typeHere: "اینجا بنویسید…",
    notice: "الان چه چیزی متوجه می‌شوید؟",
    howTrue: "باور مثبت الان چقدر درست به نظر می‌رسد؟",
    bodyScan: "تنشی در بدن باقی مانده؟",
    setStopped: "ست را دوباره اجرا کنید یا بنویسید چه متوجه شدید…",
  },
  ur: {
    message: "گائیڈ کو لکھیں…",
    typeHere: "یہاں لکھیں…",
    notice: "اب آپ کیا محسوس کر رہے ہیں؟",
    howTrue: "مثبت یقین اب کتنا سچا لگتا ہے؟",
    bodyScan: "جسم میں کوئی تناؤ باقی ہے؟",
    setStopped: "سیٹ دوبارہ چلائیں یا لکھیں کہ کیا محسوس ہوا…",
  },
  hi: {
    message: "गाइड को लिखें…",
    typeHere: "यहाँ लिखें…",
    notice: "अब आप क्या नोटिस कर रहे हैं?",
    howTrue: "सकारात्मक विश्वास अब कितना सच लगता है?",
    bodyScan: "शरीर में कोई तनाव बचा है?",
    setStopped: "सेट दोबारा चलाएँ, या लिखें कि क्या नोटिस हुआ…",
  },
  bn: {
    message: "গাইডকে লিখুন…",
    typeHere: "এখানে লিখুন…",
    notice: "এখন কী লক্ষ করছেন?",
    howTrue: "ইতিবাচক বিশ্বাসটা এখন কতটা সত্য মনে হচ্ছে?",
    bodyScan: "শরীরে কোনো টান আছে?",
    setStopped: "সেটটি আবার চালান, বা লিখুন কী লক্ষ করলেন…",
  },
  ta: {
    message: "வழிகாட்டிக்கு எழுதுங்கள்…",
    typeHere: "இங்கே எழுதுங்கள்…",
    notice: "இப்போது என்ன கவனிக்கிறீர்கள்?",
    howTrue: "நேர்மறை நம்பிக்கை இப்போது எவ்வளவு உண்மையாகத் தெரிகிறது?",
    bodyScan: "உடலில் இழுவிசை உள்ளதா?",
    setStopped: "செட்டை மீண்டும் இயக்குங்கள், அல்லது என்ன கவனித்தீர்கள் என்று எழுதுங்கள்…",
  },
  te: {
    message: "గైడ్‌కు రాయండి…",
    typeHere: "ఇక్కడ రాయండి…",
    notice: "ఇప్పుడు మీరు ఏమి గమనిస్తున్నారు?",
    howTrue: "సానుకూల నమ్మకం ఇప్పుడు ఎంత నిజంగా అనిపిస్తోంది?",
    bodyScan: "శరీరంలో ఉద్వేగం మిగిలిందా?",
    setStopped: "సెట్‌ను మళ్లీ ప్రారంభించండి, లేదా ఏమి గమనించారో రాయండి…",
  },
  zh: {
    message: "给引导留言…",
    typeHere: "在这里输入…",
    notice: "你现在注意到什么？",
    howTrue: "这个正向信念现在有多真实？",
    bodyScan: "身体还有紧张吗？",
    setStopped: "重新开始这一组，或写下你注意到了什么…",
  },
  "zh-Hant": {
    message: "給引導留言…",
    typeHere: "在這裡輸入…",
    notice: "你現在注意到什麼？",
    howTrue: "這個正向信念現在有多真實？",
    bodyScan: "身體還有緊繃嗎？",
    setStopped: "重新開始這一組，或寫下你注意到了什麼…",
  },
  ja: {
    message: "ガイドにメッセージ…",
    typeHere: "ここに入力…",
    notice: "今、何に気づきますか？",
    howTrue: "その前向きな信念は今どれくらいしっくりきますか？",
    bodyScan: "体に張りは残っていますか？",
    setStopped: "セットをもう一度始めるか、気づいたことを書いてください…",
  },
  ko: {
    message: "가이드에게 메시지…",
    typeHere: "여기에 입력…",
    notice: "지금 무엇이 느껴지나요?",
    howTrue: "긍정 문장이 지금 얼마나 사실처럼 느껴지나요?",
    bodyScan: "몸에 아직 긴장이 남아 있나요?",
    setStopped: "세트를 다시 시작하거나, 느낀 점을 적어 주세요…",
  },
  th: {
    message: "พิมพ์ถึงไกด์…",
    typeHere: "พิมพ์ที่นี่…",
    notice: "ตอนนี้คุณสังเกตเห็นอะไร?",
    howTrue: "ตอนนี้ความเชื่อเชิงบวกจริงแค่ไหน?",
    bodyScan: "ยังมีตึงในร่างกายไหม?",
    setStopped: "เริ่มเซ็ตอีกครั้ง หรือพิมพ์สิ่งที่สังเกตเห็น…",
  },
  vi: {
    message: "Nhắn cho người dẫn…",
    typeHere: "Nhập ở đây…",
    notice: "Bây giờ bạn nhận ra điều gì?",
    howTrue: "Lúc này niềm tin tích cực đúng đến mức nào?",
    bodyScan: "Cơ thể còn căng không?",
    setStopped: "Chạy lại set, hoặc viết điều bạn nhận ra…",
  },
  id: {
    message: "Kirim pesan ke pemandu…",
    typeHere: "Tulis di sini…",
    notice: "Apa yang Anda sadari sekarang?",
    howTrue: "Seberapa benar keyakinan positif itu terasa sekarang?",
    bodyScan: "Masih ada ketegangan di tubuh?",
    setStopped: "Jalankan set lagi, atau tulis apa yang Anda sadari…",
  },
  ms: {
    message: "Hantar mesej kepada pemandu…",
    typeHere: "Taip di sini…",
    notice: "Apa yang anda perhatikan sekarang?",
    howTrue: "Sejauh mana kepercayaan positif itu terasa benar sekarang?",
    bodyScan: "Masih ada ketegangan dalam badan?",
    setStopped: "Jalankan set semula, atau tulis apa yang anda perhatikan…",
  },
  fil: {
    message: "Magpadala ng mensahe sa gabay…",
    typeHere: "Mag-type dito…",
    notice: "Ano ang napapansin mo ngayon?",
    howTrue: "Gaano katotoo ang positibong paniniwala ngayon?",
    bodyScan: "May tensiyon pa ba sa katawan?",
    setStopped: "Patakbuhin muli ang set, o isulat ang napansin mo…",
  },
  sw: {
    message: "Tuma ujumbe kwa mwongozo…",
    typeHere: "Andika hapa…",
    notice: "Unaona nini sasa?",
    howTrue: "Ni kweli kiasi gani imani chanya sasa?",
    bodyScan: "Kuna mvutano bado mwilini?",
    setStopped: "Endesha set tena, au andika ulichoona…",
  },
};

function placeholdersFor(code?: string | null): ComposerPlaceholders {
  if (!code) return COMPOSER_PLACEHOLDERS_EN;
  return COMPOSER_PLACEHOLDERS[code] ?? COMPOSER_PLACEHOLDERS_EN;
}

/** Placeholder key for a composer state. */
export function composerPlaceholderKind(opts: {
  phase: ProtocolPhase;
  checkIn: boolean;
  setStopped?: boolean;
}): ComposerPlaceholderKind {
  if (opts.setStopped) return "setStopped";
  if (!opts.checkIn) {
    return opts.phase === "intake" ? "typeHere" : "message";
  }
  switch (opts.phase) {
    case "intake":
      return "typeHere";
    case "installation":
      return "howTrue";
    case "body_scan":
      return "bodyScan";
    case "desensitization":
      return "rating";
    default:
      return "notice";
  }
}

/**
 * Composer hint in the session language. Scale names (SUDs, VoC) stay as the
 * app shows them, so the guide and the person read the same words.
 */
export function composerPlaceholder(opts: {
  phase: ProtocolPhase;
  checkIn: boolean;
  language?: string | null;
  setStopped?: boolean;
}): string {
  const p = placeholdersFor(opts.language);
  switch (composerPlaceholderKind(opts)) {
    case "typeHere":
      return p.typeHere;
    case "rating":
      return `${p.notice} SUDs 0–10…`;
    case "howTrue":
      return `${p.howTrue} VoC 0–7…`;
    case "bodyScan":
      return p.bodyScan;
    case "setStopped":
      return p.setStopped;
    case "notice":
      return p.notice;
    default:
      return p.message;
  }
}
