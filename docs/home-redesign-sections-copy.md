# Nura — home: detaljan tekst po sekcijama (11 sekcija + 2b = 12) — Revizija 2

> Status: **Korak 1 — content map** (zaključane sekcije, naslovi, FAQ, JSON-LD tipovi).
> Repo ponovo proveren 2026-09-13 (Revizija 2). Sav predloženi copy je na engleskom (jezik sajta), objašnjenja na srpskom.
> Copy prati pravila: `nura-brand.mdc`, `marketing-no-explain-copy.mdc`, `redpen-copy.mdc`.

## Kako se ovo koristi (odgovor na dilemu SEO vs izgled)

Ne pišemo ni prazne kutije pa SEO, ni eseje pa layout. Redosled je zaključan:

```
1. Content map  → 2. Visual skeleton  → 3. Copy polish  → 4. Meta + JSON-LD
   (OVAJ DOKUMENT)   (isti naslovi)      (u iste slotove)   (iz iste mape)
```

Ovaj dokument zaključava **gde šta ide i šta koja sekcija sme da kaže** (korak 1). Kad pravimo skeleton, koristimo **ove naslove kao pravi tekst** — SEO-relevantni pojmovi (AI-guided EMDR, grounding, sets, safety, trial) su već u naslovima, pa kasnije samo poliramo rečenice bez dodavanja novih sekcija. Meta/JSON-LD (korak 4) dolazi iz iste mape — nema razlike između onoga što Google vidi i onoga što posetilac vidi.

---

## Šta je ispravljeno u odnosu na prvu verziju (provera repoa, 2026-09-13)

| # | Greška u prvom planu | Ispravka u ovoj reviziji |
|---|---|---|
| 1 | Sekcija 6 tvrdi da su brojevi `8 / 0 / 1` "već u STATS" | Stvarni `STATS` u `HomeLanding.tsx` je **8 / 2 / 7 / 3** (8 faza, 2 moda, 7 dana trial, 3 guided sesije). `0` i `1` su **proizvodne činjenice, ne STATS**: protokol ne pušta set pre groundinga, a tap na canvas toggluje set (provereno u `BallCanvas.tsx` → `onToggle`, "Tap to start"). Sekcija 6 sada to tačno citira. |
| 2 | H1 menja u "AI-guided EMDR" bez osvrta na brand spec | `.cursor/rules/nura-brand.mdc` red 41 zaključava hero: **"EMDR therapy online. *in a calm app.*"** (isti red dozvoljava "AI-guided EMDR" u hero/H1 — "titles, hero, and H1s may say AI-guided EMDR"). Promena je **dozvoljena ali obavezna**: Slice A mora ažurirati red 41 u `nura-brand.mdc` + `docs/brand.md` (sekcija Position), inače alwaysApply pravilo kontrira kodu. |
| 3 | "Pistachio chipovi", "Bento (pistachio)", "pistachio/mint" kao površine | Brand pravilo: **Pistachio `#C6D67E` je samo focus/hover, nikad body/površine kartica**. Površine idu Paper `#A4EDA5` / Sage `#84B067`; pistachio samo kao hover akcenat. Type sekcija ispravljena. |
| 4 | Kartica 1 u sekciji 2: "or open Free and run sets yourself" | Brand pravilo zabranjuje goli "Free" na marketing površinama → **"a Free session"** / "Free (sets you run yourself)". |
| 5 | `BRAND_DESCRIPTION` samo pomenut ("Slice C sinhronizuje") | Dat **konkretan novi tekst** (ispod, Slice C) — sadašnji opis "Guided EMDR sessions you run yourself…" ne vodi AI-guided priču. |
| 6 | Kartica 6: "You end calmer than you started." — ishod koji ne možemo da merimo | Zamenjeno faktičkim zatvaranjem: **"You finish with grounding and next steps."** (closure faza stvarno radi to). |
| 7 | Does/Doesn't 7 vs 4 — vizualni disbalans | Dodato u Doesn't: **`Decide for you`** (tačno — "User stays in control" je pravilo u `protocol-knowledge.ts`). Sada 7 vs 5. |
| 8 | Hero: "dual CTA" kao da menja postojeći | Hero **trenutno nema nijedan CTA** (provereno: "Get started" postoji samo u how-panelu i pricing karticama) — dual CTA je novina; nav pill već ima Sign in + Get started, pa je primarni hero CTA jedan. |
| 9 | Jezici su bili razbacani: chipovi u Sekciji 2 + FAQ #4, bez ijedne sekcije koja ih nosi | **Nova Sekcija 2b "Your language"** preuzima chipove iz Sekcije 2 (koja ostaje samo loop) i dobija kicker + H2 + 3 kartice + obaveznu mikroliniju o engleskom UI. Board je isti `SessionLoopKit` pattern, drugi sadržaj. |

---

## Šta je bitno u repou (provereno 2026-09-13)

### Trenutno stanje `app/components/frontend/HomeLanding.tsx` (1056 linija)

