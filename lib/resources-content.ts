import type { ResourceItem, ResourceKind } from "@/lib/resources";

export type { ResourceItem, ResourceKind } from "@/lib/resources";

/** Static seed used when the `resources` table is empty. */
export const SEED_RESOURCES: ResourceItem[] = [
  {
    slug: "what-is-emdr",
    kind: "article",
    title: "What is EMDR?",
    summary: "How the moving ball fits AI agent-guided and Self-guided.",
    readMinutes: 3,
    featured: true,
    body: `EMDR (Eye Movement Desensitization and Reprocessing) is a structured approach often used with traumatic or distressing memories. In practice, many people follow a **moving target left and right** — like the ball in Self-guided or AI agent-guided mode — while holding a target memory or sensation in mind.

Nura offers two ways to work:

- **AI agent-guided session** — an AI guide walks through intake, grounding, assessment, and processing phases, with check-ins after each set.
- **Self-guided session** — you control the ball, speed, and timing yourself.

This app is a **self-help tool**, not a replacement for licensed clinical care. If you are in crisis or feel unsafe, pause and use the safety resources in the library or contact local emergency services.`,
  },
  {
    slug: "grounding-before-a-set",
    kind: "article",
    title: "Grounding before a set",
    summary: "Settle before you start a set.",
    readMinutes: 2,
    featured: true,
    body: `Before a processing set, it helps to know you can return to the present. Try one of these for 30–60 seconds:

1. **Feet and seat** — notice pressure on the floor and chair.
2. **Five senses** — name one thing you see, hear, and feel.
3. **Safe place** — recall a calm image or location; stay with it until your breath slows.

In an **AI agent-guided** session, the guide will not start a set until after intake and grounding. In **Self-guided**, pause anytime — you are in control of when the ball runs.`,
  },
  {
    slug: "when-to-pause",
    kind: "article",
    title: "When to pause or stop",
    summary: "When to stop the ball and ground.",
    readMinutes: 2,
    featured: true,
    body: `Stop or pause the moving ball if you notice:

- A sudden spike in distress you cannot tolerate
- Dissociation, numbness, or feeling “not here”
- Physical symptoms that worry you (chest pain, trouble breathing)
- Thoughts of harming yourself or others

**What to do:** stop the set, orient to the room, use grounding, and consider ending the session. Guided mode will invite a check-in — answer honestly.

Nura is not an emergency service. If you might hurt yourself or someone else, contact **988** (US) or your local crisis line immediately.`,
  },
  {
    slug: "guided-vs-free",
    kind: "article",
    title: "AI agent-guided vs Self-guided sessions",
    summary: "Which mode to pick when you open a new chat.",
    readMinutes: 2,
    featured: false,
    body: `**AI agent-guided** is best when you want structure: phase prompts, SUDs/VoC tracking, and check-ins after each set. The AI follows an EMDR-informed protocol (intake → grounding → assessment → processing phases).

**Self-guided** is best when you already know what you are doing and only need the set — no chat overlay, full control of session settings.

You choose once per session; the mode stays locked for that thread. Start a **New chat** to pick again.`,
  },
  {
    slug: "getting-started-video",
    kind: "video",
    title: "Getting started with Nura",
    summary:
      "Walkthrough of starting a session, the ball controls, and adjustments.",
    readMinutes: 2,
    featured: false,
  },
  {
    slug: "safety-and-crisis",
    kind: "safety",
    title: "Safety & crisis resources",
    summary: "When to seek immediate help and where to find support.",
    readMinutes: 1,
    featured: false,
    body: `**If you are in immediate danger** — call emergency services (e.g. **911** in the US) or go to the nearest emergency room.

**US — 988 Suicide & Crisis Lifeline:** call or text **988**, chat at 988lifeline.org

**International:** findahelpline.com

Nura does not monitor sessions in real time and cannot respond to emergencies. Use this app only when you are in a safe environment and able to pause if needed.`,
  },
];

/** @deprecated Prefer DB helpers — kept as seed alias. */
export const RESOURCES = SEED_RESOURCES;

export function getResourceBySlug(slug: string): ResourceItem | undefined {
  return SEED_RESOURCES.find((r) => r.slug === slug);
}

export function getFeaturedResources(limit = 3): ResourceItem[] {
  return SEED_RESOURCES.filter((r) => r.featured && r.kind === "article").slice(
    0,
    limit
  );
}

export function getResourcesByKind(kind: ResourceKind): ResourceItem[] {
  return SEED_RESOURCES.filter((r) => r.kind === kind);
}
