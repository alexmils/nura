import { TRIAL_DAYS } from "@/lib/billing-constants";
import { formatImagePosition, framePosKey } from "@/lib/image-position";
import { BLOG_CATEGORIES } from "@/lib/blog-categories";
import {
  BRAND_SPOKEN,
  BRAND_TAGLINE,
  SESSION_MODE_GUIDED_LABEL,
  SESSION_MODE_SELF_LABEL,
  SESSION_MODE_GUIDED_SHORT,
  SESSION_MODE_SELF_SHORT,
} from "@/lib/brand";
import { appPath, LOGIN_PATH } from "@/lib/app-base";
import { EMDR_FAQ_ITEMS } from "@/lib/emdr-faq";
import { LANDING_FAQ_ITEMS } from "@/lib/landing-faq";
import {
  CLINICAL_ADVISOR_FALLBACK,
  CLINICAL_INTRO_ARTICLE,
  CLINICAL_OUTRO_ARTICLE,
  EMDR_CLOSE_NOTE,
  EMDR_COMPARE_ROWS,
  EMDR_COMPARE_SUMMARY,
  EMDR_GUIDE_ARTICLE,
  EMDR_INTRO_ARTICLE,
  EMDR_PRIVACY_ANSWER,
  LIMITS_ARTICLE,
  SAFETY_ARTICLE,
} from "@/lib/marketing-articles";
import { PRICING_FAQ_ITEMS } from "@/lib/pricing-faq";
import { PUBLIC_FAQ_ITEMS } from "@/lib/public-faq";
import { legalEntityDisplayName } from "@/lib/legal-entity";

/**
 * Inline marketing copy. Defaults are today's page strings.
 * Saved rows override them after `normalizeSection`.
 */

export type ScalarField = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "image";
  href?: boolean;
  hint?: string;
  /** Character cap. Defaults to 400 (text) / 2400 (textarea). */
  max?: number;
};

/** Image or video slot. Stored as `{key}Kind`, `{key}Image`, `{key}Video`, `{key}Poster`, `{key}Alt`. */
export type MediaFieldDef = {
  key: string;
  label: string;
  kind: "media";
  hint?: string;
};

export type ListField = {
  key: string;
  label: string;
  kind: "list";
  itemLabel: string;
  max: number;
  /** Keep the default count and any default `id` values. */
  fixed?: boolean;
  fields: ItemField[];
};

export type ItemField = ScalarField | MediaFieldDef;

export type Field = ScalarField | MediaFieldDef | ListField;

export type SectionItem = Record<string, string>;

export type SectionConfig = Record<string, string | SectionItem[]>;

export type SectionDef = {
  id: string;
  name: string;
  fields: Field[];
  defaults: SectionConfig;
  /** No "Show this section" switch (the block cannot be hidden on its own). */
  noHide?: boolean;
  /** The component paints the Background setting itself (hero, closing band). */
  ownBackground?: boolean;
};

const TEXT_MAX = 400;
const AREA_MAX = 2400;

const text = (key: string, label: string, hint?: string): ScalarField => ({
  key,
  label,
  kind: "text",
  hint,
});

const area = (key: string, label: string, hint?: string): ScalarField => ({
  key,
  label,
  kind: "textarea",
  hint,
});

const ARTICLE_MAX = 20000;
const ARTICLE_HINT =
  "Blank line = new block. # Heading, ## Subheading, ### Small heading, - list item, > note box, **bold**, [Label](/path).";

/** Long-form body rendered by RichArticle. */
const article = (key: string, label: string): ScalarField => ({
  key,
  label,
  kind: "textarea",
  hint: ARTICLE_HINT,
  max: ARTICLE_MAX,
});

const link = (key: string, label: string): ScalarField => ({
  key,
  label,
  kind: "text",
  href: true,
});

const image = (key: string, label: string, hint?: string): ScalarField => ({
  key,
  label,
  kind: "image",
  hint,
});

const media = (key: string, label: string, hint?: string): MediaFieldDef => ({
  key,
  label,
  kind: "media",
  hint,
});

export function mediaNames(key: string) {
  const cap = (part: string) => (key ? key + part[0].toUpperCase() + part.slice(1) : part);
  return {
    kind: cap("kind"),
    image: cap("image"),
    video: cap("video"),
    poster: cap("poster"),
    alt: cap("alt"),
  };
}

const LINK_HINT = "One link per line: Label|/path";

function faqDefaults(
  items: readonly { q: string; a: string }[]
): SectionItem[] {
  return items.map((item) => ({ q: item.q, a: item.a }));
}