| Sada na stranici | Sudbina u novom planu |
|---|---|
| Hero: lifestyle fotka (`supportTalk.jpg`) + "The time is right for" + H1 "EMDR therapy online / *in a calm app.*" + Learn thumbnail + "Support you can trust" kartica + **bez CTA dugmeta** | ❌ Briše se → hero montaža proizvoda (sekcija 1) — **backup kod:** [`docs/Design backups/Header 1/`](./Design%20backups/Header%201/) |
| `fe-about`: "Here when you need us" + marquee 8 fotki + ABOUT_COPY | ❌ Briše se (sadržaj pokrivaju sekcije 4 i 6) — **backup kod:** [`docs/Design backups/Header 1/`](./Design%20backups/Header%201/) |
| `FEATURES` grid: "Support crafted around your pace" (4 kartice) | ❌ Briše se (pokrivaju sekcije 2/3/4) |
| `SHOWCASES`: 3 velika bloka sa fotkama | ❌ Briše se (pokrivaju sekcije 3/4/5) |
| `STEPS`: 4 koraka sa tabovima ("Create your space"…) | ✏️ Menja se u **6-stage sticky stack** (sekcija 2) — tabovi ostaju kao reduced-motion fallback |
| `STATS`: "Our journey in numbers" (8 / 2 / 7 / 3 — faze, modovi, trial dani, trial sesije) | ✏️ Prenamenjuje se u iskreni proof strip (sekcija 6) — brojevi se **menjaju** u 8 / 0 / 1 (svi su proizvodne činjenice), "community/journey" naslov se briše |
| `TESTIMONIALS` + `StoriesSection`: 6 izmišljenih citata (avatari se recikliraju: Elena P.→avatarMaya, Chris W.→avatarJames), 4.9★ | ❌ Briše se kompletno |
| Pricing (3 kartice, `PRICING_CARDS` + `BILLING_PLANS`) | ✅ Ostaje, samo veći tip (sekcija 8) |
| Blog masonry (`HOME_BLOG_PAGE_SIZE = 5`) | ✅ Ostaje, bump na 6+ (sekcija 9) |
| FAQ (5 pitanja iz `LANDING_FAQ_ITEMS`, H2 "Questions, answered calmly") | ✏️ Širi se na 10 (sekcija 10) |

**Hash sidra koja moraju ostati:** `#home` · `#how-it-works` · `#prices` · `#blog` · `#faq`
(navigacija koristi `lib/landing-scroll.ts` → `scheduleScrollToLandingHash`).

### Komponente koje već postoje i koristimo ih (bez pisanja novog)

| Komponenta / modul | Šta daje |
|---|---|
| `app/components/BallCanvas.tsx` | Stvarne Dot / Flash animacije (L–R); canvas `onToggle` = **jedan tap start/stop** (osnova za claim "1 tap stops any set") |
| `lib/bls-prefs.ts` | Stvarni izbori: animation `dot`/`flash`, sound `mute`/`click`/`pulse`/`tone`, vibration `none`/`soft`/`hard` |
| `lib/gamepad.ts` + `useGamepadConnected` | Joystick/gamepad rumble — postoji, ne izmišljamo claim |
| `app/components/frontend/AnimatedBrandWave.tsx` | Wave lockup sa color fill, `size="md" \| "lg"` — baza za **giant lockup** (sekcija 11) |
| `app/components/frontend/LetterRevealHeading.tsx` | Letter-rise H2 (Aiero stil) — koristimo za sve H2 |
| `app/components/frontend/KnowledgeSeriesBlock.tsx` | Stage + chips pattern — referenca za sticky stack; dokazan **mp4-swappable slot** (poster → `videoSrc`) |
| `app/components/frontend/useLandingMotion.ts` + `landing-motion.css` | GSAP + ScrollTrigger + Lenis — već okačeni na landing, samo dodajemo signature animacije |
| `app/components/frontend/FrontendFooter.tsx` | Futer — **ne diramo kolone**, ostaje kakav jeste |
| `lib/memory-context.ts` | Memorija agenta (`MEMORY_CONTEXT_MAX_CHARS = 3000`) — osnova za claim "agent se seća" |
| `lib/emergency-by-country.ts` | Crisis panel po ISO državi (112/911/999 + nacionalne krizne linije) — osnova za claim o kriznoj pomoći |

### SEO infrastruktura (sve već postoji)

- `lib/site-seo.ts` — home title: `EMDR Therapy Online — Guided Bilateral Stimulation` (`BRAND_TITLE_STEM`), description: `BRAND_DESCRIPTION`. ⚠️ Sadašnji `BRAND_DESCRIPTION` ("Guided EMDR sessions you run yourself: visual sets, optional voice…") **ne vodi AI-guided priču** — novi tekst je u Slice C.
- `lib/json-ld.ts` — FAQPage se **automatski generiše iz `LANDING_FAQ_ITEMS`** (verbatim). Svaka izmena FAQ-a se odmah reflektuje u JSON-LD — ništa se ne piše dva puta. Tipovi na home: Organization, WebSite, SoftwareApplication, FAQPage.
- `lib/landing-faq.ts` — 5 pitanja → širimo na 10.
- `lib/emdr-faq.ts` — 8 iskrenih pitanja, izvor za home (effectiveness, phone, session length, privacy, worse-after).
- ⚠️ `app/emdr/page.tsx` redovi 35 i 119 još kažu "moving ball" — Slice C ih usklađuje ("sets" umesto "ball", po `nura-brand.mdc`).

