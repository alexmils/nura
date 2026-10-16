import { TRIAL_DAYS } from "@/lib/billing-constants";
import {
  BRAND_SPOKEN,
  BRAND_TAGLINE,
  SESSION_MODE_GUIDED_LABEL,
  SESSION_MODE_SELF_LABEL,
  SESSION_MODE_GUIDED_SHORT,
  SESSION_MODE_SELF_SHORT,
} from "@/lib/brand";
import { LANDING_FAQ_ITEMS } from "@/lib/landing-faq";
import { PRICING_FAQ_ITEMS } from "@/lib/pricing-faq";
import { PUBLIC_FAQ_ITEMS } from "@/lib/public-faq";

/**
 * Inline marketing copy. Defaults are today's page strings.
 * Saved rows override them after `normalizeSection`.
 */

export type ScalarField = {
  key: string;
  label: string;
  kind: "text" | "textarea";
  href?: boolean;
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
  fields: ScalarField[];
};

export type Field = ScalarField | ListField;

export type SectionItem = Record<string, string>;

export type SectionConfig = Record<string, string | SectionItem[]>;

export type SectionDef = {
  id: string;
  name: string;
  fields: Field[];
  defaults: SectionConfig;
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

const link = (key: string, label: string): ScalarField => ({
  key,
  label,
  kind: "text",
  href: true,
});

const LINK_HINT = "One link per line: Label|/path";

function faqDefaults(
  items: readonly { q: string; a: string }[]
): SectionItem[] {
  return items.map((item) => ({ q: item.q, a: item.a }));
}

export const MARKETING_SECTIONS: readonly SectionDef[] = [
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
    ],
    defaults: {
      title: "People start with.",
      kicker: "Guides",
      more: "Read the guides",
      moreHref: "/blog",
    },
  },
  {
    id: "home-modes",
    name: "Home: session modes",
    fields: [
      text("title", "Title"),
      text("guided", "AI agent-guided tab"),
      text("self", "Self-guided tab"),
    ],
    defaults: {
      title: "One app, two seamless experiences.",
      guided: SESSION_MODE_GUIDED_LABEL,
      self: SESSION_MODE_SELF_LABEL,
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
    name: "Pricing cards",
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
          body: `${BRAND_SPOKEN} is operated by Receptly LLC. The spoken brand is ${BRAND_SPOKEN}; the domain is nurahelp.com. Legal pages name the operator — [Terms](/terms) and [Privacy](/privacy) — so you can see who is responsible for the product and for how data is handled.`,
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
      lead: "Short answers about sessions, Free sets, the trial, and when to get help. For plans, see [Pricing](/pricing). For how to reach us, see [Support](/support).",
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
    fields: [text("title", "Title"), area("lead", "Lead"), area("intro", "Intro")],
    defaults: {
      title: "EMDR knowledge clips",
      lead: "Tap a question. A different clip answers.",
      intro: `Short clips about sessions, sets, and staying safe in ${BRAND_SPOKEN}.`,
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
          body: "[FAQ](/faq) — sessions, Free sets, trial, privacy\n[Pricing](/pricing) — weekly, monthly, and yearly plans\n[Safety](/safety) — when to stop and get help\n[Limits](/limits) — what the app does not do",
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
];

const BY_ID = new Map(MARKETING_SECTIONS.map((section) => [section.id, section]));

export function getSectionDef(id: string): SectionDef | undefined {
  return BY_ID.get(id);
}

export function isMarketingSectionId(id: string): boolean {
  return BY_ID.has(id);
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
  return raw.replace(/\u0000/g, "").slice(0, max);
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

function normalizeScalar(
  field: ScalarField,
  raw: unknown,
  fallback: string
): string {
  const max = field.kind === "textarea" ? AREA_MAX : TEXT_MAX;
  const textValue = clampText(raw, max, fallback);
  if (field.href) {
    if (!textValue.trim() && !fallback.trim()) return "";
    return safeHref(textValue, fallback.trim() || "/");
  }
  return textValue;
}

function normalizeList(
  field: ListField,
  raw: unknown,
  fallback: SectionItem[]
): SectionItem[] {
  const rows = Array.isArray(raw) ? raw : [];
  if (field.fixed) {
    return fallback.map((def, index) => {
      const incoming = asItem(rows[index]) ?? {};
      const next: SectionItem = {};
      if (typeof def.id === "string") next.id = def.id;
      for (const child of field.fields) {
        next[child.key] = normalizeScalar(child, incoming[child.key], def[child.key] ?? "");
      }
      return next;
    });
  }
  const next: SectionItem[] = [];
  for (const row of rows.slice(0, field.max)) {
    const incoming = asItem(row);
    if (!incoming) continue;
    const item: SectionItem = {};
    let any = false;
    for (const child of field.fields) {
      const value = normalizeScalar(child, incoming[child.key], "");
      item[child.key] = value;
      if (value.trim()) any = true;
    }
    if (any) next.push(item);
  }
  if (next.length === 0) {
    return fallback.map((def) => {
      const item: SectionItem = {};
      if (typeof def.id === "string") item.id = def.id;
      for (const child of field.fields) {
        item[child.key] = normalizeScalar(child, def[child.key], "");
      }
      return item;
    });
  }
  return next;
}

export function normalizeSection(id: string, input: unknown): SectionConfig {
  const def = BY_ID.get(id);
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
    } else {
      out[field.key] = normalizeScalar(
        field,
        source[field.key],
        typeof fallback === "string" ? fallback : ""
      );
    }
  }
  return out;
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
  return Array.isArray(value) ? value : [];
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