const BASE_SECTIONS: readonly SectionDef[] = [
  {
    id: "home-hero",
    name: "Home: hero",
    fields: [
      text("kicker", "Kicker"),
      text("title", "Title"),
      text("accent", "Accent line"),
      area("description", "Description"),
      text("cardLabel", "Card label"),
      text("cardLink", "Card link label"),
      link("cardHref", "Card link"),
      media("hero", "Background", "Image, or a muted looping video. Poster shows if motion is reduced."),
      media("thumb", "Preview"),
    ],
    defaults: {
      kicker: "The time is right for",
      title: "EMDR therapy online",
      accent: "in a calm app.",
      description:
        "Visual sets, optional voice, and readable resources — structured support on your schedule. Self-help, not a licensed therapist.",
      cardLabel: "Support you can trust",
      cardLink: "Learn",
      cardHref: "/learn",
      heroKind: "image",
      heroImage: "/marketing/landing/support-talk.jpg",
      heroVideo: "",
      heroPoster: "",
      heroAlt: "Person in a calm, supportive setting",
      thumbKind: "image",
      thumbImage: "/marketing/landing/calm-rest.jpg",
      thumbVideo: "",
      thumbPoster: "",
      thumbAlt: "",
    },
  },
  {
    id: "home-how",
    name: "Home: how it works",
    fields: [
      text("badge", "Badge"),
      area("intro1", "Intro line 1"),
      area("intro2", "Intro line 2"),
      area("intro3", "Intro line 3"),
      {
        key: "stages",
        label: "Stages",
        kind: "list",
        itemLabel: "Stage",
        max: 4,
        fixed: true,
        fields: [
          text("nav", "Nav label"),
          text("lead", "Lead"),
          area("line", "Line"),
          media("media", "Image or video", "Leave blank to keep the stage as it is."),
        ],
      },
      {
        key: "rhythm",
        label: "Rhythm cards",
        kind: "list",
        itemLabel: "Card",
        max: 3,
        fixed: true,
        fields: [text("label", "Label"), text("hint", "Hint")],
      },
      {
        key: "ground",
        label: "Ground pair",
        kind: "list",
        itemLabel: "Card",
        max: 2,
        fixed: true,
        fields: [text("title", "Title"), text("line", "Line")],
      },
      media("screen", "Between sessions", "Still or video in the closing frame. Leave blank for the empty frame."),
      text("kitKicker", "Language kicker"),
      text("kitTitle", "Language title"),
      area("kitSub", "Language line"),
      {
        key: "kitPoints",
        label: "Language points",
        kind: "list",
        itemLabel: "Point",
        max: 3,
        fixed: true,
        fields: [text("title", "Title"), text("hint", "Hint")],
      },
    ],
    defaults: {
      badge: "How it works",
      intro1: "Ground first. Choose your rhythm. Check in after each set.",
      intro2: "Close gently when it’s enough — then Free between sessions.",
      intro3: "One calm loop in the app. No rush. No cold starts.",
      stages: [
        {
          id: "ground",
          nav: "Ground first",
          lead: "From ground to close — one calm loop.",
          line: "Intake, feet on the floor, a calm place — no set starts cold. You settle first, then the session opens at your pace, not the clock’s.",
        },
        {
          id: "rhythm",
          nav: "Choose your rhythm",
          lead: "Eyes, ears, or hands — same rhythm.",
          line: "Pick how you feel the left–right pulse — visual sets, stereo cues, or a gamepad — one calm loop, three ways in.",
        },
        {
          id: "checkin",
          nav: "Check in",
          lead: "Pause after each set.",
          line: "SUD and a body scan with the agent — name what shifted, then decide if another set belongs here or if you stop.",
        },
        {
          id: "close",
          nav: "Close gently",
          lead: "End when you’re ready.",
          line: "Closure and grounding out — you leave with both feet on the floor, not mid-set. Enough is enough when you say so.",
        },
      ],
      rhythm: [
        { label: "Eyes", hint: "Visual sets" },
        { label: "Ears", hint: "Audio cues" },
        { label: "Hands", hint: "Gamepad" },
      ],
      ground: [
        { id: "safe", title: "Safe place first.", line: "Feet on the floor before anything heavy." },
        { id: "cold", title: "No cold starts.", line: "Intake and breath, then the set." },
      ],
      kitKicker: "Your language",
      kitTitle: "A calm session in many languages.",
      kitSub:
        "Write the way you'd speak. The agent answers the same way — intake, check-ins, closure.",
      kitPoints: [
        { title: "Answers in your language", hint: "No translating yourself first." },
        { title: "Safety in every language", hint: "Red-flag checks and grounding never switch off." },
        { title: "Local help, by country", hint: "The crisis panel shows your country's emergency numbers." },
      ],
    },
  },
  {
    id: "home-topics",
    name: "Home: topic guides",
    fields: [
      text("title", "Title"),
      text("kicker", "Kicker"),
      text("more", "Link label"),
      link("moreHref", "Link"),
      {
        key: "topics",
        label: "Topics on the ring",
        kind: "list",
        itemLabel: "Topic",
        max: BLOG_CATEGORIES.length,
        fixed: true,
        fields: [text("label", "Label")],
      },
    ],
    defaults: {
      title: "People start with.",
      kicker: "Guides",
      more: "Read the guides",
      moreHref: "/blog",
      topics: BLOG_CATEGORIES.map((category) => ({ id: category.slug, label: category.name })),
    },
  },
  {
    id: "home-modes",
    name: "Home: session modes",
    fields: [
      text("title", "Title"),
      text("guided", "AI agent-guided tab"),
      text("self", "Self-guided tab"),
      media("guidedMedia", "AI agent-guided", "Image, or a muted looping video."),
      media("selfMedia", "Self-guided", "Image, or a muted looping video."),
    ],
    defaults: {
      title: "One app, two seamless experiences.",
      guided: SESSION_MODE_GUIDED_LABEL,
      self: SESSION_MODE_SELF_LABEL,
      guidedMediaKind: "video",
      guidedMediaImage: "/marketing/landing/support-talk.jpg",
      guidedMediaVideo: "/marketing/knowledge/stock-a.mp4",
      guidedMediaPoster: "/marketing/landing/support-talk.jpg",
      guidedMediaAlt: "",
      selfMediaKind: "video",
      selfMediaImage: "/marketing/landing/practice-space.jpg",
      selfMediaVideo: "/marketing/knowledge/stock-c.mp4",
      selfMediaPoster: "/marketing/landing/practice-space.jpg",
      selfMediaAlt: "",
    },
  },
  {
    id: "home-pause",
    name: "Home: pause",
    fields: [text("title", "Title"), text("cta", "Button"), link("ctaHref", "Button link")],
    defaults: {
      title: "The session starts when you do.",
      cta: "Get started",
      ctaHref: "/app/create-account",
    },
  },
  {
    id: "home-memory",
    name: "Home: memory",
    fields: [
      text("kicker", "Kicker"),
      area("title", "Title"),
      area("agentOpen", "Guide line"),
      area("userLine", "Your line"),
      area("agentReply", "Guide reply"),
      text("composer", "Composer hint"),
      text("loading", "Loading label"),
      text("processing", "Processing label"),
      {
        key: "points",
        label: "Points",
        kind: "list",
        itemLabel: "Point",
        max: 6,
        fixed: true,
        fields: [text("title", "Title"), area("line", "Line")],
      },
    ],
    defaults: {
      kicker: "Memory",
      title: "Notes you keep. The agent can use them in every session.",
      agentOpen: "What are you noticing now — in your body, or in the picture?",
      userLine: "My chest is still tight. Same as last week — that I'm not good enough.",
      agentReply:
        "That's in your notes. Tightness in the chest. The line you wrote: I'm not good enough.",
      composer: "What are you noticing…",
      loading: "Memory loading",
      processing: "Memory processing",
      points: [
        {
          title: "Write it once",
          line: "Add a note yourself, or import what you already told ChatGPT or Claude.",
        },
        {
          title: "The agent can use it",
          line: "In an AI agent-guided session the guide can draw on those notes.",
        },
        {
          title: "Yours to erase",
          line: "Delete any note, or clear them all in Settings.",
        },
      ],
    },
  },
  {
    id: "home-pricing",
    name: "Home: pricing",
    fields: [
      text("title", "Title"),
      area("sub", "Subline"),
      text("featuresLabel", "Features label"),
    ],
    defaults: {
      title: "Plans tailored to your pace",
      sub: `Start with a ${TRIAL_DAYS}-day trial. Every paid plan unlocks the same ${SESSION_MODE_GUIDED_SHORT} sessions and ${SESSION_MODE_SELF_SHORT} sessions — pick how often you want to be billed.`,
      featuresLabel: "Features",
    },
  },
  {
    id: "pricing-cards",
    name: "Pricing: plan cards",
    fields: [
      text("cta", "Card button"),
      {
        key: "cards",
        label: "Plans",
        kind: "list",
        itemLabel: "Plan",
        max: 3,
        fixed: true,
        fields: [
          text("title", "Name"),
          text("badge", "Badge"),
          area("details", "Details"),
          text("periodNote", "Period note"),
          area("features", "Feature lines", "One feature per line. Price stays on the billing plan."),
        ],
      },
    ],
    defaults: {
      cta: "Get started",
      cards: [
        {
          id: "weekly",
          title: "Weekly",
          badge: "",
          details:
            "Flexible billing if you want to stay light — same full app, billed each week.",
          periodNote: "",
          features: [
            "Unlimited AI agent-guided sessions",
            "Full Self-guided sessions (sets you run yourself)",
            "No ads on paid plans",
            "Cancel anytime in the portal",
            "Same session workspace as other plans",
          ].join("\n"),
        },
        {
          id: "yearly",
          title: "Yearly",
          badge: "Best value",
          details:
            "One calm price for a full year — the lowest cost per month if Nura is part of your routine.",
          periodNote: "≈ $8.25 / month",
          features: [
            "Everything in Monthly",
            "Lowest cost per month",
            "Pay once, fewer interruptions",
            "Customer portal for billing",
            "Keep your history and settings",
          ].join("\n"),
        },
        {
          id: "monthly",
          title: "Monthly",
          badge: "Most popular",
          details:
            "The everyday plan for practice between sessions — billed monthly, cancel anytime.",
          periodNote: "",
          features: [
            "Unlimited AI agent-guided + Self-guided sessions",
            "Full protocol phases & check-ins",
            "Resources library access",
            "Customer portal for billing",
            "Upgrade or switch plans later",
          ].join("\n"),
        },
      ],
    },
  },
  {
    id: "home-stories",
    name: "Home: stories",
    fields: [
      text("title", "Title"),
      area("sub", "Subline"),
      text("rating", "Rating"),
      text("ratingLine", "Rating line"),
      {
        key: "stories",
        label: "Stories",
        kind: "list",
        itemLabel: "Story",
        max: 12,
        fields: [
          area("quote", "Quote"),
          text("name", "Name"),
          text("role", "Role"),
          image("image", "Photo"),
        ],
      },
    ],
    defaults: {
      title: "Their experience, your confidence",
      sub: `Voices from people using ${BRAND_SPOKEN} between sessions — calm enough to stay with the work.`,
      rating: "4.9",
      ratingLine: `From early members exploring ${BRAND_SPOKEN}`,
      stories: [
        {
          quote:
            "The interface feels calm enough to actually stay with a difficult memory. Self-guided sessions let me practice without an agent.",
          name: "Maya L.",
          role: "Trial member",
        },
        {
          quote:
            "The session agent walks me through phases instead of dumping me into a blank screen.",
          name: "James R.",
          role: "Monthly plan",
        },
        {
          quote:
            "Resources are short and clear — finally something that explains EMDR without overwhelming me.",
          name: "Sophie T.",
          role: "Resources reader",
        },
        {
          quote: "I use it between sessions. The steps feel structured but never rushed.",
          name: "Daniel K.",
          role: "Yearly plan",
        },
        {
          quote:
            "I open Self-guided when I need a quiet set — no agent, no pressure, just the controls I need.",
          name: "Elena P.",
          role: "Weekly plan",
        },
        {
          quote:
            "Nura stays out of the way. I get enough structure to feel held, without clinical noise.",
          name: "Chris W.",
          role: "Trial member",
        },
      ],
    },
  },
  {
    id: "home-blog",
    name: "Home: blog",
    fields: [
      text("kicker", "Kicker"),
      text("title", "Title"),
      text("more", "More button"),
    ],
    defaults: {
      kicker: "Blog",
      title: "Guides for practice between sessions",
      more: "Load more",
    },
  },
  {
    id: "home-faq",
    name: "Home: FAQ",
    fields: [
      text("kicker", "Kicker"),
      text("title", "Title"),
      area("sub", "Subline"),
      {
        key: "items",
        label: "Questions",
        kind: "list",
        itemLabel: "Question",
        max: 20,
        fields: [text("q", "Question"), area("a", "Answer")],
      },
    ],
    defaults: {
      kicker: "FAQ",
      title: "Questions, answered calmly",
      sub: "Short answers about how Nura works — before you start a trial or open a session.",
      items: faqDefaults(LANDING_FAQ_ITEMS),
    },
  },
  {
    id: "footer-cta",
    name: "Footer: close",
    fields: [
      text("title", "Title"),
      area("sub", "Subline"),
      text("primary", "Primary button"),
      link("primaryHref", "Primary link"),
      text("secondary", "Secondary button"),
      link("secondaryHref", "Secondary link"),
    ],
    defaults: {
      // Off by default: the page CTA above the footer already covers it.
      // Still in the editor ("Show this section") to switch back on.
      _off: "1",
      title: "Support that stays calm — start when you are ready",
      sub: `Built for practice between sessions. Create an account for a ${TRIAL_DAYS}-day trial, or sign in if you already use ${BRAND_SPOKEN}.`,
      primary: "Get started",
      primaryHref: "/app/create-account",
      secondary: "Sign in",
      secondaryHref: "/app/login",
    },
  },
  {
    id: "footer-links",
    name: "Footer: links",
    fields: [
      area("tagline", "Tagline"),
      {
        key: "columns",
        label: "Columns",
        kind: "list",
        itemLabel: "Column",
        max: 4,
        fixed: true,
        fields: [
          text("title", "Title"),
          area("links", "Links", LINK_HINT),
        ],
      },
      text("newsTitle", "Newsletter title"),
      text("newsHint", "Newsletter hint"),
      text("newsPlaceholder", "Email placeholder"),
      text("newsSend", "Send button"),
      text("newsSending", "Sending label"),
      text("newsThanks", "Thanks"),
      area("newsOptIn", "Opt-in", "You can use [Privacy](/privacy)."),
      {
        key: "legal",
        label: "Legal links",
        kind: "list",
        itemLabel: "Link",
        max: 4,
        fixed: true,
        fields: [text("label", "Label"), link("href", "Link")],
      },
    ],
    defaults: {
      tagline: `Join ${BRAND_SPOKEN} today — calm guided support when you need it.`,
      columns: [
        {
          title: "Explore",
          links: ["Blog|/blog", "Learn|/learn", "Knowledge|/knowledge", "What's new|/changelog"].join("\n"),
        },
        {
          title: "Product",
          links: ["Pricing|/pricing", "FAQ|/faq", "Support|/support"].join("\n"),
        },
        {
          title: "Company",
          links: ["About|/about", "Safety|/safety", "Limits|/limits"].join("\n"),
        },
      ],
      newsTitle: "Newsletter",
      newsHint: "Product news by email. Not an account.",
      newsPlaceholder: "Enter your email",
      newsSend: "Send",
      newsSending: "Sending",
      newsThanks: "Thanks.",
      newsOptIn: "Send me occasional product news. [Privacy](/privacy)",
      legal: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
    },
  },
  {
    id: "pricing-plans",
    name: "Pricing: plans",
    fields: [text("title", "Title"), area("sub", "Subline"), text("featuresLabel", "Features label")],
    defaults: {
      title: "Plans tailored to your pace",
      sub: `${TRIAL_DAYS}-day trial. Same full app on every plan — pick how often you pay.`,
      featuresLabel: "Includes",
    },
  },
  {
    id: "pricing-included",
    name: "Pricing: included",
    fields: [
      text("kicker", "Kicker"),
      text("title", "Title"),
      {
        key: "items",
        label: "Cards",
        kind: "list",
        itemLabel: "Card",
        max: 6,
        fixed: true,
        fields: [text("title", "Title"), text("label", "Label")],
      },
    ],
    defaults: {
      kicker: "Included",
      title: "Same product. Every plan.",
      items: [
        { id: "guided", title: "AI agent-guided sessions", label: "Phases + check-ins" },
        { id: "free", title: "Self-guided visual sets", label: "Run sets yourself" },
        { id: "voice", title: "Optional voice", label: "Hands-free replies" },
        { id: "controls", title: "Session controls", label: "Speed, sound, repeats" },
        { id: "library", title: "Resources library", label: "Guides in the app" },
        { id: "limits", title: "Honest limits", label: "Not therapy or crisis care" },
      ],
    },
  },
  {
    id: "pricing-faq",
    name: "Pricing: FAQ",
    fields: [
      text("kicker", "Kicker"),
      text("title", "Title"),
      area("sub", "Subline"),
      {
        key: "items",
        label: "Questions",
        kind: "list",
        itemLabel: "Question",
        max: 20,
        fields: [text("q", "Question"), area("a", "Answer")],
      },
    ],
    defaults: {
      kicker: "FAQ",
      title: "Billing questions",
      sub: "Trial, plans, and cancel — short answers.",
      items: faqDefaults(PRICING_FAQ_ITEMS),
    },
  },
  {
    id: "pricing-cta",
    name: "Pricing: close",
    fields: [
      text("title", "Title"),
      text("cta", "Button"),
      link("ctaHref", "Button link"),
      area("note", "Note", "You can use [Sign in](/app/login) and [Read the limits](/limits)."),
    ],
    defaults: {
      title: "Your healing starts here.",
      cta: "Get started",
      ctaHref: "/app/create-account",
      note: `${TRIAL_DAYS}-day trial. [Sign in](/app/login) · [Read the limits](/limits)`,
    },
  },
  {
    id: "about-page",
    name: "About",
    fields: [
      text("kicker", "Kicker"),
      text("title", "Title"),
      text("dek", "Dek"),
      {
        key: "sections",
        label: "Sections",
        kind: "list",
        itemLabel: "Section",
        max: 8,
        fields: [text("heading", "Heading"), area("body", "Body", "Links: [Label](/path)")],
      },
      text("primary", "Primary button"),
      link("primaryHref", "Primary link"),
      text("secondary", "Second button"),
      link("secondaryHref", "Second link"),
      text("tertiary", "Third button"),
      link("tertiaryHref", "Third link"),
    ],
    defaults: {
      kicker: "About",
      title: "About the EMDR therapy online app",
      dek: BRAND_TAGLINE,
      sections: [
        {
          heading: "What Nura is",
          body: `${BRAND_SPOKEN} is a calm web app for AI-guided EMDR practice: AI agent-guided sessions with optional voice, or self-guided visual sets you run yourself — no agent, no chat. It is software for practice between sessions, not a clinic, not an EHR, and not emergency care.`,
        },
        {
          heading: "Who operates it",
          body: `${BRAND_SPOKEN} is operated by ${legalEntityDisplayName()}. The spoken brand is ${BRAND_SPOKEN}; the domain is nurahelp.com. Legal pages name the operator — [Terms](/terms) and [Privacy](/privacy) — so you can see who is responsible for the product and for how data is handled.`,
        },
        {
          heading: "How sessions work",
          body: `In an AI agent-guided session, a session agent walks phases and can invite a visual set when it is time. Self-guided is sets on your terms: you choose speed, animation, sound, and repeats from session controls. Both modes stay inside the same calm workspace.\n\nA plain-language product overview is on [AI-guided EMDR](/emdr). Plans and the trial are on [Prices](/pricing).`,
        },
        {
          heading: "What we publish",
          body: `Public guides live in two places with different jobs: [Learn](/learn) is a curated reading path (understand, practice, safety). [Blog](/blog) is the chronological archive — newest first. How those pages are written is on [How we write](/editorial).`,
        },
        {
          heading: "Clinical review and safety",
          body: `We do not invent a named clinician to pad trust. How intake and safety copy are checked — and which external authorities we cite (EMDRIA, APA, NICE, WHO, PubMed) — is on [Clinical review](/about/clinical-team). When to pause or get help is on [Safety](/safety). What the product will not claim is on [Limits](/limits).`,
        },
        {
          heading: "How to reach us",
          body: `Product questions go to [Support](/support) (support@nurahelp.com). Common answers are on [FAQ](/faq). If you are in crisis, use local emergency services or 988 in the US — Nura is not crisis care.`,
        },
      ],
      primary: "Get started",
      primaryHref: "/app/create-account",
      secondary: "Learn",
      secondaryHref: "/learn",
      tertiary: "Sign in",
      tertiaryHref: "/app/login",
    },
  },
  {
    id: "faq-page",
    name: "FAQ page",
    fields: [
      text("title", "Title"),
      area("lead", "Lead", "Links: [Label](/path)"),
      {
        key: "items",
        label: "Questions",
        kind: "list",
        itemLabel: "Question",
        max: 40,
        fields: [text("q", "Question"), area("a", "Answer", "Links: [Label](/path)")],
      },
    ],
    defaults: {
      title: "EMDR App FAQ",
      lead: "Short answers about sessions, Self-guided sets, the trial, and when to get help. For plans, see [Pricing](/pricing). For how to reach us, see [Support](/support).",
      items: faqDefaults(PUBLIC_FAQ_ITEMS).map((item) =>
        item.q.startsWith("Is my data private")
          ? {
              ...item,
              a: "Sessions are encrypted and never used to train AI models. Read the [Privacy Policy](/privacy) for exactly what is stored, where, and for how long.",
            }
          : item
      ),
    },
  },
  {
    id: "blog-index",
    name: "Blog index",
    fields: [
      text("kicker", "Kicker"),
      text("title", "Title"),
      area("dek", "Dek", "Links: [Label](/path)"),
      text("all", "All chip"),
      text("empty", "Empty note"),
    ],
    defaults: {
      kicker: "Blog",
      title: "EMDR articles, newest first",
      dek: "Pick a theme, or read the newest guides. New here? Start on [Learn](/learn) for curated reading paths.",
      all: "All",
      empty: "No guides in this category yet.",
    },
  },
  {
    id: "learn-hub",
    name: "Learn",
    fields: [
      text("badge", "Badge"),
      link("badgeHref", "Badge link"),
      text("title", "Title"),
      area("dek", "Dek"),
      text("search", "Search placeholder"),
      {
        key: "paths",
        label: "Paths",
        kind: "list",
        itemLabel: "Path",
        max: 3,
        fixed: true,
        fields: [
          text("label", "Card label"),
          text("cardDek", "Card line"),
          text("panelTitle", "Panel title"),
          text("panelAccent", "Panel accent"),
          text("panelDek", "Panel line"),
          text("moreLabel", "More label"),
          link("moreHref", "More link"),
        ],
      },
    ],
    defaults: {
      badge: "Watch Knowledge clips",
      badgeHref: "/knowledge",
      title: "How can we help?",
      dek: "Short guides on EMDR, sets, and staying safe.",
      search: "Search guides",
      paths: [
        {
          id: "understand",
          label: "Understand",
          cardDek: "What EMDR is",
          panelTitle: "Get started with",
          panelAccent: "EMDR.",
          panelDek: "Three guides. Read in order.",
          moreLabel: "",
          moreHref: "",
        },
        {
          id: "practice",
          label: "Practice",
          cardDek: "Sets between sessions",
          panelTitle: "Practice with",
          panelAccent: "session sets.",
          panelDek: "Sets, structure, between days.",
          moreLabel: "",
          moreHref: "",
        },
        {
          id: "safety",
          label: "Safety",
          cardDek: "When to pause",
          panelTitle: "Stay safe with",
          panelAccent: "grounding.",
          panelDek: "Pause, stop, or get a human.",
          moreLabel: "Read the full safety guide",
          moreHref: "/safety",
        },
      ],
    },
  },
  {
    id: "knowledge-hero",
    name: "Knowledge: hero",
    fields: [
      text("title", "Title"),
      area("lead", "Lead"),
      area("intro", "Intro"),
      media("clip", "Clip", "Image, or a video with a poster."),
    ],
    defaults: {
      title: "EMDR knowledge clips",
      lead: "Tap a question. A different clip answers.",
      intro: `Short clips about sessions, sets, and staying safe in ${BRAND_SPOKEN}.`,
      clipKind: "video",
      clipImage: "/marketing/landing/support-talk.jpg",
      clipVideo: "/marketing/knowledge/hero.mp4",
      clipPoster: "/marketing/landing/support-talk.jpg",
      clipAlt: "",
    },
  },
  {
    id: "knowledge-series",
    name: "Knowledge: series",
    fields: [
      {
        key: "series",
        label: "Series headings",
        kind: "list",
        itemLabel: "Series",
        max: 2,
        fixed: true,
        fields: [text("title", "Title"), area("role", "Role")],
      },
    ],
    defaults: {
      series: [
        { id: "sessions", title: "Sessions", role: `How practice works\nin ${BRAND_SPOKEN}` },
        { id: "safety", title: "Safety", role: "Before you start\na set" },
      ],
    },
  },
  {
    id: "knowledge-more",
    name: "Knowledge: more",
    fields: [
      text("kicker", "Kicker"),
      text("title", "Title"),
      {
        key: "links",
        label: "Links",
        kind: "list",
        itemLabel: "Link",
        max: 8,
        fields: [text("label", "Label"), text("dek", "Line"), link("href", "Link")],
      },
    ],
    defaults: {
      kicker: "Keep going",
      title: "Guides beside the clips",
      links: [
        { href: "/learn", label: "Learn", dek: "Start-here map" },
        { href: "/blog", label: "Blog", dek: "Full guide archive" },
        { href: "/safety", label: "Safety", dek: "When to stop" },
        { href: "/emdr", label: "EMDR", dek: "How the app works" },
      ],
    },
  },
  {
    id: "support-page",
    name: "Support",
    fields: [
      text("title", "Title"),
      area("lead", "Lead"),
      {
        key: "sections",
        label: "Sections",
        kind: "list",
        itemLabel: "Section",
        max: 6,
        fields: [text("heading", "Heading"), area("body", "Body", "Links: [Label](/path)")],
      },
    ],
    defaults: {
      title: "Support — Get Help With Your Account",
      lead: `Product questions about ${BRAND_SPOKEN} — accounts, billing, and how a session works. For clinical crisis help, use the lines below, not email.`,
      sections: [
        {
          heading: "In the app",
          body: "Open Need help from any signed-in screen. The chat answers common questions and can pass a message to the team when needed.",
        },
        {
          heading: "Email",
          body: "Write to [support@nurahelp.com](mailto:support@nurahelp.com). We read every message; reply times vary.",
        },
        {
          heading: "Also useful",
          body: "[FAQ](/faq) — sessions, Self-guided sets, trial, privacy\n[Pricing](/pricing) — weekly, monthly, and yearly plans\n[Safety](/safety) — when to stop and get help\n[Limits](/limits) — what the app does not do",
        },
      ],
    },
  },
  {
    id: "editorial-page",
    name: "Editorial",
    fields: [
      text("kicker", "Kicker"),
      text("title", "Title"),
      area("dek", "Dek"),
      {
        key: "sections",
        label: "Sections",
        kind: "list",
        itemLabel: "Section",
        max: 8,
        fields: [text("heading", "Heading"), area("body", "Body", "Links: [Label](/path)")],
      },
    ],
    defaults: {
      kicker: "Editorial",
      title: "How we write these guides",
      dek: "Public pages on Nura are self-help explainers. They are not a clinician’s letterhead, and they are not signed by a licensed EMDR therapist.",
      sections: [
        {
          heading: "What you are reading",
          body: `The [guides](/blog) describe how EMDR-style visual sets work in this app: a moving ball, AI agent-guided and Self-guided modes, grounding, and when to stop. They exist so search and a tired Tuesday night can meet the same honest sentences.\n\nThey are written by the ${BRAND_SPOKEN} product team. Dates on each article are when that page was last edited, not a medical review stamp.`,
        },
        {
          heading: "What we will not put on the page",
          body: "We will not invent a named clinical advisor to look like a directory of therapists. We do not currently publish a licensed EMDR clinician as author or reviewer of these guides. How clinical review works — and which external authorities we cite — is on [Clinical review](/about/clinical-team). If a named advisor is listed later, credentials will be checkable — not a stock bio.\n\nWe also will not claim Nura treats PTSD, diagnoses anything, or replaces the person who can see your face.",
        },
        {
          heading: "How that shows up in a session",
          body: "The differentiator is in the product, not in a white coat: [visual sets with a moving ball in a Nura session](/emdr). Chat that only talks about EMDR is not a set. This software still is not emergency care.",
        },
        {
          heading: "If you need a human",
          body: "Use local emergency services if you are unsafe. For clinical EMDR, you need a trained person — not this site. Questions about the product: support@nurahelp.com.",
        },
      ],
    },
  },
  {
    id: "safety-page",
    name: "Safety",
    fields: [article("body", "Page text")],
    defaults: { body: SAFETY_ARTICLE },
  },
  {
    id: "limits-page",
    name: "Limits",
    fields: [article("body", "Page text")],
    defaults: { body: LIMITS_ARTICLE },
  },
  {
    id: "clinical-intro",
    name: "Clinical review: intro",
    fields: [article("body", "Text")],
    defaults: { body: CLINICAL_INTRO_ARTICLE },
  },
  {
    id: "clinical-advisor",
    name: "Clinical review: advisor",
    fields: [
      text("title", "Heading"),
      area("fallback", "Text while no advisor is named", "Links: [Label](/path)"),
    ],
    defaults: { title: "Named clinical advisor", fallback: CLINICAL_ADVISOR_FALLBACK },
  },
  {
    id: "clinical-outro",
    name: "Clinical review: related",
    fields: [article("body", "Text")],
    defaults: { body: CLINICAL_OUTRO_ARTICLE },
  },
  {
    id: "emdr-intro",
    name: "EMDR: guide",
    fields: [article("body", "Text")],
    defaults: { body: EMDR_INTRO_ARTICLE },
  },
  {
    id: "emdr-compare",
    name: "EMDR: comparison table",
    fields: [
      text("title", "Heading"),
      text("colA", "Column 1"),
      text("colB", "Column 2"),
      {
        key: "rows",
        label: "Rows",
        kind: "list",
        itemLabel: "Row",
        max: 20,
        fields: [text("label", "Row label"), text("a", "Column 1"), text("b", "Column 2")],
      },
      article("summary", "Text under the table"),
    ],
    defaults: {
      title: "AI-guided EMDR vs. in-person EMDR therapy",
      colA: "Nura (AI-guided)",
      colB: "In-person EMDR therapy",
      rows: EMDR_COMPARE_ROWS.map((row) => ({ ...row })),
      summary: EMDR_COMPARE_SUMMARY,
    },
  },
  {
    id: "emdr-guide",
    name: "EMDR: who it is for and safety",
    fields: [article("body", "Text")],
    defaults: { body: EMDR_GUIDE_ARTICLE },
  },
  {
    id: "emdr-faq",
    name: "EMDR: FAQ",
    fields: [
      text("title", "Heading"),
      {
        key: "items",
        label: "Questions",
        kind: "list",
        itemLabel: "Question",
        max: 30,
        fields: [text("q", "Question"), area("a", "Answer", "Links: [Label](/path), **bold**")],
      },
    ],
    defaults: {
      title: "Frequently asked questions",
      items: faqDefaults(EMDR_FAQ_ITEMS).map((item) =>
        item.q.startsWith("Is my data private") ? { ...item, a: EMDR_PRIVACY_ANSWER } : item
      ),
    },
  },
  {
    id: "emdr-close",
    name: "EMDR: start a session",
    fields: [
      text("title", "Heading"),
      area("body", "Text", "Links: [Label](/path), **bold**"),
      {
        key: "actions",
        label: "Buttons",
        kind: "list",
        itemLabel: "Button",
        max: 4,
        fields: [
          text("label", "Label"),
          link("href", "Link"),
          text("style", "Style", "primary or ghost"),
        ],
      },
      area("note", "Note", "Links: [Label](/path), **bold**"),
    ],
    defaults: {
      title: "Start a session",
      body: "Nura is free to try. No waiting list, no referral, no appointment.",
      actions: [
        { label: "Start a session", href: LOGIN_PATH, style: "primary" },
        { label: "Read the safety guide", href: "/safety", style: "ghost" },
        { label: "How a session is structured", href: "/learn", style: "ghost" },
      ],
      note: EMDR_CLOSE_NOTE,
    },
  },
];