### Prompt agenta — jedino mesto za promenu jezika

`lib/protocol-knowledge.ts` linija 17: `You are a calm self-guided EMDR session guide. English only.` — **jedino mesto** koje se menja (detalji dole).

### Cene (ne menjaju se)

`lib/billing-constants.ts`: Weekly $4.99 · Monthly $14.99 · Yearly $99 ("Best value", ≈$8.25/mo je u PRICING_CARDS `periodNote`). Trial: `TRIAL_DAYS=7`, `TRIAL_GUIDED_SESSIONS=3`, 600s Free. Trial claimovi u copy moraju koristiti ove konstante.

---

## Truth ledger — šta smemo, šta ne smemo da tvrdimo

**Sme na home (ownable, sve je već u kodu):**

- AI session agent: intake → grounding → sets → check-ins → closure
- Sigurnost: red-flag stop, crisis panel (`emergency-by-country`), iskreno "not therapy"
- Memory notes: agent koristi ono što si već napisao (`memory-context`)
- Set nije jedna animacija: **oči** (Dot/Flash L–R) · **uši** (stereo click/pulse/tone) · **ruke** (gamepad/joystick rumble soft/hard)
- Agent-guided vs Free session (setovi koje sam pokrećeš)
- Agent prati jezik na kom pišeš (posle promene prompta)
- Jedan tap toggluje set (start/stop) — provereno u `BallCanvas.tsx`

**Ne sme:**

- Izmišljeni citati, 4.9★, reciklirani avatari → **TESTIMONIALS se briše**
- Bilo koji **broj jezika** ("25+", "40+") i "cultural precision" / "translation" → UI je i dalje engleski; Sekcija 2b tvrdi samo da agent odgovara na jeziku na kom pišeš (chipovi pokazuju širinu, tekst je ne tvrdi)
- Hardware EMDR clickers → mi imamo **joystick/gamepad rumble**, tako i pišemo
- Terapija / dijagnoza → uvek `BRAND_LIMITS_LINE`: "Nura is a self-help tool for practice between sessions. It is not therapy, diagnosis, or crisis care."
- Izmišljene metrike ("98%")
- Ishodne claimove ("end calmer than you started") → zatvaranje opisujemo faktički (grounding + next steps)
- "Moving ball" kao proizvod → ime lopte samo kad se uči ritam na /emdr
- Goli "Free" na marketing površinama → uvek "Free session" / "Free (sets you run yourself)"
- Akronim "BLS" korisnicima, "NuraHelp" bilo gde, Inter font, fake app-store dugmad, purple/hospital blue, Pistachio kao površina (samo hover/focus)

**Pravilo prikaza (marketing-no-explain):** kicker + naslov + vizual + kratke labele. Bez "učećih" paragrafa — edukativna dubina živi na `/emdr`, `/safety`, `/limits` i home tamo vodi.

---

# Sekcije

## 1. Hero — prvi ekran = proizvod

**Job:** za ~2 sekunde jasno — *ovo je AI-guided EMDR u mirnoj aplikaciji*. Nije lifestyle fotka, nije "lopta".

**Copy (EN):**

| Slot | Tekst |
|---|---|
| Kicker (Roboto Mono) | `Nura · EMDR support` |
| H1 (Fraunces 400 — **samo ovde na celoj stranici**) | Linija 1: `AI-guided EMDR` · Linija 2 (italic): `in a calm app.` |
| Jedna rečenica | `A session agent walks you through grounding, sets, and check-ins — eyes, ears, and hands in one quiet workspace.` |
| CTA | Primarni: `Get started` → `/app/create-account` · sekundarni: `Sign in` → login (nav pill ih već ima — primarni u hero je dovoljan) |
| Mikrolinija ispod CTA (opciono, faktički) | `Free 7-day trial · cancel anytime` |
| Trust strip (3 labele) | `Safety built in` · `Remembers your sets` · `Self-help, not a therapist` |

**Vizual:** full-bleed montaža proizvoda u jednom zaobljenom "uređaju" (Lassie rounded stage + SupaBrowser product-in-hero). 4–6 beatova u petlji, CSS/JS prvo (mp4 slot spremni, Knowledge pattern):

1. Dot set L–R · 2. Flash L–R · 3. Zoom: gamepad se povezuje + rumble cue · 4. Stereo puls · 5. Grounding / agent chat (intake linija, ne "therapy theatre") · 6. Memory chip: *"this session knows the target you named"*

