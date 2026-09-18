import { BRAND_SPOKEN } from "@/lib/brand";
import { TRIAL_DAYS } from "@/lib/billing-constants";

export type KnowledgeClip = {
  id: string;
  question: string;
  /**
   * Short answer for FAQ JSON-LD only (not shown under the player).
   * UI is question chips + video — no caption strip.
   */
  answer: string;
  /**
   * Hosted mp4/webm under `public/marketing/knowledge/`.
   * Temporary stock placeholders until real answer clips are recorded.
   */
  videoSrc?: string;
  poster: string;
};

export type KnowledgeSeries = {
  id: string;
  title: string;
  role: string;
  clips: readonly KnowledgeClip[];
};

const IMG = {
  practice: "/marketing/landing/practice-space.jpg",
  support: "/marketing/landing/support-talk.jpg",
  calm: "/marketing/landing/calm-rest.jpg",
  reading: "/marketing/landing/reading.jpg",
  evening: "/marketing/landing/evening-light.jpg",
  window: "/marketing/landing/soft-window.jpg",
  hands: "/marketing/landing/quiet-hands.jpg",
  together: "/marketing/landing/together.jpg",
  landscape: "/marketing/landing/green-landscape.jpg",
} as const;

/** Temporary stock until real per-question clips land. */
const STOCK = {
  a: "/marketing/knowledge/stock-a.mp4",
  b: "/marketing/knowledge/stock-b.mp4",
  c: "/marketing/knowledge/stock-c.mp4",
  d: "/marketing/knowledge/stock-d.mp4",
  e: "/marketing/knowledge/stock-e.mp4",
  f: "/marketing/knowledge/stock-f.mp4",
  g: "/marketing/knowledge/stock-g.mp4",
  h: "/marketing/knowledge/stock-h.mp4",
  i: "/marketing/knowledge/stock-i.mp4",
  j: "/marketing/knowledge/stock-j.mp4",
  k: "/marketing/knowledge/stock-k.mp4",
  l: "/marketing/knowledge/stock-l.mp4",
  m: "/marketing/knowledge/stock-m.mp4",
} as const;

export const KNOWLEDGE_HERO = {
  poster: IMG.support,
  /** Single ambient clip — play to start, loops until pause. */
  videoSrc: "/marketing/knowledge/hero.mp4",
  title: "EMDR knowledge clips",
  lead: "Tap a question. A different clip answers.",
} as const;

export const KNOWLEDGE_INTRO = `Short clips about sessions, sets, and staying safe in ${BRAND_SPOKEN}.`;

export const KNOWLEDGE_SERIES: readonly KnowledgeSeries[] = [
  {
    id: "sessions",
    title: "Sessions",
    role: `How practice works\nin ${BRAND_SPOKEN}`,
    clips: [
      {
        id: "guided",
        question: "What is an AI agent-guided session?",
        answer: "A session agent walks phases and check-ins with you.",
        poster: IMG.support,
        videoSrc: STOCK.f,
      },
      {
        id: "free",
        question: "What is a Self-guided session?",
        answer: "Sets you run yourself — no agent, no chat.",
        poster: IMG.practice,
        videoSrc: STOCK.m,
      },
      {
        id: "sets",
        question: "What are visual sets?",
        answer: "Left–right rhythm: animation, sound, joystick rumble.",
        poster: IMG.hands,
        videoSrc: STOCK.h,
      },
      {
        id: "not-therapy",
        question: `Is ${BRAND_SPOKEN} a therapist?`,
        answer: "Self-help in the app — not licensed care or crisis help.",
        poster: IMG.calm,
        videoSrc: STOCK.k,
      },
      {
        id: "trial",
        question: "How does the trial work?",
        answer: `${TRIAL_DAYS} days with capped AI agent-guided sessions and self-guided set time.`,
        poster: IMG.evening,
        videoSrc: STOCK.i,
      },
      {
        id: "cancel",
        question: "Can I cancel anytime?",
        answer: "Yes — manage billing in your account portal.",
        poster: IMG.window,
        videoSrc: STOCK.g,
      },
    ],
  },
  {
    id: "safety",
    title: "Safety",
    role: "Before you start\na set",
    clips: [
      {
        id: "therapist",
        question: "Do I need a therapist to use it?",
        answer:
          "No — and stop if complex trauma or crisis needs a clinician.",
        poster: IMG.together,
        videoSrc: STOCK.l,
      },
      {
        id: "worse",
        question: "What if I feel worse?",
        answer: "Stop the set. Ground. Do not run another set today.",
        poster: IMG.landscape,
        videoSrc: STOCK.j,
      },
      {
        id: "privacy",
        question: "Is my data private?",
        answer: "Sessions stay with your account — not used to train models.",
        poster: IMG.window,
        videoSrc: STOCK.c,
      },
      {
        id: "start",
        question: "Where should I start reading?",
        answer: "Learn maps the short guides. Blog holds the full archive.",
        poster: IMG.reading,
        videoSrc: STOCK.e,
      },
    ],
  },
];

export const KNOWLEDGE_MORE_LINKS = [
  { href: "/learn", label: "Learn", dek: "Start-here map" },
  { href: "/blog", label: "Blog", dek: "Full guide archive" },
  { href: "/safety", label: "Safety", dek: "When to stop" },
  { href: "/emdr", label: "EMDR", dek: "How the app works" },
] as const;

export function knowledgeFaqItems(): { q: string; a: string }[] {
  return KNOWLEDGE_SERIES.flatMap((series) =>
    series.clips.map((clip) => ({ q: clip.question, a: clip.answer }))
  );
}