/* ---------- New homepage (HomeLandingV2) ---------- */

const lines = (key: string, label: string) => area(key, label, "One per line.");
const sectionHead = (accentHint = "Words from the title shown in the green italic accent.") => [
  text("kicker", "Kicker"),
  text("title", "Title"),
  text("accent", "Accent words", accentHint),
  area("sub", "Subline"),
];

const V2_SECTIONS: SectionDef[] = [
  {
    id: "footer-wordmark",
    name: "Footer: big wordmark",
    fields: [
      text("text", "Wordmark", "\"nura\" uses the logo lettering; any other word is set in the brand font."),
      text("color", "Colour", "Hex, e.g. #ffffff. It fades to transparent at the bottom."),
    ],
    defaults: { text: "nura", color: "#ffffff" },
  },
  {
    id: "home-hero",
    name: "Home: hero",
    ownBackground: true,
    fields: [
      text("kicker", "Pill"),
      text("title1", "Title line 1"),
      text("title2", "Title line 2"),
      text("accent", "Accent word", "Part of line 2 shown in the green italic accent."),
      area("sub", "Text"),
      text("primary", "Main button"),
      link("primaryHref", "Main button link"),
      text("secondary", "Second button"),
      link("secondaryHref", "Second button link"),
      {
        key: "trust",
        label: "Checks under the buttons",
        kind: "list",
        itemLabel: "Check",
        max: 3,
        fixed: true,
        fields: [text("label", "Text")],
      },
    ],
    defaults: {
      kicker: "AI-guided EMDR, between sessions",
      title1: "EMDR therapy online.",
      title2: "in a calm app.",
      accent: "calm",
      sub: "Guided sessions you run yourself. Visual sets, optional voice, grounding, and short guides for the moments between sessions.",
      primary: `Start your ${TRIAL_DAYS}-day trial`,
      primaryHref: appPath("/create-account"),
      secondary: "See how it works",
      secondaryHref: "#how-it-works",
      trust: [
        { id: "trial", label: `${TRIAL_DAYS}-day trial` },
        { id: "cancel", label: "Cancel anytime" },
        { id: "selfhelp", label: "Self-help, not therapy" },
      ],
    },
  },
  {
    id: "home-trust",
    name: "Home: trust strip",
    fields: [
      text("line", "Line"),
      {
        key: "chips",
        label: "Chips",
        kind: "list",
        itemLabel: "Chip",
        max: 4,
        fixed: true,
        fields: [text("label", "Text")],
      },
    ],
    defaults: {
      line: "Support for therapy. Starting with EMDR.",
      chips: [
        { id: "trial", label: "7-day trial" },
        { id: "cancel", label: "Cancel anytime" },
        { id: "private", label: "Private by design" },
        { id: "between", label: "Built for between sessions" },
      ],
    },
  },
  {
    id: "home-modes",
    name: "Home: two ways in",
    fields: [
      ...sectionHead(),
      {
        key: "modes",
        label: "Modes",
        kind: "list",
        itemLabel: "Mode",
        max: 2,
        fixed: true,
        fields: [
          text("label", "Tab label"),
          text("hint", "Tab hint"),
          text("kicker", "Kicker"),
          text("title", "Title"),
          text("accent", "Accent words"),
          area("body", "Text"),
          image("image", "Image"),
          text("alt", "Image alt text"),
          lines("chips", "Chips"),
        ],
      },
      text("link", "Link label"),
      link("linkHref", "Link"),
    ],
    defaults: {
      kicker: "Two ways in",
      title: "An agent beside you, or a quiet set you run yourself.",
      accent: "quiet",
      sub: "Both live in the same calm workspace. You choose how much support you want.",
      modes: [
        {
          id: "guided",
          label: "AI agent-guided",
          hint: "The guide walks with you",
          kicker: "With an agent",
          title: "An agent beside you.",
          accent: "agent",
          body: "The guide walks you through intake, sets, check-ins, and closure. Write in your language, at your pace.",
          image: "/marketing/landing/support-talk.jpg",
          alt: "A calm conversation in a supportive setting",
          chips: "Guided phases\nCheck-ins\nYour language",
        },
        {
          id: "self",
          label: "Self-guided",
          hint: "You set the rhythm",
          kicker: "On your own",
          title: "A quiet set you run yourself.",
          accent: "quiet",
          body: "No agent, no chat. Choose the visual set, sound, and timing. Pause any time.",
          image: "/marketing/landing/practice-space.jpg",
          alt: "A quiet space set up for practice",
          chips: "Visual sets\nStereo sound\nSession controls",
        },
      ],
      link: "Explore this mode",
      linkHref: "/learn",
    },
  },
  {
    id: "home-session",
    name: "Home: inside a session",
    fields: [
      ...sectionHead(),
      text("videoUrl", "Walkthrough video", "YouTube, Vimeo or .mp4 link. Leave empty for the app preview."),
      text("coverTitle", "Preview title"),
      text("coverNote", "Preview note"),
      {
        key: "features",
        label: "Features",
        kind: "list",
        itemLabel: "Feature",
        max: 4,
        fixed: true,
        fields: [text("label", "Text")],
      },
    ],
    defaults: {
      kicker: "Inside a session",
      title: "A calm room for the work.",
      accent: "calm",
      sub: "Grounding, visual sets, and check-ins in one quiet workspace.",
      videoUrl: "",
      coverTitle: "Session walkthrough",
      coverNote: "Video coming soon",
      features: [
        { id: "sets", label: "Visual sets" },
        { id: "voice", label: "Optional voice" },
        { id: "ground", label: "Grounding first" },
        { id: "notes", label: "Notes that stay yours" },
      ],
    },
  },
  {
    id: "home-stories",
    name: "Home: stories",
    fields: [
      ...sectionHead(),
      text("rating", "Rating"),
      text("ratingLine", "Rating line"),
      {
        key: "stories",
        label: "Stories",
        kind: "list",
        itemLabel: "Story",
        max: 12,
        fields: [area("quote", "Quote"), text("name", "Name"), text("role", "Role")],
      },
    ],
    defaults: {
      kicker: "Stories",
      title: "Their experience, your confidence.",
      accent: "your",
      sub: "Voices from people using Nura between sessions.",
      rating: "4.9",
      ratingLine: "from early members",
      stories: [
        {
          quote: "The interface feels calm enough to actually stay with a difficult memory. Self-guided sessions let me practice without an agent.",
          name: "Maya L.",
          role: "Trial member",
        },
        { quote: "The session agent walks me through phases instead of dumping me into a blank screen.", name: "James R.", role: "Monthly plan" },
        { quote: "Resources are short and clear. Finally something that explains EMDR without overwhelming me.", name: "Sophie T.", role: "Resources reader" },
        { quote: "I use it between sessions. The steps feel structured but never rushed.", name: "Daniel K.", role: "Yearly plan" },
      ],
    },
  },
  {
    id: "home-pricing",
    name: "Home: pricing",
    fields: [
      ...sectionHead(),
      text("cta", "Card button"),
      text("featuresLabel", "Features label"),
      {
        key: "plans",
        label: "Plans",
        kind: "list",
        itemLabel: "Plan",
        max: 3,
        fixed: true,
        fields: [
          text("name", "Name"),
          text("badge", "Badge"),
          area("details", "Text"),
          text("note", "Price note"),
          lines("features", "Features"),
        ],
      },
      text("note", "Note under the cards"),
    ],
    defaults: {
      kicker: "Pricing",
      title: "Plans tailored to your pace.",
      accent: "your pace",
      sub: `Start with a ${TRIAL_DAYS}-day trial. Every paid plan unlocks the same AI agent-guided and Self-guided sessions. Pick how often you want to be billed.`,
      cta: "Start your trial",
      featuresLabel: "What is included",
      plans: [
        {
          id: "yearly",
          name: "Yearly",
          badge: "Best value",
          details: "One calm price for a full year. The lowest cost per month if Nura becomes part of your routine.",
          note: "About $8.25 per month",
          features: "Everything in Monthly\nLowest cost per month\nPay once, fewer interruptions\nCustomer portal for billing\nKeep your history and settings",
        },
        {
          id: "monthly",
          name: "Monthly",
          badge: "Most popular",
          details: "The everyday plan for practice between sessions. Billed monthly, cancel anytime.",
          note: "",
          features: "Unlimited AI agent-guided + Self-guided sessions\nFull protocol phases and check-ins\nResources library access\nCustomer portal for billing\nUpgrade or switch plans later",
        },
        {
          id: "weekly",
          name: "Weekly",
          badge: "",
          details: "Flexible billing if you want to stay light. Same full app, billed each week.",
          note: "",
          features: "Unlimited AI agent-guided sessions\nFull Self-guided sessions\nNo ads on paid plans\nCancel anytime in the portal\nSame session workspace as other plans",
        },
      ],
      note: "Cancel anytime in the customer portal. Prices in USD.",
    },
  },
  {
    id: "home-close",
    name: "Home: call to action",
    ownBackground: true,
    fields: [
      text("kicker", "Kicker"),
      text("title", "Title"),
      text("accent", "Accent words"),
      area("body", "Text"),
      text("primary", "Main button"),
      link("primaryHref", "Main button link"),
      text("secondary", "Second button", "Leave empty to hide."),
      link("secondaryHref", "Second button link"),
      text("note", "Note"),
    ],
    defaults: {
      kicker: "A gentler next step",
      title: "A calmer next step.",
      accent: "calmer",
      body: `Try Nura for ${TRIAL_DAYS} days. Start with one short session and see how it feels.`,
      primary: "Start your trial",
      primaryHref: appPath("/create-account"),
      secondary: "Read the safety notes",
      secondaryHref: "/safety",
      note: "Self-help, not therapy or crisis care.",
    },
  },
];