**Highlight:**
- Fraunces **samo** u H1 hero-a — `docs/brand.md`: nigde drugde na marketing površinama.
- ⚠️ **Obavezan sync sa brand spec-om:** `nura-brand.mdc` red 41 ("Hero: EMDR therapy online. in a calm app.") → ažurirati na novi H1; isti fajl red 35 dozvoljava "AI-guided EMDR" u hero/H1. Ažuriraju se i `docs/brand.md` (sekcije Position/Hero). **Ovo ide u Slice A, pre nego što bilo ko pročita pravilo i vrati stari naslov.**
  - Alternativa (ako ne želiš da diraš brand spec): zadrži liniju 1 `EMDR therapy online` a "AI-guided" u kicker — ali onda H1 ne nosi glavnu poziciju; **preporuka je opcija A**.
- Montaža koristi **pravi motion iz produkta**: `BallCanvas.tsx` + prefs iz `lib/bls-prefs.ts` (dot|flash, click|pulse|tone, soft|hard rumble) — sve što se prikaže je stvarno.
- Briše se: hero fotka, Learn thumbnail, "Support you can trust" kartica. Hero CTA je **nov** (trenutno ga nema).
- "Walks you through" umesto "guides" — izbegava ponavljanje "guided" iz H1.
- Ne tvrdimo 4.9★ niti citate — trust strip je činjenični.
- Meta title (`site-seo.ts`) ostaje `EMDR Therapy Online — Guided Bilateral Stimulation` — SEO pojam živi u title taga i dalje.

---

## 2. How it works — sticky stack + jezici kao atmosfera

**Job:** pokazati **ceo loop** veliko i široko — ovo je "wow" sekcija (Knowledge stil: kartice se pinuju i menjaju dok skroluješ).

**Copy (EN):**

| Slot | Tekst |
|---|---|
| Kicker | `How it works` |
| H2 (Source Sans 3, letter-rise) | `A session, start to finish` |

6 kartica — **veliki label + jedna kratka linija** (bez paragrafa):

| # | Veliki naslov | Linija ispod |
|---|---|---|
| 1 | `Start a session` | `Tell the agent what's on your mind — or run sets yourself in a Free session.` |
| 2 | `Intake + safety` | `One question at a time. Red flags stop everything.` |
| 3 | `Grounding` | `Safe place and breath, before anything heavy.` |
| 4 | `The set — eyes, ears, hands` | `Left–right on screen. Stereo tones. Joystick rumble.` |
| 5 | `Check-in` | `The agent remembers what you just said.` |
| 6 | `Close safely` | `You finish with grounding and next steps.` |

**Jezici:** ❌ **izmešteni u Sekciju 2b** — language board je dobio svoju sekciju (vidi dole). Ovde ostaje samo loop, bez chipova: dva jezička momenta na istoj strani se poništavaju.

**Vizual:** GSAP ScrollTrigger pin, jedna kartica po ekranu, stack efekat. Referenca: `KnowledgeSeriesBlock.tsx` (stage) + screenshot stack. Kolona ~76rem, ogromni foreground labeli.

**Highlight:**
- Kartica 1: "a Free session", **nikad** goli "Free" (brand pravilo).
- Kartica 6: faktički kraj umesto ishodnog claima (closure stvarno radi grounding + next steps).
- `prefers-reduced-motion` → postojeći `fe-how-tabs` tabovi postaju statični fallback (već ih imamo u kodu).
- Vizual predlog (iz tvoje poruke): **CSS/JS stack + screenshot-ovi faza** — najbrži put do efekta; mp4 slot se može dodati kasnije (Knowledge već ima taj pattern).
- Ovo je jedina sekcija koja objašnjava flow — zato kratke linije, ne eseji.
- Sidro `#how-it-works` ostaje.

---

## 2b. Your language — agent prati jezik, ne UI

**Job:** pokazati da sesija radi na jeziku na kom korisnik piše. Ovo **nije** "global reach / 25+ languages / cultural precision" sekcija — mi nismo alat za prevođenje, nego sesija koja te razume na tvom jeziku. Preuzima language board iz Sekcije 2.

**Copy (EN):**

| Slot | Tekst |
|---|---|
| Kicker | `Your language` |
| H2 (Source Sans 3, letter-rise) | `A session in the language you think in.` |
| Podnaslov (jedna linija) | `Write the way you'd speak. The agent answers the same way — intake, check-ins, closure.` |

3 kartice — **label + jedna kratka linija** (bez paragrafa). Tri različite ideje: **sesija · sigurnost · svet** — nisu tri varijante iste rečenice:

| # | Naslov | Linija ispod |
|---|---|---|
| 1 | `Answers in your language` | `No translating yourself first.` |
| 2 | `Safety in every language` | `Red-flag checks and grounding never switch off.` |
| 3 | `Local help, by country` | `The crisis panel shows your country's emergency numbers.` |