/* ---------- Call to action on every other public page (off until switched on) ---------- */

export const PAGE_CTA_PAGES = {
  about: "About",
  faq: "FAQ",
  blog: "Blog",
  learn: "Learn",
  knowledge: "Knowledge",
  support: "Support",
  editorial: "Editorial",
  safety: "Safety",
  limits: "Limits",
  clinical: "Clinical review",
} as const;

export function pageCtaId(page: string): string {
  return `page-cta-${page}`;
}

const PAGE_CTA_SECTIONS: SectionDef[] = Object.entries(PAGE_CTA_PAGES).map(([page, label]) => ({
  id: pageCtaId(page),
  name: `${label}: call to action`,
  fields: [
    text("kicker", "Kicker"),
    text("title", "Heading"),
    area("body", "Text", "Links: [Label](/path), **bold**"),
    text("ctaLabel", "Button label"),
    link("ctaHref", "Button link"),
    text("secondaryLabel", "Second button label", "Leave empty to hide"),
    link("secondaryHref", "Second button link"),
  ],
  defaults: {
    _off: "1",
    kicker: "",
    title: "Ready when you are",
    body: `Try Nura for ${TRIAL_DAYS} days. Start with one short session and see how it feels.`,
    ctaLabel: "Start your trial",
    ctaHref: appPath("/create-account"),
    secondaryLabel: "",
    secondaryHref: "",
  },
}));

const REPLACED_IDS = new Set(V2_SECTIONS.map((def) => def.id));

/* ---------- One definition per visual section ---------- */
type PartSpec = {
  id: string;
  name: string;
  /** Field keys taken from the base definition, in panel order. */
  keys: string[];
  labels?: Record<string, string>;
  /** Fields that only this part has (placed before the base keys). */
  extra?: { fields: Field[]; defaults: SectionConfig };
  noHide?: boolean;
};

/**
 * Blocks that render inside one component but are separate on the page.
 * The first part keeps the base id, so page layouts are unchanged.
 */
const COMPONENT_PARTS: Record<string, PartSpec[]> = {
  "home-how": [
    { id: "home-how", name: "Home: how it works", keys: ["badge", "intro1", "intro2", "intro3"] },
    { id: "home-how-stages", name: "Home: session stages", keys: ["stages"] },
    { id: "home-how-rhythm", name: "Home: rhythm cards", keys: ["rhythm"], labels: { rhythm: "Cards" } },
    { id: "home-how-ground", name: "Home: grounding cards", keys: ["ground"], labels: { ground: "Cards" } },
    {
      id: "home-how-between",
      name: "Home: between sessions",
      keys: [],
      extra: {
        fields: [
          text("betweenKicker", "Kicker"),
          text("betweenTitle", "Title"),
          text("betweenAccent", "Accent words", "Part of the title shown in the green italic accent."),
          area("betweenLine", "Line"),
          text("betweenCta", "Button"),
          link("betweenCtaHref", "Button link"),
        ],
        defaults: {
          betweenKicker: "Between sessions",
          betweenTitle: "Self-guided session \u2014 sets without an agent",
          betweenAccent: "Self-guided",
          betweenLine: "Practice in the gap, on your schedule.",
          betweenCta: "Start for free",
          betweenCtaHref: appPath("/create-account"),
        },
      },
    },
    {
      id: "home-how-languages",
      name: "Home: languages",
      keys: ["kitKicker", "kitTitle", "kitSub", "kitPoints"],
      labels: { kitKicker: "Kicker", kitTitle: "Title", kitSub: "Line", kitPoints: "Points" },
    },
  ],
  "footer-links": [
    { id: "footer-links", name: "Footer: links", keys: ["tagline", "columns"], noHide: true },
    {
      id: "footer-newsletter",
      name: "Footer: newsletter",
      keys: ["newsTitle", "newsHint", "newsPlaceholder", "newsSend", "newsSending", "newsThanks", "newsOptIn"],
      labels: {
        newsTitle: "Title",
        newsHint: "Hint",
        newsPlaceholder: "Email placeholder",
        newsSend: "Send button",
        newsSending: "Sending label",
        newsThanks: "Thank-you line",
        newsOptIn: "Opt-in line",
      },
    },
    { id: "footer-legal", name: "Footer: legal links", keys: ["legal"], labels: { legal: "Links" } },
  ],
  "about-page": [
    { id: "about-page", name: "About: header", keys: ["kicker", "title", "dek"] },
    { id: "about-sections", name: "About: text sections", keys: ["sections"] },
    {
      id: "about-actions",
      name: "About: buttons",
      keys: ["primary", "primaryHref", "secondary", "secondaryHref", "tertiary", "tertiaryHref"],
    },
  ],
  "support-page": [
    { id: "support-page", name: "Support: header", keys: ["title", "lead"] },
    { id: "support-sections", name: "Support: text sections", keys: ["sections"] },
  ],
  "editorial-page": [
    { id: "editorial-page", name: "Editorial: header", keys: ["kicker", "title", "dek"] },
    { id: "editorial-sections", name: "Editorial: text sections", keys: ["sections"] },
  ],
  "faq-page": [
    { id: "faq-page", name: "FAQ: header", keys: ["title", "lead"] },
    { id: "faq-questions", name: "FAQ: questions", keys: ["items"] },
  ],
};