**Obavezna mikrolinija ispod kartica** (bez nje sekcija prećutno tvrdi UI i18n koji ne postoji — isti stav kao FAQ #4):

`App interface is in English for now — the session itself is not.`

**Language board — 3 marquee reda, imena jezika u sopstvenom pismu, BEZ zastavica:**

| Red | Sadržaj |
|---|---|
| 1 (ltr) | `English` · `Español` · `Français` · `Deutsch` · `Português` · `Italiano` |
| 2 (rtl animacija) | `Polski` · `Српски` · `Русский` · `Українська` · `Nederlands` · `Türkçe` |
| 3 (ltr) | `العربية` · `עברית` · `हिन्दी` · `日本語` · `한국어` · `中文` |

**Vizual:** postojeći `SessionLoopKit.tsx` board (`fe-spath-kit-board` / `KitRow`) — **ista komponenta, drugi sadržaj** (`KIT_ROWS` → `LANG_ROWS`, `KitChip` bez `tone` ne menja se: ton-dotovi ostaju kao apstraktni akcent, ne zastave). Pun red je 6 chipova × 3 reda, isti 32s/38s marquee, hover pauza.

**Highlight:**
- ⚠️ **Uslov istinitosti:** sekcija je laž dok `lib/protocol-knowledge.ts` red 17 ne pređe sa `English only.` na `Match the language the user writes in — default to English if unclear.` (Slice A, već planirano). Redosled: prompt → pa sekcija.
- ⚠️ **Nikad broj jezika** — bez "25+", bez "40+". Chipovi *pokazuju* širinu, tekst je ne *tvrdi*; lista se sme menjati bez prepisivanja copy-ja.
- ❌ **Nikad** "cultural precision", "translation", "translate" — nismo prevodilac i ne tvrdimo kvalitet prevođenja. Tvrdimo samo: agent odgovara na jeziku na kom pišeš.
- ⚠️ **Bidi:** `العربية` i `עברית` u LTR marquee-u traže `dir="auto"` (ili `unicode-bidi: isolate`) na pill-u. `KitRow` `direction` je smer *animacije*, ne tekstualni bidi — dve različite stvari.
- Bez zastavica: jezik ≠ država (zastava za španski/portugalski/ruski je politički nabijena) — ton-dot to već rešava.
- Kartica 3 je jedino mesto na home-u koje koristi `lib/emergency-by-country.ts` — zato je ovde, a ne u Sekciji 7 (tamo je krizna linija bez "by country" detalja).
- `prefers-reduced-motion` → marquee statičan, chipovi se lome u dva reda.

**Pozicija:** odmah posle Sekcije 2 (`#how-it-works`), pre Sekcije 3. Alternativa ako želiš da sigurnosne kartice padnu bliže Sekciji 7: posle Sekcije 5.

---

## 3. What is EMDR — tri kanala, ne esej

**Job:** bilateralna stimulacija bez žargona — pokazati tri moda. Edukativna dubina ide na `/emdr`.

**Copy (EN):**

| Slot | Tekst |
|---|---|
| Kicker | `What is EMDR` |
| H2 | `One rhythm, three channels` |

Bento (**Paper/Sage površine** — pistachio samo kao hover akcenat) — 3 kartice:

| Kanal | Naslov | Jedna linija |
|---|---|---|
| 👁 | `Screen` | `A dot moves left and right — follow it.` |
| 👂 | `Sound` | `Stereo click, pulse, or tone — one ear, then the other.` |
| ✋ | `Hands` | `A connected gamepad rumbles — the rhythm in your palms.` |

Linija + link: `Why the rhythm helps →` **`/emdr`**

**Highlight:**
- Bez "BLS" akronima, bez "the ball" kao defaulta (kažemo "a dot" — to je jedan od stvarnih modova, `dot`/`flash`).
- Pišemo **joystick/gamepad**, nikad "clickers" — hardware clickers nemamo i ne smemo da tvrdimo.
- `/emdr` stranica već ima iskren FAQ (effectiveness istraživanja) — home samo pokazuje, ne predaje.

---

## 4. What the AI does / doesn't — jedinstvena pozicija

**Job:** blok koji niko drugi ne može da ukrade. Attio-stil: kratki redovi, visok kontrast, jedna ideja po ćeliji, skoro bez body teksta.

**Copy (EN):**

| Slot | Tekst |
|---|---|
| Kicker | `Honest by design` |
| H2 | `What the AI does — and what it never will` |

Dve kolone, krupni tip:

| ✅ Does | 🚫 Doesn't |
|---|---|
| `Paces the phases` | `Diagnose` |
| `Waits for grounding first` | `Replace a clinician` |
| `Starts and stops sets` | `Push through flooding` |
| `Checks in after each set` | `Call itself therapy` |
| `Uses memory notes you already wrote` | `Decide for you` |
| `Pulls back when it's too much` | |
| `Closes the session safely` | |

Jedna linija ispod: `Read the limits →` **`/limits`**

**Highlight:**
- Ovo je **jedinstvena pozicija** — "honest product" sekcija. Svaka ćelija je claim koji kod već ispunjava (red flags u `protocol-knowledge.ts`, memory u `memory-context.ts`, flooding pravila u desensitization fazi, "User stays in control" za `Decide for you`).
- `Decide for you` je dodat da izbalansira kolone (7 vs 5) — i to je najjača poruka: **ti odlučuješ, agent prati**.
- Usklađeno sa `BRAND_LIMITS_LINE` — ne izmišljamo nove granice, samo ih pokazujemo.

---

## 5. Who it's for / not for

**Job:** iskreni okviri — bez izmišljenih persona, bez "savršen korisnik" priče.

**Copy (EN):**

| Slot | Tekst |
|---|---|
| Kicker | `Who it's for` |
| H2 | `For practice. Not for crisis.` |

Split kartice (Nolla 2-up):

| ✅ Good fit | 🚫 Not for |
|---|---|
| `Between therapy sessions` | `In crisis right now` |
| `You want structure, not a blank screen` | `You want a licensed therapist in the app` |
| `You can stop yourself when it gets hard` | `You're flooded — skipping grounding won't help` |

Linija + link: `Read the limits →` **`/limits`**

**Highlight:**
- "Not for" lista je jednako bitna kao "For" — to je ono što gradi poverenje (i štiti od pogrešne upotrebe).
- Bez imena, godina, profesija — nema izmišljenih persona.

---

## 6. Social proof — iskreni dokaz (pomereno sa pozicije 9)

**Job:** dokaz bez laži. **Briše se** `TESTIMONIALS`, 4.9★, reciklirani avatari i "community/journey" naslov.

**Copy (EN):**

| Slot | Tekst |
|---|---|
| Kicker | `How a session is built` |
| H2 | `Built on the standard protocol` |

Strip sa 3 činjenice — **sve tri su proizvodne istine, proverene u kodu**:

| Broj | Labela | Izvor istinitosti |
|---|---|---|
| `8` | `protocol phases — intake to closure` | Shapiro 8-fazna struktura u `protocol-knowledge.ts` |
| `0` | `sets start before grounding` | Protokol zabranjuje set pre groundinga (PHASE_KNOWLEDGE hard rules) |
| `1` | `tap stops any set, anytime` | `BallCanvas.tsx` `onToggle` — "Tap to start", isti tap zaustavlja |

Mirna linija: `Standard EMDR structure, guided by an agent. You stay in control.`

**Highlight:**
- ⚠️ `StoriesSection` i 4.9★ se **kompletno brišu iz koda** — ne samo iz layouta.
- Napomena: stari `STATS` (8/2/7/3) ostaje netaknut u kodu do Slice A — novi strip je namerno 8/0/1 jer su 0 i 1 **najprepoznatljivije sigurnosne garancije** (ne "2 moda" i "7 dana" koji su sales činjenice). Ako hoćeš 4. slot, `2 session modes` je dostupan.
- Opcija kasnije: 1–2 prava NPS komentara iz `/admin/feedback` **samo uz tvoje eksplicitno odobrenje** — do tada nema lažnih lica.
- "Our journey in numbers" naslov nestaje — brojevi ostaju jer su proizvodne činjenice, ne marketing metrika.

---

## 7. Safety & limits strip

**Job:** sigurnost kao **glavni faktor** (tvoj zahtev) — kriza nikad nije samo fusnota u futeru.

**Copy (EN):**

| Slot | Tekst |
|---|---|
| Kicker | `Safety & limits` |
| H2 | `Safety is part of the session` |

Full-width band (dark olive ili mint), 2 kartice + krizna linija:

| Kartica | Tekst | Link |
|---|---|---|
| `Safety` | `Red flags stop the session. Grounding comes back.` | → `/safety` |
| `Limits` | `Self-help, not therapy. Not a diagnosis.` | → `/limits` |

Krizna linija (uvek vidljiva, ne samo hover): `In crisis right now? The app shows a crisis panel with local emergency contacts.`

**Highlight:**
- Claim je proizvodno istinit: `lib/emergency-by-country.ts` (nacionalni brojevi + krizne linije po ISO kodu) + red-flag pravila u `protocol-knowledge.ts`.
- `/safety` i `/limits` stranice postoje — linkovi su živi.
- Ovo + memorija su tvoja dva glavna faktora — oba moraju biti vidljiva pre pricinga.

---

## 8. Pricing

**Job:** zadržati postojeće kartice, povećati tip na novu skalu. **Bez novih planova.**

**Copy (EN):**

| Slot | Tekst |
|---|---|
| Kicker | `Pricing` |
| H2 | `Start with 7 days. Stay if it helps.` |
| Sub | `Every plan unlocks the same app — pick how often you're billed. Cancel anytime.` |
| Mikrolinija (opciono, faktički) | `Trial includes 3 agent-guided sessions and Free session time.` |

Kartice ostaju iz `BILLING_PLANS` + `PRICING_CARDS`: **Yearly $99** ("Best value", ≈$8.25/mo) · **Monthly $14.99** ("Most popular") · **Weekly $4.99**. CTA: `Get started`.

**Highlight:**
- Sve cifre dolaze iz `lib/billing-constants.ts` (TRIAL_DAYS=7, TRIAL_GUIDED_SESSIONS=3) — ništa se ne hardkoduje.
- Sidro `#prices` ostaje; nav i dalje vodi na `/pricing`.
- Ne izmišljamo nove feature claimove — postojeći features listovi su već istiniti.

---

## 9. Guides

**Job:** masonry ostaje; više kartica odmah vidljivo. Samo naslovi, bez uvodnih paragrafa.

**Copy (EN):**

| Slot | Tekst |
|---|---|
| Kicker | `Guides` |
| H2 | `Short guides for between sessions` |

**Highlight:**
- `HOME_BLOG_PAGE_SIZE` 5 → **6+** (jedna promena konstante).
- `BlogSection` (masonry + load more) već radi — ne diramo strukturu.
- Sidro `#blog` ostaje.

---

## 10. FAQ — ~10 pitanja

**Job:** proširiti `LANDING_FAQ_ITEMS` sa 5 na 10. **JSON-LD se generiše automatski iz istog niza** (`lib/json-ld.ts` → FAQPage, verbatim) — jedna izmena, obe površine sinhronizovane.

**Copy (EN) — kompletan predlog 10 Q&A:**

| # | Pitanje | Odgovor |
|---|---|---|
| 1 | What is Nura? | Nura is a calm self-help workspace for agent-guided EMDR practice and Free visual sets — structured support in the app, on your schedule. It is not a licensed therapist or emergency care. *(postojeći)* |
| 2 | What is the difference between agent-guided and Free? | Agent-guided sessions use a session agent through protocol phases and check-ins. Free is visual sets you run yourself — animation, speed, sound, and timing, with no agent and no chat. *(postojeći)* |
| 3 | Do I need a therapist to use it? | No. Nura is built for practice between sessions or on your own. If you are in crisis, contact local emergency services — the app does not replace professional care. *(postojeći)* |
| 4 | Which languages can I use? | **Novo:** The agent follows the language you write in. The app itself is in English for now — more interface languages are coming later. |
| 5 | Can I use sound and a joystick? | **Novo:** Yes. Every set can combine left–right visuals, stereo sound (click, pulse, or tone), and rumble on a connected gamepad — or any mix you prefer. |
| 6 | Does Nura remember what I tell it? | **Novo:** In agent-guided sessions, yes. You keep a memory list on your account and the agent draws on those notes. Delete any note, or clear them all, in Settings. |
| 7 | What if I feel worse after a session? | Stop, use grounding, and do not run another set. If it persists for more than a day or two, contact a clinician. *(skraćeno iz `emdr-faq.ts`)* |
| 8 | Does it work on a phone? | Yes — sets, sound, and the full session flow run in the browser. *(iz `emdr-faq.ts`, "ball" zamenjen sa "sets" po brand pravilu)* |
| 9 | How does the trial work? | New accounts get a 7-day trial with a limited number of agent-guided sessions and Free session time. Paid plans unlock the full app with no trial caps. *(postojeći)* |
| 10 | Can I cancel anytime? | Yes. Manage or cancel billing in the customer portal from your account — no phone calls required. *(postojeći)* |

**Highlight:**
- Pitanja 4 i 6 su obavezna posle promene prompta — marketing mora biti istinit (jezik + memorija).
- `/faq` ostaje duga stranica; home nosi kratke odgovore.
- Pošto `json-ld.ts` mapira iz `LANDING_FAQ_ITEMS`, **nikad ne menjamo samo jedno od ta dva mesta.**

---

## 11. Final CTA + giant lockup + postojeći futer

**Job:** kraj koji si tražio — logo sa bojama, Lassie-skala, na skrolu do kraja.

**Copy (EN):**

| Slot | Tekst |
|---|---|
| Kicker | `Ready when you are` |
| H2 | `Start with a 7-day trial.` |
| CTA | `Get started` → `/app/create-account` · `Sign in` |

**Vizual:** Giant Nura wave lockup — **komponenta već postoji**: `AnimatedBrandWave.tsx` (wave wordmark, color fill, `size="lg"`). Povećati na Lassie-skalu, scroll-scrub opacity, Paper/Sage na near-black. Ispod njega postojeći `FrontendFooter` (marquee, links, disclaimer) — **bez redizajna kolona**.

**Highlight:**
- Footer CTA "Support that stays calm — start when you are ready" već postoji u futeru — ne dupliramo; ako ostaje, gornji final CTA se skraćuje na jednu liniju.
- Wave lockup se postavlja **iznad** futera, ne menja futer.
- `FOOTER_LINKS` / `FOOTER_LEGAL` (Safety, Limits, Privacy, Terms) ostaju netaknuti.

---

# Motion (GSAP / Lenis — već okačeni)

`useLandingMotion.ts` + `landing-motion.css` su već povezani (Lenis + ScrollTrigger + hero word-rise + section stagger). Dodajemo **2–3 signature animacije**, ne na svaki blok:

1. **Hero montaža crossfade** (beats u petlji)
2. **How-it-works sticky stack** (ScrollTrigger pin)
3. **Giant lockup reveal** (scroll-scrub)

Pravila:
- Letter-rise H2 ostaje (`LetterRevealHeading`).
- Smenjuju se podloge sekcija (mint `#EDF9ED` / ink / paper) — prelazi kao Lassie/Mindoo, ne jedna duga mint traka.
- `prefers-reduced-motion` → sve statično (već postoji fallback logika u `useLandingMotion`).

# Type

- **Fraunces 400 samo u hero H1.** (posle sync-a brand spec-a, sekcija 1)
- Sve ostalo: Source Sans 3 (H2 600) + Roboto Mono kickeri (~0.9375rem).
- Skala (iz brand spec-a): h1 ~4rem, h2 ~3rem, h3 ~2.5rem, body lead ~1.25rem.
- Boje iz `lib/brand.ts` (`BRAND_COLORS`) — **korektna upotreba po brand pravilu**:

| Token | Hex | Uloga na home |
|---|---|---|
| Paper / mint | `#A4EDA5` | površine kartica, chipovi, bandovi |
| Sage | `#84B067` | dugmad, wordmark, akcenti |
| Pistachio | `#C6D67E` | **samo hover/focus akcenat** — nikad body/površina |
| Olive | `#948F4E` | muted tekst/linije |
| Ink | `#2A3020` | body tekst, tamne podloge |
| Podloga | `#EDF9ED` | background stranice |

Bez purple, bez Inter, bez fake app-store dugmadi.

# Promena u agent promptu (`lib/protocol-knowledge.ts`)

**Linija 17**, iz: `You are a calm self-guided EMDR session guide. English only.`
u: `You are a calm self-guided EMDR session guide. Match the language the user writes in — default to English if unclear.`

+ dve dopune u GLOBAL_GUIDE_RULES:
- `Crisis / safety messages may be in English or the user's language — never skip red-flag checks because of language.`
- UI chrome ostaje engleski — ovo je samo pravilo za jezik razgovora.

**Zašto:** bez ove promene, sekcija 2b (language board) i FAQ #4 bi lagali. UI i18n ostaje van scope.

# Implementacioni slojevi

**Slice A — mapa u kod:**
- Sekcije + zaključani naslovi u `HomeLanding.tsx` (iz ovog dokumenta)
- Prompt language rule u `lib/protocol-knowledge.ts` (linija 17 + GLOBAL_GUIDE_RULES)
- **NEW:** sync brand spec-a — `nura-brand.mdc` red 41 + `docs/brand.md` (Hero/Position) na novi H1
- **NEW:** `BRAND_DESCRIPTION` u `lib/brand.ts` — predlog: `AI-guided EMDR sessions: a calm session agent walks you through grounding, sets, and check-ins — eyes, ears, and hands. Start with a 7-day trial.` (~147 chars, bez disclaimera — po komentaru u `brand.ts`)
- Brišu se `TESTIMONIALS` / `StoriesSection` / 4.9 / lažne statistike

**Slice B — skeleton + motion:**
- Hero montaža, sticky stack, **2b language board**, does/doesn't, for/not, safety strip, giant lockup
- 2b: `SessionLoopKit.tsx` `KIT_ROWS` → `LANG_ROWS` (imena jezika, bez zastavica) + `dir="auto"` na pill za `العربية` / `עברית`
- `useLandingMotion.ts` + `landing-motion.css` (GSAP/Lenis, bez Webflow IX2)

**Slice C — copy + SEO:**
- Redpen pass u iste slotove (bez novih sekcija)
- FAQ 10 / JSON-LD (automatski), home meta u `lib/site-seo.ts` (title ostaje, description se menja kroz `BRAND_DESCRIPTION`)
- `/emdr` "moving ball" linije (redovi 35, 119) → "sets" ako protivreče home priči

**Primarni fajlovi:**
`app/components/frontend/HomeLanding.tsx` · `app/components/frontend/SessionLoopKit.tsx` · `session-path-sticky.css` · `landing-motion.css` · `useLandingMotion.ts` · `FrontendFooter.tsx` · `lib/landing-faq.ts` · `lib/protocol-knowledge.ts` · `lib/json-ld.ts` · `lib/brand.ts` · `.cursor/rules/nura-brand.mdc` · `docs/brand.md`

**Verify:** `npm test` (`tsx --test tests/**/*.test.ts`) + `npm run lint` (`next lint`); desktop + ~390×844; reduced-motion; hash nav (`#home` `#how-it-works` `#prices` `#blog` `#faq`).

# Out of scope

- Puni UI i18n (kasnije)
- Snimanje pravog product filma (slot za mp4 je spreman — Knowledge pattern)
- Nove cene, novi logo, native aplikacije