/**
 * Long articles split at every "## " heading. Each piece is its own page
 * section (own chip, own panel, own place in the page layout). The first
 * piece keeps the base id.
 */
const ARTICLE_PARTS: Record<string, string> = {
  "safety-page": "Safety",
  "limits-page": "Limits",
  "clinical-intro": "Clinical review",
  "emdr-intro": "EMDR",
  "emdr-guide": "EMDR",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\*\*|\[|\]\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-[a-z0-9]*$/, (tail) => (value.length > 48 ? "" : tail));
}

/** Splits markdown before each "## " line. Rendering the pieces one after another gives the same blocks. */
export function splitArticleBody(body: string): { heading: string; body: string }[] {
  const lines = body.split("\n");
  const pieces: { heading: string; lines: string[] }[] = [{ heading: "", lines: [] }];
  for (const line of lines) {
    if (line.startsWith("## ")) pieces.push({ heading: line.slice(3).trim(), lines: [] });
    pieces[pieces.length - 1]!.lines.push(line);
  }
  return pieces
    .map((piece) => ({ heading: piece.heading, body: piece.lines.join("\n").replace(/^\n+|\n+$/g, "") }))
    .filter((piece) => piece.body.trim().length > 0);
}

function fieldKeys(field: Field): string[] {
  if (field.kind !== "media") return [field.key];
  return Object.values(mediaNames(field.key));
}

function buildParts(base: SectionDef, parts: PartSpec[]): SectionDef[] {
  return parts.map((part) => {
    const fields: Field[] = [...(part.extra?.fields ?? [])];
    const defaults: SectionConfig = { ...(part.extra?.defaults ?? {}) };
    for (const key of part.keys) {
      const field = base.fields.find((entry) => entry.key === key);
      if (!field) throw new Error(`${base.id}: no field ${key}`);
      const label = part.labels?.[key];
      fields.push(label ? { ...field, label } : field);
      for (const name of fieldKeys(field)) {
        if (name in base.defaults) defaults[name] = base.defaults[name]!;
      }
    }
    return { id: part.id, name: part.name, fields, defaults, ...(part.noHide ? { noHide: true } : {}) };
  });
}

function buildArticleParts(base: SectionDef, page: string): SectionDef[] {
  const field = base.fields.find((entry) => entry.key === "body");
  const body = typeof base.defaults.body === "string" ? base.defaults.body : "";
  if (!field) return [base];
  const pieces = splitArticleBody(body);
  const used = new Set<string>();
  return pieces.map((piece, index) => {
    let id = base.id;
    if (index > 0) {
      id = `${base.id}-${slugify(piece.heading) || index}`;
      while (used.has(id)) id = `${id}-${index}`;
    }
    used.add(id);
    const heading = piece.heading.replace(/\*\*/g, "") || "Introduction";
    return {
      id,
      name: `${page}: ${heading}`,
      fields: [{ ...field, label: "Text" }],
      defaults: { body: piece.body },
    };
  });
}

const ARTICLE_SLOTS: Record<string, string[]> = {};
const PART_IDS: Record<string, string[]> = {};

function expandSections(base: readonly SectionDef[]): SectionDef[] {
  const out: SectionDef[] = [];
  for (const def of base) {
    const parts = COMPONENT_PARTS[def.id];
    const article = ARTICLE_PARTS[def.id];
    if (parts) {
      const built = buildParts(def, parts);
      PART_IDS[def.id] = built.map((entry) => entry.id);
      out.push(...built);
    } else if (article) {
      const built = buildArticleParts(def, article);
      ARTICLE_SLOTS[def.id] = built.map((entry) => entry.id);
      out.push(...built);
    } else {
      out.push(def);
    }
  }
  return out;
}

export const MARKETING_SECTIONS: readonly SectionDef[] = expandSections([
  ...BASE_SECTIONS.filter((def) => !REPLACED_IDS.has(def.id)),
  ...V2_SECTIONS,
  ...PAGE_CTA_SECTIONS,
]);

/** Page-layout slot ids for a long article (one per "## " piece). */
export function articleSlotIds(baseId: string): string[] {
  return ARTICLE_SLOTS[baseId] ?? [baseId];
}

/** Base id whose component renders several separately edited parts. */
export function hasSectionParts(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(COMPONENT_PARTS, id);
}

/** Section switched off in its own panel ("Show this section" unticked). */
export const SECTION_OFF_KEY = "_off";

export function isSectionOn(config: SectionConfig | undefined): boolean {
  return config?.[SECTION_OFF_KEY] !== "1";
}

/* ---------- Admin-added sections ---------- */

export const CUSTOM_SECTION_TYPES = ["text", "media", "cta", "marquee", "poster", "faq", "cards"] as const;
export type CustomSectionType = (typeof CUSTOM_SECTION_TYPES)[number];

const CUSTOM_ID = /^custom-(text|media|cta|marquee|poster|faq|cards)-[a-z0-9]{8}$/;

export function isCustomSectionId(id: string): boolean {
  return CUSTOM_ID.test(id);
}

export function customSectionType(id: string): CustomSectionType | null {
  const match = CUSTOM_ID.exec(id);
  return match ? (match[1] as CustomSectionType) : null;
}

export function newCustomSectionId(type: CustomSectionType): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  let suffix = "";
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return `custom-${type}-${suffix}`;
}

const BODY_HINT = ARTICLE_HINT;

export const CUSTOM_SECTION_TEMPLATES: Record<
  CustomSectionType,
  { label: string; description: string; fields: Field[]; defaults: SectionConfig }
> = {
  text: {
    label: "Text block",
    description: "Heading, text and an optional button.",
    fields: [
      text("kicker", "Kicker"),
      text("title", "Heading"),
      { ...article("body", "Text"), max: 8000, hint: BODY_HINT },
      text("ctaLabel", "Button label", "Leave empty to hide the button"),
      link("ctaHref", "Button link"),
    ],
    defaults: {
      kicker: "",
      title: "New section",
      body: "Write your text here. Use **bold** and [links](/pricing).",
      ctaLabel: "",
      ctaHref: "",
    },
  },
  media: {
    label: "Image or video with text",
    description: "Media on one side, text on the other.",
    fields: [
      media("media", "Image or video"),
      text("side", "Media side", "left or right"),
      text("kicker", "Kicker"),
      text("title", "Heading"),
      { ...article("body", "Text"), max: 8000, hint: BODY_HINT },
      text("ctaLabel", "Button label", "Leave empty to hide the button"),
      link("ctaHref", "Button link"),
    ],
    defaults: {
      mediaKind: "image",
      mediaImage: "",
      mediaVideo: "",
      mediaPoster: "",
      mediaAlt: "",
      side: "left",
      kicker: "",
      title: "New section",
      body: "Write your text here.",
      ctaLabel: "",
      ctaHref: "",
    },
  },
  cta: {
    label: "Call to action",
    description: "A centred band with a heading and buttons.",
    fields: [
      text("title", "Heading"),
      area("body", "Text", "Links: [Label](/path), **bold**"),
      text("ctaLabel", "Button label"),
      link("ctaHref", "Button link"),
      text("secondaryLabel", "Second button label", "Leave empty to hide"),
      link("secondaryHref", "Second button link"),
    ],
    defaults: {
      title: "Ready when you are",
      body: "",
      ctaLabel: "Start a session",
      ctaHref: LOGIN_PATH,
      secondaryLabel: "",
      secondaryHref: "",
    },
  },
  marquee: {
    label: "Call to action with image marquee",
    description: "Dark band, big heading, two buttons and a row of images that drifts sideways.",
    fields: [
      text("kicker", "Kicker"),
      text("title", "Heading"),
      area("body", "Text", "Links: [Label](/path), **bold**"),
      text("ctaLabel", "Button label"),
      link("ctaHref", "Button link"),
      text("secondaryLabel", "Second button label", "Leave empty to hide"),
      link("secondaryHref", "Second button link"),
      {
        key: "images",
        label: "Images",
        kind: "list",
        itemLabel: "Image",
        max: 16,
        fields: [image("image", "Image"), text("alt", "Alt text", "Describe the image, or leave empty if decorative")],
      },
    ],
    defaults: {
      kicker: "",
      title: "Calmer practice, in a few minutes",
      body: "",
      ctaLabel: `Start your ${TRIAL_DAYS}-day trial`,
      ctaHref: appPath("/create-account"),
      secondaryLabel: "See pricing",
      secondaryHref: "/pricing",
      images: [
        { image: "/marketing/landing/golden-hills.jpg", alt: "" },
        { image: "/marketing/landing/support-talk.jpg", alt: "" },
        { image: "/marketing/landing/calm-water.jpg", alt: "" },
        { image: "/marketing/landing/morning-tea.jpg", alt: "" },
        { image: "/marketing/landing/green-meadow.jpg", alt: "" },
        { image: "/marketing/landing/together.jpg", alt: "" },
        { image: "/marketing/landing/forest-path.jpg", alt: "" },
        { image: "/marketing/landing/journal.jpg", alt: "" },
        { image: "/marketing/landing/wildflower-sky.jpg", alt: "" },
        { image: "/marketing/landing/quiet-hands.jpg", alt: "" },
      ],
    },
  },
  poster: {
    label: "Poster word (Heal)",
    description: "A giant serif word that reveals letter by letter over a nature photo, with a small kicker row and a short line.",
    fields: [
      text("word", "Big word", "Up to 12 letters, e.g. Heal"),
      image("image", "Nature image", "Sits under the word; the top of the letters is filled with it"),
      text("alt", "Image alt text", "Describe the image, or leave empty if decorative"),
      text("kicker", "Kicker row", "Small mono row at the top; separate items with |"),
      text("line", "Short line", "Top right, e.g. Healing is not linear"),
      text("note", "Corner note", "Bottom right over the photo, e.g. - Find your calm -"),
    ],
    defaults: {
      word: "Heal",
      image: "/marketing/landing/forest-path.jpg",
      alt: "",
      kicker: "NURA | EMDR AT HOME | GENTLE BY DESIGN",
      line: "Healing is not linear",
      note: "- Find your calm -",
    },
  },
  faq: {
    label: "Questions (FAQ)",
    description: "Expandable questions and answers.",
    fields: [
      text("kicker", "Kicker"),
      text("title", "Heading"),
      {
        key: "items",
        label: "Questions",
        kind: "list",
        itemLabel: "Question",
        max: 30,
        fields: [text("q", "Question"), area("a", "Answer", "Links: [Label](/path), **bold**")],
      },
    ],
    defaults: {
      kicker: "",
      title: "Questions",
      items: [{ q: "New question", a: "Answer." }],
    },
  },
  cards: {
    label: "Cards",
    description: "A grid of cards with optional image and link.",
    fields: [
      text("kicker", "Kicker"),
      text("title", "Heading"),
      {
        key: "items",
        label: "Cards",
        kind: "list",
        itemLabel: "Card",
        max: 12,
        fields: [
          media("media", "Image or video"),
          text("title", "Title"),
          area("body", "Text", "Links: [Label](/path), **bold**"),
          link("href", "Link (optional)"),
        ],
      },
    ],
    defaults: {
      kicker: "",
      title: "New cards",
      items: [
        { title: "First card", body: "Card text." },
        { title: "Second card", body: "Card text." },
        { title: "Third card", body: "Card text." },
      ],
    },
  },
};

const BY_ID = new Map(MARKETING_SECTIONS.map((section) => [section.id, section]));
const CUSTOM_DEFS = new Map<string, SectionDef>();

function customDef(id: string): SectionDef | undefined {
  const type = customSectionType(id);
  if (!type) return undefined;
  const cached = CUSTOM_DEFS.get(id);
  if (cached) return cached;
  const template = CUSTOM_SECTION_TEMPLATES[type];
  const def: SectionDef = {
    id,
    name: `Added: ${template.label}`,
    fields: template.fields,
    defaults: template.defaults,
  };
  if (CUSTOM_DEFS.size < 500) CUSTOM_DEFS.set(id, def);
  return def;
}

export function getSectionDef(id: string): SectionDef | undefined {
  return BY_ID.get(id) ?? customDef(id);
}

/** Built-in section ids plus admin-added `custom-<type>-<suffix>` ids. */
export function isMarketingSectionId(id: string): boolean {
  return BY_ID.has(id) || isCustomSectionId(id);
}

export function defaultMarketingCopy(): Record<string, SectionConfig> {
  const out: Record<string, SectionConfig> = {};
  for (const section of MARKETING_SECTIONS) {
    out[section.id] = normalizeSection(section.id, section.defaults);
  }
  return out;
}

function clampText(value: unknown, max: number, fallback: string): string {
  const raw = typeof value === "string" ? value : fallback;
  return raw.replace(/\u0000/g, "").replaceAll("Free sets", "Self-guided sets").slice(0, max);
}

/** Relative path, https, or mailto. Anything else falls back. */
export function safeHref(value: string, fallback: string): string {
  const v = value.trim();
  if (!v) return fallback;
  if (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")) {
    return v.slice(0, 300);
  }
  if (/^https:\/\/[^\s]+$/i.test(v)) return v.slice(0, 300);
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(v)) return v.slice(0, 300);
  if (/^tel:\+?[0-9][0-9 ()-]{0,24}$/i.test(v)) return v.slice(0, 40);
  if (/^#[A-Za-z][\w-]{0,60}$/.test(v)) return v;
  return fallback;
}

function asItem(value: unknown): SectionItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: SectionItem = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
}

/** Relative path or https. Anything else falls back. */
export function safeMediaUrl(value: string, fallback: string): string {
  const v = value.trim();
  if (!v) return fallback;
  if (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") && !v.includes("..")) {
    return v.slice(0, 300);
  }
  if (/^https:\/\/[^\s]+$/i.test(v)) return v.slice(0, 300);
  return fallback;
}

function normalizeScalar(
  field: ScalarField,
  raw: unknown,
  fallback: string
): string {
  const max = field.max ?? (field.kind === "textarea" ? AREA_MAX : TEXT_MAX);
  const textValue = clampText(raw, max, fallback);
  if (field.kind === "image") return safeMediaUrl(textValue, fallback.trim());
  if (field.href) {
    if (!textValue.trim() && !fallback.trim()) return "";
    return safeHref(textValue, fallback.trim() || "/");
  }
  return textValue;
}

function readSlotSource(source: Record<string, unknown> | SectionItem, key: string): string {
  const raw = source[key];
  return typeof raw === "string" ? raw : "";
}

export function normalizeMediaSlot(
  key: string,
  source: Record<string, unknown> | SectionItem,
  fallback: SectionItem
): SectionItem {
  const names = mediaNames(key);
  const fallbackKind = fallback[names.kind] === "video" ? "video" : "image";
  const rawKind = readSlotSource(source, names.kind);
  const out: SectionItem = {};
  out[names.kind] = rawKind === "video" || rawKind === "image" ? rawKind : fallbackKind;
  out[names.image] = safeMediaUrl(readSlotSource(source, names.image), fallback[names.image] ?? "");
  out[names.video] = safeMediaUrl(readSlotSource(source, names.video), fallback[names.video] ?? "");
  out[names.poster] = safeMediaUrl(readSlotSource(source, names.poster), fallback[names.poster] ?? "");
  out[names.alt] = clampText(readSlotSource(source, names.alt) || fallback[names.alt] || "", TEXT_MAX, fallback[names.alt] ?? "");
  return out;
}

/** Per-image position/zoom ("x y zoom", see lib/image-position); untouched images store nothing. */
function keepFramePos(out: SectionItem, source: Record<string, unknown> | SectionItem, imageKey: string) {
  const key = framePosKey(imageKey);
  const raw = (source as Record<string, unknown>)[key];
  const stored = formatImagePosition(typeof raw === "string" ? raw : "");
  if (stored) out[key] = stored;
}

function applyItemField(item: SectionItem, child: ItemField, incoming: SectionItem, def: SectionItem) {
  if (child.kind === "media") {
    Object.assign(item, normalizeMediaSlot(child.key, incoming, def));
    keepFramePos(item, incoming, mediaNames(child.key).image);
    return;
  }
  item[child.key] = normalizeScalar(child, incoming[child.key], def[child.key] ?? "");
  if (child.kind === "image") keepFramePos(item, incoming, child.key);
}

function itemHasContent(child: ItemField, item: SectionItem): boolean {
  if (child.kind === "media") {
    const names = mediaNames(child.key);
    return Boolean(item[names.image]?.trim() || item[names.video]?.trim());
  }
  return Boolean(item[child.key]?.trim());
}

/** List items carrying `_hidden: "1"` stay saved but are skipped by `sectionList`. */
export const HIDDEN_ITEM_KEY = "_hidden";

function mergeFixedItem(field: ListField, def: SectionItem, incoming: SectionItem): SectionItem {
  const next: SectionItem = {};
  if (typeof def.id === "string") next.id = def.id;
  for (const child of field.fields) applyItemField(next, child, incoming, def);
  if (incoming[HIDDEN_ITEM_KEY] === "1") next[HIDDEN_ITEM_KEY] = "1";
  return next;
}

function cloneFallback(field: ListField, fallback: SectionItem[]): SectionItem[] {
  return fallback.map((def) => mergeFixedItem(field, def, def));
}

function normalizeFixedList(field: ListField, rows: unknown[], fallback: SectionItem[]): SectionItem[] {
  const ids = fallback
    .map((item) => item.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const incoming = rows.map(asItem).filter((item): item is SectionItem => item != null);
  const keyed = ids.length === fallback.length && incoming.some((item) => item.id && ids.includes(item.id));
  if (!keyed) {
    return fallback.map((def, index) => mergeFixedItem(field, def, asItem(rows[index]) ?? {}));
  }
  const ordered: string[] = [];
  for (const item of incoming) {
    if (item.id && ids.includes(item.id) && !ordered.includes(item.id)) ordered.push(item.id);
  }
  for (const id of ids) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered.map((id) => {
    const def = fallback.find((item) => item.id === id) ?? {};
    const row = incoming.find((item) => item.id === id) ?? {};
    return mergeFixedItem(field, def, row);
  });
}

function normalizeList(
  field: ListField,
  raw: unknown,
  fallback: SectionItem[]
): SectionItem[] {
  if (!Array.isArray(raw)) return cloneFallback(field, fallback);
  if (field.fixed) return normalizeFixedList(field, raw, fallback);
  if (raw.length === 0) return [];
  const next: SectionItem[] = [];
  for (const row of raw.slice(0, field.max)) {
    const incoming = asItem(row);
    if (!incoming) continue;
    const item: SectionItem = {};
    let any = false;
    for (const child of field.fields) {
      applyItemField(item, child, incoming, {});
      if (itemHasContent(child, item)) any = true;
    }
    if (incoming[HIDDEN_ITEM_KEY] === "1") item[HIDDEN_ITEM_KEY] = "1";
    if (any) next.push(item);
  }
  return next;
}

export function normalizeSection(id: string, input: unknown): SectionConfig {
  const def = getSectionDef(id);
  if (!def) return {};
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const out: SectionConfig = {};
  for (const field of def.fields) {
    const fallback = def.defaults[field.key];
    if (field.kind === "list") {
      out[field.key] = normalizeList(
        field,
        source[field.key],
        Array.isArray(fallback) ? (fallback as SectionItem[]) : []
      );
    } else if (field.kind === "media") {
      Object.assign(
        out,
        normalizeMediaSlot(field.key, source, def.defaults as SectionItem)
      );
      keepFramePos(out as SectionItem, source, mediaNames(field.key).image);
    } else {
      out[field.key] = normalizeScalar(
        field,
        source[field.key],
        typeof fallback === "string" ? fallback : ""
      );
      if (field.kind === "image") keepFramePos(out as SectionItem, source, field.key);
    }
  }
  if (!def.noHide) {
    const raw = source[SECTION_OFF_KEY];
    const offByDefault = def.defaults[SECTION_OFF_KEY] === "1";
    // Sections that start hidden keep an explicit "0" once switched on.
    if (raw === "1" || (raw === undefined && offByDefault)) out[SECTION_OFF_KEY] = "1";
    else if (offByDefault) out[SECTION_OFF_KEY] = "0";
  }
  Object.assign(out, normalizeBackground(source), normalizeGradient(source));
  if (source[BG_DECOR_KEY] === "off") out[BG_DECOR_KEY] = "off";
  return out;
}

/* ---------- Section background (every section) ---------- */

export const BG_KINDS = ["image", "video", "color"] as const;
export type SectionBgKind = (typeof BG_KINDS)[number];
export const BG_KEYS = ["bgKind", "bgImage", "bgVideo", "bgPoster", "bgColor", "bgOverlay", "bgTone"] as const;
export const BG_DEFAULT_OVERLAY = 40;
/** "off" hides a section's built-in decorations (e.g. the hero's sky, sun and haze). */
export const BG_DECOR_KEY = "bgDecor";

/**
 * Built-in decorations only belong to the Default background: any custom
 * image/video/colour turns them off, and the editor can switch them off too.
 */
export function sectionDecor(config: SectionConfig | undefined): boolean {
  if (sectionBackground(config)) return false;
  return config?.[BG_DECOR_KEY] !== "off";
}

export type SectionBackground = {
  kind: SectionBgKind;
  image: string;
  video: string;
  poster: string;
  color: string;
  /** 0-90, percent. */
  overlay: number;
  tone: "light" | "dark";
  /** Position/zoom of the image ("x y zoom"), "" = as designed. */
  imagePos: string;
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Only kept when a kind is chosen, so an untouched section stores nothing extra. */
export function normalizeBackground(source: Record<string, unknown>): SectionItem {
  const kind = source.bgKind;
  if (kind !== "image" && kind !== "video" && kind !== "color") return {};
  const str = (key: string) => (typeof source[key] === "string" ? (source[key] as string) : "");
  const overlay = Number.parseInt(str("bgOverlay"), 10);
  const color = str("bgColor").trim();
  return {
    bgKind: kind,
    bgImage: safeMediaUrl(str("bgImage"), ""),
    bgVideo: safeMediaUrl(str("bgVideo"), ""),
    bgPoster: safeMediaUrl(str("bgPoster"), ""),
    bgColor: HEX.test(color) ? color.toLowerCase() : "#ffffff",
    bgOverlay: String(Number.isFinite(overlay) ? Math.min(90, Math.max(0, overlay)) : BG_DEFAULT_OVERLAY),
    bgTone: str("bgTone") === "dark" ? "dark" : "light",
    ...(formatImagePosition(str("bgImagePos")) ? { bgImagePos: formatImagePosition(str("bgImagePos")) } : {}),
  };
}

/** The background to paint, or null when the section keeps its own look. */
export function sectionBackground(config: SectionConfig | undefined): SectionBackground | null {
  if (!config) return null;
  const bg = normalizeBackground(config as Record<string, unknown>);
  if (!bg.bgKind) return null;
  const out: SectionBackground = {
    kind: bg.bgKind as SectionBgKind,
    image: bg.bgImage ?? "",
    video: bg.bgVideo ?? "",
    poster: bg.bgPoster ?? "",
    color: bg.bgColor ?? "#ffffff",
    overlay: Number(bg.bgOverlay ?? BG_DEFAULT_OVERLAY),
    tone: bg.bgTone === "dark" ? "dark" : "light",
    imagePos: bg.bgImagePos ?? "",
  };
  if (out.kind === "image" && !out.image) return null;
  if (out.kind === "video" && !out.video) return null;
  return out;
}

/* ---------- Optional gradient (every section; off by default) ---------- */

export const GRADIENT_KEYS = ["gradOn", "gradMode", "gradFrom", "gradTo", "gradAngle", "gradOpacity"] as const;
export const GRADIENT_DEFAULTS = { from: "#14301f", to: "#c6d67e", angle: 180, opacity: 60 } as const;

export type SectionGradient = {
  /** "overlay" sits on the image/video; "background" is the background itself. */
  mode: "overlay" | "background";
  from: string;
  to: string;
  /** Degrees, 0-360 (180 = top to bottom). */
  angle: number;
  /** 0-100, percent. */
  opacity: number;
};

/** Only kept when switched on, so an untouched section stores nothing (no gradient by default). */
export function normalizeGradient(source: Record<string, unknown>): SectionItem {
  if (source.gradOn !== "1") return {};
  const str = (key: string) => (typeof source[key] === "string" ? (source[key] as string).trim() : "");
  const num = (key: string, min: number, max: number, fallback: number) => {
    const n = Number.parseInt(str(key), 10);
    return String(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback);
  };
  return {
    gradOn: "1",
    gradMode: str("gradMode") === "background" ? "background" : "overlay",
    gradFrom: HEX.test(str("gradFrom")) ? str("gradFrom").toLowerCase() : GRADIENT_DEFAULTS.from,
    gradTo: HEX.test(str("gradTo")) ? str("gradTo").toLowerCase() : GRADIENT_DEFAULTS.to,
    gradAngle: num("gradAngle", 0, 360, GRADIENT_DEFAULTS.angle),
    gradOpacity: num("gradOpacity", 0, 100, GRADIENT_DEFAULTS.opacity),
  };
}

/** The gradient to paint, or null (the default: no gradient). */
export function sectionGradient(config: SectionConfig | undefined): SectionGradient | null {
  if (!config) return null;
  const g = normalizeGradient(config as Record<string, unknown>);
  if (g.gradOn !== "1") return null;
  const out: SectionGradient = {
    mode: g.gradMode === "background" ? "background" : "overlay",
    from: g.gradFrom ?? GRADIENT_DEFAULTS.from,
    to: g.gradTo ?? GRADIENT_DEFAULTS.to,
    angle: Number(g.gradAngle ?? GRADIENT_DEFAULTS.angle),
    opacity: Number(g.gradOpacity ?? GRADIENT_DEFAULTS.opacity),
  };
  return out.opacity > 0 ? out : null;
}

export function gradientCss(g: SectionGradient): string {
  return `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})`;
}

/**
 * Where a gradient lands: over the image/video when there is one and the mode
 * is "overlay"; otherwise it is the background itself.
 */
export function gradientIsOverlay(g: SectionGradient, bg: SectionBackground | null, hasMedia = false): boolean {
  if (g.mode !== "overlay") return false;
  return hasMedia || bg?.kind === "image" || bg?.kind === "video";
}

export function replaceSectionMedia(
  config: SectionConfig,
  from: string,
  to: string
): { config: SectionConfig; changed: boolean } {
  let changed = false;
  const next: SectionConfig = {};
  for (const [key, raw] of Object.entries(config)) {
    if (typeof raw === "string") {
      next[key] = raw === from ? to : raw;
      if (next[key] !== raw) changed = true;
      continue;
    }
    next[key] = raw.map((item) => {
      const copy = { ...item };
      for (const [child, value] of Object.entries(copy)) {
        if (value === from) {
          copy[child] = to;
          changed = true;
        }
      }
      return copy;
    });
  }
  return { config: next, changed };
}

export function localMarketingPaths(
  copy: Record<string, SectionConfig>
): { path: string; kind: "image" | "video" }[] {
  const found = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "string") {
      if (value.startsWith("/marketing/") && !value.includes("..")) found.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value && typeof value === "object") {
      for (const child of Object.values(value)) visit(child);
    }
  };
  for (const config of Object.values(copy)) visit(config);
  return [...found].sort().map((filePath) => ({
    path: filePath,
    kind: filePath.endsWith(".mp4") || filePath.endsWith(".webm") ? "video" : "image",
  }));
}

export function sectionText(config: SectionConfig | undefined, key: string): string {
  const value = config?.[key];
  return typeof value === "string" ? value : "";
}

export function sectionList(
  config: SectionConfig | undefined,
  key: string
): SectionItem[] {
  const value = config?.[key];
  return Array.isArray(value) ? value.filter((item) => item[HIDDEN_ITEM_KEY] !== "1") : [];
}

export function linesOf(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseLinkLines(raw: string): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    const pipe = trimmed.indexOf("|");
    if (pipe < 1) continue;
    const label = trimmed.slice(0, pipe).trim().slice(0, TEXT_MAX);
    const href = safeHref(trimmed.slice(pipe + 1).trim(), "");
    if (!label || !href) continue;
    out.push({ label, href });
  }
  return out;
}

export type FaqPair = { q: string; a: string };

export function faqPairs(config: SectionConfig | undefined): FaqPair[] {
  return sectionList(config, "items")
    .map((item) => ({ q: item.q?.trim() ?? "", a: item.a?.trim() ?? "" }))
    .filter((item) => item.q && item.a);
}
