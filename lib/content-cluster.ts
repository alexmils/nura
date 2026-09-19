import {
  blogCategoryName,
  normalizeBlogCategorySlug,
  sanitizeBlogCategorySlugs,
} from "@/lib/blog-categories";
import type { LandingBlogPost } from "@/lib/landing-blog";

export const CLUSTER_TOPICS = ["understand", "practice", "safety"] as const;
export type ClusterTopic = (typeof CLUSTER_TOPICS)[number];

export const CLUSTER_TOPIC_LABEL: Record<ClusterTopic, string> = {
  understand: "Understand EMDR",
  practice: "Practice between sessions",
  safety: "Safety",
};

export type ClusterSection = {
  heading: string;
  paragraphs: string[];
};

export type ClusterArticle = {
  slug: string;
  title: string;
  description: string;
  kicker: string;
  dek: string;
  publishedAt: string;
  topic: ClusterTopic;
  /** Clinical blog categories (see `lib/blog-categories.ts`); may be empty. */
  categories: string[];
  featured: boolean;
  coverUrl: string;
  /** Descriptive in-copy link back to the money page. */
  emdrAnchor: string;
  related: string[];
  sections: ClusterSection[];
};

/** Seed shape before the editorial category mapping is applied. */
type ClusterArticleSeed = Omit<ClusterArticle, "categories">;

/** Distinct landing stills so /blog masonry does not read as one repeated crop. */
const COVER = {
  reading: "/marketing/landing/reading.jpg",
  landscape: "/marketing/landing/green-landscape.jpg",
  practice: "/marketing/landing/practice-space.jpg",
  forest: "/marketing/landing/forest-path.jpg",
  water: "/marketing/landing/calm-water.jpg",
  rest: "/marketing/landing/calm-rest.jpg",
  desk: "/marketing/landing/care-desk.jpg",
  evening: "/marketing/landing/evening-light.jpg",
  journal: "/marketing/landing/journal.jpg",
  tea: "/marketing/landing/morning-tea.jpg",
  hands: "/marketing/landing/quiet-hands.jpg",
  window: "/marketing/landing/soft-window.jpg",
  talk: "/marketing/landing/support-talk.jpg",
  together: "/marketing/landing/together.jpg",
  sofa: "/marketing/landing/warm-sofa.jpg",
} as const;

const CLUSTER_ARTICLE_SEEDS: ClusterArticleSeed[] = [
  {
    slug: "what-is-emdr",
    title: "What Is EMDR? How EMDR Therapy Works",
    description:
      "EMDR is an 8-phase therapy for trauma and PTSD that uses bilateral stimulation while you recall a memory. What it is, how it works, and who it is for.",
    kicker: "EMDR",
    dek: "A protocol with phases, a target, and a set. Not a chatbot that talks you through feelings and stops there.",
    publishedAt: "2026-09-02T10:00:00.000Z",
    topic: "understand",
    featured: true,
    coverUrl: COVER.reading,
    emdrAnchor: "how a guided EMDR session is structured in Nura",
    related: [
      "what-is-bilateral-stimulation",
      "emdr-session-structure",
      "visual-sets-and-the-moving-ball",
    ],
    sections: [
      {
        heading: "The short version",
        paragraphs: [
          "EMDR stands for Eye Movement Desensitization and Reprocessing. In a clinic, that usually means you hold a difficult memory or feeling in mind while your eyes (or another sense) move from side to side in short, timed sets.",
          "The method is older than any app. What changed is that some of the left–right part — the set — can run on a screen, on your schedule, without a waiting room.",
        ],
      },
      {
        heading: "What a set actually is",
        paragraphs: [
          "A set is not a lecture. You pick a target (a memory, a body feeling, a belief), then you follow a moving stimulus for a stretch of time, then you pause and notice what is here now.",
          "That pause matters. Processing is not “keep going until it is gone.” It is work, rest, check. If the charge spikes, you ground and stop.",
        ],
      },
      {
        heading: "What Nura is — and is not",
        paragraphs: [
          "Nura is self-help software for practice: intake and grounding in AI agent-guided, a moving ball for visual sets, optional voice, then a check-in. Self-guided is the ball only.",
          "It is not a licensed therapist, not emergency care, and not a diagnosis. If you have a clinician, this is the quiet homework between sessions — not a replacement for them.",
        ],
      },
    ],
  },
  {
    slug: "what-is-bilateral-stimulation",
    title: "What Is Bilateral Stimulation? Eyes, Taps, or Tones",
    description:
      "Bilateral stimulation is alternating left-right input - eye movements, tapping, or audio - used in EMDR to help process distressing memories.",
    kicker: "Visual sets",
    dek: "The clinical phrase is bilateral stimulation. In Nura you see it as a ball that travels, then you stop and notice.",
    publishedAt: "2026-09-03T10:00:00.000Z",
    topic: "understand",
    featured: true,
    coverUrl: COVER.practice,
    emdrAnchor: "visual sets with a moving ball in a Nura session",
    related: [
      "visual-sets-and-the-moving-ball",
      "eye-movements-and-online-emdr",
      "what-is-emdr",
    ],
    sections: [
      {
        heading: "The phrase people search",
        paragraphs: [
          "Bilateral stimulation means a rhythm that alternates left and right. In EMDR that is often eye movements. It can also be taps on the hands, tones in the ears, or a visual target that crosses the field of view.",
          "People type the phrase into a search box because the protocol sounds technical. The lived version is simpler: your attention goes one way, then the other, in a set you can start and stop.",
        ],
      },
      {
        heading: "Talking is not a set",
        paragraphs: [
          "A lot of “AI therapy” products can reflect your words. They cannot move your gaze. If an app says it does EMDR but there is no left–right stimulus, it is a conversation about EMDR — not a set.",
          "Nura’s differentiator is unglamorous on purpose: a ball that travels while you hold a target. AI agent-guided wraps that in intake, grounding, and check-ins. Self-guided is the ball on your terms.",
        ],
      },
      {
        heading: "You stay in control of the stimulus",
        paragraphs: [
          "Speed, repeats, and whether the set is running are yours. Landscape, the ball travels left and right. Portrait, it travels along the long edge so the path still fills the screen.",
          "If the set is too much, you stop. The tool does not get a vote. That is the difference between a protocol aid and a thing that “runs on you.”",
        ],
      },
    ],
  },
  {
    slug: "visual-sets-and-the-moving-ball",
    title: "EMDR Visual Sets — What the Moving Ball Does",
    description:
      "A visual set is a timed run of a moving point your eyes follow. What the ball does during an EMDR set, how speed and repeats change it, and how to run one.",
    kicker: "In the app",
    dek: "Follow the ball. Stop. Notice. Repeat — or don’t.",
    publishedAt: "2026-09-04T10:00:00.000Z",
    topic: "practice",
    featured: true,
    coverUrl: COVER.forest,
    emdrAnchor: "what a visual set looks like in the Nura app",
    related: [
      "what-is-bilateral-stimulation",
      "what-happens-in-an-emdr-set",
      "guided-vs-free-mode",
    ],
    sections: [
      {
        heading: "What you are looking at",
        paragraphs: [
          "The canvas is quiet. A ball travels. You keep it in view while a target stays in mind — a memory, a sensation, a sentence you believe about yourself.",
          "When the set ends, the ball stops. You are not asked to perform insight on a timer. You notice what shifted, or what did not.",
        ],
      },
      {
        heading: "Why this is the cluster’s spine",
        paragraphs: [
          "Competitors can write about EMDR. Some say out loud that their AI cannot do the left–right work. Nura’s product is built around that work: visual sets in Guided and Free.",
          "If you only need the ball, use Free. If you want phases and a guide that waits for grounding, use Guided. Same stimulus, different wrapper.",
        ],
      },
      {
        heading: "When not to run a set",
        paragraphs: [
          "If you cannot stay in the room — dissociating, panic climbing, a plan to harm — you do not start the ball. You ground, you stop, you get human help.",
          "The app will still be there later. A set is optional. Safety is not.",
        ],
      },
    ],
  },
  {
    slug: "emdr-vs-cbt",
    title: "EMDR vs CBT — Differences and Which Fits You",
    description:
      "EMDR and CBT are both recommended trauma therapies. How they differ in mechanism, session structure, evidence, and what each is best at.",
    kicker: "Compare",
    dek: "One asks what you believe and tests it. The other asks you to follow a stimulus while a memory is up.",
    publishedAt: "2026-09-05T10:00:00.000Z",
    topic: "understand",
    featured: false,
    coverUrl: COVER.water,
    emdrAnchor: "how Nura runs EMDR-style visual sets, not CBT worksheets",
    related: ["what-is-emdr", "emdr-for-anxiety", "self-help-emdr-vs-a-therapist"],
    sections: [
      {
        heading: "Different levers",
        paragraphs: [
          "CBT (cognitive behavioural therapy) usually works in language: catch a thought, test it, try a behaviour, see what happens. Homework looks like records and experiments.",
          "EMDR’s distinctive piece is the set — attention moving while a target is active — then a check. You can do both in a full course of care. They are not the same hour of work.",
        ],
      },
      {
        heading: "What an app can honestly offer",
        paragraphs: [
          "Nura does not grade your thoughts. It gives you a place to run visual sets with a moving ball, with or without a guided protocol around them.",
          "If you need CBT skills, that is a different product — and often a different clinician. Do not expect this workspace to be a thought record with a nicer font.",
        ],
      },
      {
        heading: "Choosing without a branding war",
        paragraphs: [
          "Search results love “EMDR vs CBT: which is better?” Better at what, for whom, with which therapist? Those answers do not live in a marketing page.",
          "What we can say: if you specifically want left–right visual sets between sessions, that is the job this app is built for. Self-help, not a licensed course of either therapy.",
        ],
      },
    ],
  },
  {
    slug: "emdr-between-sessions",
    title: "EMDR Between Sessions — What to Do and Avoid",
    description:
      "What to do between EMDR sessions: grounding, gentle practice, journaling, and when to stop. How to keep processing without overwhelming yourself.",
    kicker: "Practice",
    dek: "The hour with a person is the hour with a person. This is the Tuesday night in between.",
    publishedAt: "2026-09-06T10:00:00.000Z",
    topic: "practice",
    featured: true,
    coverUrl: COVER.rest,
    emdrAnchor: "a Nura session you can run between therapy appointments",
    related: [
      "can-you-do-emdr-alone",
      "self-help-emdr-vs-a-therapist",
      "emdr-session-structure",
    ],
    sections: [
      {
        heading: "Why people look this up",
        paragraphs: [
          "Weekly therapy is expensive and slow to book. The memory does not wait for Thursday. People want something they can start without explaining their week to a new stranger.",
          "“Between sessions” is the honest use: you already have care, or you are waiting, and you want a structured set — not a doomscroll.",
        ],
      },
      {
        heading: "What to run, what to save for the room",
        paragraphs: [
          "Good between-session work is bounded: grounding you already know, a target you have named before, a short set, a check-in, stop. Save brand-new trauma history for a human who can stay with you.",
          "AI agent-guided in Nura still starts with intake and grounding before the ball. That is on purpose. Self-guided skips the talk if you already know the drill.",
        ],
      },
      {
        heading: "Tell your clinician, if you have one",
        paragraphs: [
          "If you use an app for sets, say so. They may have an opinion about targets, length, or whether this week is a processing week at all.",
          "Nura will not coordinate with them. You are the bridge. That is a feature of self-help, and a limit.",
        ],
      },
    ],
  },
  {
    slug: "can-you-do-emdr-alone",
    title: "Can You Do EMDR Alone? What Self-Guided EMDR Can Do",
    description:
      "You can run bilateral stimulation on your own, but EMDR is more than the eye movements. What is safe to do alone, and when you need a trained therapist.",
    kicker: "Solo",
    dek: "Alone as in: you start the ball. Not alone as in: the protocol has no edges.",
    publishedAt: "2026-09-07T10:00:00.000Z",
    topic: "practice",
    featured: false,
    coverUrl: COVER.desk,
    emdrAnchor: "how to run a Free or Guided set on your own in Nura",
    related: [
      "emdr-between-sessions",
      "when-to-pause-or-stop",
      "self-help-emdr-vs-a-therapist",
    ],
    sections: [
      {
        heading: "Two meanings of “alone”",
        paragraphs: [
          "If you mean “without a therapist in the chair,” yes — people practice sets that way. If you mean “the same as eight phases with a trained EMDR clinician,” no. An app cannot hold you if you drop.",
          "Nura is built for the first meaning: a moving ball, optional voice, a protocol you can follow in AI agent-guided. You are still the adult in the room.",
        ],
      },
      {
        heading: "Who should not start solo",
        paragraphs: [
          "If you are in crisis, actively unsafe, or you leave your body as soon as a memory comes up, this is not your tool today. Get in-person or emergency help.",
          "If you have a clinician who said “not this week,” listen to them. The ball does not overrule a treatment plan.",
        ],
      },
      {
        heading: "A sober solo session",
        paragraphs: [
          "Pick a time you will not be interrupted. Ground first. Choose a target you can stop thinking about afterward. Run a short set. Check. Stop while you still can.",
          "That is the whole trick. Heroic three-hour processing in an empty apartment is how people scare themselves off the method.",
        ],
      },
    ],
  },
  {
    slug: "how-long-does-emdr-take",
    title: "How Long Does EMDR Take? Sessions and Timeline",
    description:
      "EMDR is usually 6-12 sessions for a single trauma, but it varies. How long a session lasts, how many you may need, and what changes the timeline.",
    kicker: "Time",
    dek: "Sets are short. Healing is not a countdown in the title bar.",
    publishedAt: "2026-09-08T10:00:00.000Z",
    topic: "understand",
    featured: false,
    coverUrl: COVER.evening,
    emdrAnchor: "how long a Nura set runs — and how you stop it",
    related: ["what-happens-in-an-emdr-set", "emdr-session-structure", "emdr-check-ins-after-sets"],
    sections: [
      {
        heading: "A set versus a course",
        paragraphs: [
          "One visual set might be a minute or a few. A clinical course of EMDR is often weeks or months, because targets stack, life interrupts, and the nervous system is not a download bar.",
          "Marketing that says “fix trauma in one session” is selling a movie. Real work is boringly repeated.",
        ],
      },
      {
        heading: "What you control in the app",
        paragraphs: [
          "In Nura you set speed and how many times the ball repeats. You can stop mid-set. AI agent-guided still wants grounding before the first one.",
          "Do not chase a feeling of “done” by stacking sets until you are wrung out. Stop on a slightly better or even place, then leave the room.",
        ],
      },
      {
        heading: "When it feels like nothing is happening",
        paragraphs: [
          "Sometimes a set is quiet. That is allowed. Notice, check, maybe try another target later — or not tonight.",
          "If weeks of practice leave you worse and more raw, that is data. Pause the app and talk to a person. Self-help is allowed to fail.",
        ],
      },
    ],
  },
  {
    slug: "emdr-for-anxiety",
    title: "EMDR for Anxiety — How It Works and What to Expect",
    description:
      "EMDR was built for trauma but is increasingly used for anxiety and panic. What the evidence shows, how a session differs, and realistic expectations.",
    kicker: "Anxiety",
    dek: "Charge in the body is real. A ball is not a diagnosis.",
    publishedAt: "2026-09-09T10:00:00.000Z",
    topic: "understand",
    featured: false,
    coverUrl: COVER.journal,
    emdrAnchor: "using visual sets in Nura when anxiety is the target",
    related: ["emdr-for-ptsd", "grounding-before-a-set", "when-to-pause-or-stop"],
    sections: [
      {
        heading: "Why the search exists",
        paragraphs: [
          "Anxiety is a wide word: a tight chest before email, a panic spike, a memory that will not file itself. Clinicians sometimes use EMDR when a specific event or image is feeding the charge.",
          "An app that says “we treat anxiety” is making a medical claim this product does not make. Nura is for practice with a moving ball, not a disorder label.",
        ],
      },
      {
        heading: "If you still want a set",
        paragraphs: [
          "Pick a concrete target (a scene, a sentence, a place in the body), ground, run a short visual set, check. If the wave is panic — not “a bit activated” — stop and come back to the room.",
          "AI agent-guided is slower on purpose. Self-guided is faster to the ball. Neither is a panic button.",
        ],
      },
      {
        heading: "When to get a person",
        paragraphs: [
          "If anxiety is running your week, a licensed clinician can assess what is going on. Medication, CBT, and EMDR in clinic are all outside this page.",
          "Use Nura as a quiet extra, or not at all. The honest limit is the point.",
        ],
      },
    ],
  },
  {
    slug: "emdr-for-ptsd",
    title: "EMDR for PTSD — Evidence, Sessions, What to Expect",
    description:
      "EMDR is recommended for PTSD by the WHO, APA, and NICE. What the evidence shows, how many sessions it takes, and what happens in treatment.",
    kicker: "PTSD",
    dek: "Guidelines talk about clinicians. This page will not pretend to be one.",
    publishedAt: "2026-09-10T10:00:00.000Z",
    topic: "understand",
    featured: false,
    coverUrl: COVER.tea,
    emdrAnchor: "what Nura offers instead of a PTSD treatment claim",
    related: ["emdr-for-anxiety", "self-help-emdr-vs-a-therapist", "when-to-pause-or-stop"],
    sections: [
      {
        heading: "What is true in the literature",
        paragraphs: [
          "In clinical settings, EMDR is one of the approaches studied for post-traumatic stress. That work is done with trained people, assessment, and time — not a landing page.",
          "We are not going to paste a fake citation or imply Nura is that course of care. If you need trauma treatment, you need a human who can carry the risk.",
        ],
      },
      {
        heading: "What the product is",
        paragraphs: [
          "Nura gives you visual sets (a moving ball), Guided phases including intake and grounding, and Self-guided. It is for people who want structured practice, including between sessions.",
          "It does not diagnose PTSD. It does not certify that a memory is “processed.” It does not replace VA, NHS, or private trauma care.",
        ],
      },
      {
        heading: "If trauma is loud tonight",
        paragraphs: [
          "Skip the set. Ground. Use local emergency services if you are unsafe. Come back to reading when your window is wider.",
          "Curiosity about EMDR can wait. Your body cannot always wait. Choose the body.",
        ],
      },
    ],
  },
  {
    slug: "emdr-online-what-to-expect",
    title: "Online EMDR Therapy — What to Expect in a Session",
    description:
      "Online EMDR uses a moving dot on screen instead of a therapist's hand. What a remote session looks like, what you need, and how it compares to in person.",
    kicker: "Online",
    dek: "Headphones optional. A quiet room is not.",
    publishedAt: "2026-09-11T10:00:00.000Z",
    topic: "practice",
    featured: false,
    coverUrl: COVER.hands,
    emdrAnchor: "what an online Nura EMDR session actually contains",
    related: ["emdr-session-structure", "eye-movements-and-online-emdr", "guided-vs-free-mode"],
    sections: [
      {
        heading: "The tab is the room",
        paragraphs: [
          "You open the app, pick Guided or Free, and the set happens on your screen. There is no other person watching your face. That is the appeal and the risk.",
          "Close extra tabs. Tell anyone in the house you need twenty minutes. A notification in the middle of a set is a cheap way to spike.",
        ],
      },
      {
        heading: "What “online” does not mean",
        paragraphs: [
          "It does not mean a video visit with an EMDR-certified clinician. Nura does not match you to a therapist. The product is the workspace.",
          "If you want a licensed person on a call, that is a different search. This one is for visual sets you run yourself.",
        ],
      },
      {
        heading: "After you close the laptop",
        paragraphs: [
          "Drink water. Look at something far away. Do not immediately argue in a group chat. Sets can leave a residue; give it a corridor of quiet.",
          "If you feel worse in a way that does not settle, stop using the app and get human care. Online is a format, not a guarantee.",
        ],
      },
    ],
  },
  {
    slug: "guided-vs-free-mode",
    title: "AI agent-guided vs Self-guided — two ways to run a set",
    description:
      "Nura has two session types: AI agent-guided, which walks you through phases and check-ins, and Self-guided, where you run visual sets yourself. How to choose.",
    kicker: "Modes",
    dek: "One walks you. One gets out of the way.",
    publishedAt: "2026-09-12T10:00:00.000Z",
    topic: "practice",
    featured: false,
    coverUrl: COVER.window,
    emdrAnchor: "AI agent-guided and Self-guided modes in a Nura EMDR session",
    related: ["emdr-session-structure", "visual-sets-and-the-moving-ball", "emdr-check-ins-after-sets"],
    sections: [
      {
        heading: "AI agent-guided",
        paragraphs: [
          "You start a session and choose AI agent-guided. A guide walks intake (history and safety), then grounding, then processing with the ball, then a check-in. Voice is optional.",
          "The ball does not start until the phase allows it. That is slower than tapping “go,” and that is the point.",
        ],
      },
      {
        heading: "Self-guided",
        paragraphs: [
          "Self-guided is the visual set, your speed, your repeats, no chat overlay. You already know the drill, or you only want the stimulus.",
          "You are still responsible for grounding and stopping. The mode name is “Self-guided,” not “unpaid.”",
        ],
      },
      {
        heading: "Picking without overthinking",
        paragraphs: [
          "New to sets? AI agent-guided. Know your target and want quiet? Self-guided. You can choose again next time — the product does not lock a personality onto you.",
          "Neither mode is a licensed course of EMDR. Both are practice tools around the same visual set.",
        ],
      },
    ],
  },
  {
    slug: "grounding-before-a-set",
    title: "Grounding Before an EMDR Set — Techniques That Work",
    description:
      "Grounding settles your nervous system before bilateral stimulation. Simple techniques to use before a set, and how to tell when you are ready to begin.",
    kicker: "Safety",
    dek: "Arrive in the room before you ask the room to hold a memory.",
    publishedAt: "2026-09-12T11:00:00.000Z",
    topic: "safety",
    featured: false,
    coverUrl: COVER.talk,
    emdrAnchor: "grounding, then visual sets, in a Nura session",
    related: ["when-to-pause-or-stop", "what-happens-in-an-emdr-set", "can-you-do-emdr-alone"],
    sections: [
      {
        heading: "Why first",
        paragraphs: [
          "A set without a way back is how people get stuck in the memory. Grounding is the return ticket you buy before the train leaves.",
          "It is not a personality test. It is thirty seconds of “I am here, this is the chair, that is the window.”",
        ],
      },
      {
        heading: "Three small ones",
        paragraphs: [
          "Feet and seat: press into the floor. Name five things you can see. Or a safe-place image you can actually picture — not a fantasy that collapses.",
          "If none of that lands, you do not start the ball. You have information: today is a no.",
        ],
      },
      {
        heading: "In Nura",
        paragraphs: [
          "AI agent-guided keeps grounding before processing. Self-guided will let you skip it. Skipping is a choice, not a flex.",
          "You can stop a running set the same way you stop anything else in the app: you mean to stop, and the ball stops.",
        ],
      },
    ],
  },
  {
    slug: "when-to-pause-or-stop",
    title: "When to Pause or Stop an EMDR Session — Warning Signs",
    description:
      "Knowing when to stop is a skill. Signs a set is too much, how to pause safely mid-session, and when to stop practicing and talk to a clinician.",
    kicker: "Safety",
    dek: "The grown-up skill is ending the set while you still can.",
    publishedAt: "2026-09-12T12:00:00.000Z",
    topic: "safety",
    featured: false,
    coverUrl: COVER.together,
    emdrAnchor: "stopping a visual set in Nura when you need to",
    related: ["grounding-before-a-set", "can-you-do-emdr-alone", "emdr-for-ptsd"],
    sections: [
      {
        heading: "Hard stops",
        paragraphs: [
          "You feel unreal or far away. Panic is a wave you cannot ride. You have a plan to hurt yourself or someone else. You are drunk. These are not “push through” moments.",
          "Close the set. Get to a person or emergency services. The article will wait. The app will wait.",
        ],
      },
      {
        heading: "Soft pauses",
        paragraphs: [
          "The target is bigger than you thought. You are late for a call. A child walked in. Pause, ground, decide later whether to continue.",
          "Heroic finishing is how sets become punishments. You do not owe the protocol a complete set.",
        ],
      },
      {
        heading: "After you stop",
        paragraphs: [
          "Look around the room. Name it. Water, food, a boring task. Do not immediately open a second target “to make it worth it.”",
          "If stopping is the only thing you did today, that was the work. Come back to how a session is structured when you have more window.",
        ],
      },
    ],
  },
  {
    slug: "emdr-session-structure",
    title: "EMDR Session Structure — The 8 Phases Explained",
    description:
      "EMDR follows eight phases, from history-taking and preparation through reprocessing to re-evaluation. What happens in each phase of a session.",
    kicker: "Protocol",
    dek: "Order is a kindness. It is not bureaucracy.",
    publishedAt: "2026-09-12T13:00:00.000Z",
    topic: "practice",
    featured: false,
    coverUrl: COVER.sofa,
    emdrAnchor: "the phases of a guided EMDR session in Nura",
    related: ["what-is-emdr", "guided-vs-free-mode", "emdr-check-ins-after-sets"],
    sections: [
      {
        heading: "Guided, in order",
        paragraphs: [
          "Intake: what you are here for, safety, a target if you have one. Grounding: a way back. Then sets with the moving ball. Then a check-in — what is here now, not a performance review.",
          "The guide is software following a protocol. It is not a clinician who can see your face. If the order feels too slow, that is often your window talking, not a bug.",
        ],
      },
      {
        heading: "Free, in order",
        paragraphs: [
          "You decide the order. The product still gives you a ball, speed, and stop. The structure you skip, you must replace with your own.",
          "If you use Free because Guided “asks too much,” notice whether you also skip grounding. That combination is how people get in trouble.",
        ],
      },
      {
        heading: "Closing",
        paragraphs: [
          "Leave a little better or even, not wrecked. A session that ends on a cliffhanger is a session that stole tomorrow.",
          "You can read the same structure on the EMDR page whenever you forget why the ball is not the first tap.",
        ],
      },
    ],
  },
  {
    slug: "self-help-emdr-vs-a-therapist",
    title: "Self-Help EMDR vs a Therapist — Honest Comparison",
    description:
      "Self-guided bilateral stimulation vs working with a trained EMDR therapist: cost, safety, what each does well, and how to combine them sensibly.",
    kicker: "Limits",
    dek: "The app does not know when you are lying on the kitchen floor.",
    publishedAt: "2026-09-12T14:00:00.000Z",
    topic: "understand",
    featured: false,
    coverUrl: COVER.landscape,
    emdrAnchor: "what Nura is, next to a real EMDR clinician",
    related: ["can-you-do-emdr-alone", "emdr-between-sessions", "emdr-for-ptsd"],
    sections: [
      {
        heading: "What a person can do",
        paragraphs: [
          "Assess whether EMDR is even the right method. Catch dissociation you cannot name. Change the target. Sit in the silence after a hard set. Call a plan if you are unsafe.",
          "None of that fits in a browser tab. Nura does not find you a therapist. We will not pretend the lockup is a credential.",
        ],
      },
      {
        heading: "What the app can do",
        paragraphs: [
          "Be there at 11pm. Run a visual set with a moving ball. Offer Guided phases or Free quiet. Cost less than an extra clinical hour. Ask nothing of your calendar except a door you can close.",
          "That is a real gift. It is still self-help software.",
        ],
      },
      {
        heading: "Using them together",
        paragraphs: [
          "Best case: your clinician knows you practice sets here between appointments. Worst case: you hide the app and process a brand-new trauma target at 2am.",
          "Aim for the first. If you have no clinician, stay conservative: short sets, known targets, stop early, get help if the floor drops.",
        ],
      },
    ],
  },
  {
    slug: "eye-movements-and-online-emdr",
    title: "Does Online EMDR Work? Eye Movements on a Screen",
    description:
      "Research on screen-based and remotely delivered EMDR: whether eye movements work over video, what the evidence shows, and what it does not yet cover.",
    kicker: "Stimulus",
    dek: "Your eyes still do the work. The finger is not in the room.",
    publishedAt: "2026-09-12T15:00:00.000Z",
    topic: "understand",
    featured: false,
    coverUrl: COVER.reading,
    emdrAnchor: "the moving ball as the visual set in Nura",
    related: [
      "what-is-bilateral-stimulation",
      "visual-sets-and-the-moving-ball",
      "emdr-online-what-to-expect",
    ],
    sections: [
      {
        heading: "What Shapiro’s chair had",
        paragraphs: [
          "In the original setup, you follow a therapist’s fingers (or a bar, or lights) with your eyes. The movement is the point. The person is there to pace and stop.",
          "On a phone or laptop, there are no fingers. There is a target on glass. If it does not move across your field of view, you are reading about EMDR, not doing a visual set.",
        ],
      },
      {
        heading: "The ball is not a gimmick",
        paragraphs: [
          "Nura’s ball is the stimulus. Follow it. When it stops, you check. Tones and taps exist in the world; this product’s honest offering is visual.",
          "You can still blink. You can look away. That is you stopping the set, which you are allowed to do.",
        ],
      },
      {
        heading: "Online tradeoffs",
        paragraphs: [
          "You lose the clinician’s eyes on your face. You gain a door you can lock and a tool that does not bill per fifty minutes.",
          "Pick the tradeoff on purpose. Do not pretend a ball is a person, or that a person is available at 1am.",
        ],
      },
    ],
  },
  {
    slug: "emdr-check-ins-after-sets",
    title: "Check-Ins After an EMDR Set — SUD, VOC, Body Scan",
    description:
      "After each set you check in: what you notice, your SUD and VOC ratings, and what your body feels. Why the check-in is not optional and how to do it.",
    kicker: "After",
    dek: "The set is the sprint. The check-in is whether you still have legs.",
    publishedAt: "2026-09-12T16:00:00.000Z",
    topic: "practice",
    featured: false,
    coverUrl: COVER.practice,
    emdrAnchor: "check-ins after visual sets in Guided Nura sessions",
    related: ["what-happens-in-an-emdr-set", "emdr-session-structure", "when-to-pause-or-stop"],
    sections: [
      {
        heading: "What you are asked",
        paragraphs: [
          "Not “did you like that?” Something closer to: what did you notice, where is the charge, do we go again or ground.",
          "In clinic this might be a SUDs number. In the app, keep it concrete. “Tighter in the throat.” “Flatter.” “I want to stop.” All legal answers.",
        ],
      },
      {
        heading: "Self-guided has no prompt",
        paragraphs: [
          "If you run Free, you must ask yourself the same questions. Skip that and you are just watching a ball, which is a different hobby.",
          "Ten seconds of honesty after the set is cheaper than an hour of being weird at dinner.",
        ],
      },
      {
        heading: "If the answer is “worse”",
        paragraphs: [
          "Ground. Stop. Do not immediately run a longer set to “undo” it. Worse is a stop sign, not a boss fight.",
          "Come back to the structure of a session when you are even again — or take it to a person.",
        ],
      },
    ],
  },
  {
    slug: "what-happens-in-an-emdr-set",
    title: "What Happens in an EMDR Set — Step by Step",
    description:
      "A set is one timed run of bilateral stimulation, usually 20-60 seconds, followed by a pause and a check-in. What happens during a set and after it.",
    kicker: "The set",
    dek: "Target. Follow. Stop. Notice. That is the whole machine.",
    publishedAt: "2026-09-12T17:00:00.000Z",
    topic: "practice",
    featured: false,
    coverUrl: COVER.forest,
    emdrAnchor: "running a visual set with the moving ball in Nura",
    related: [
      "visual-sets-and-the-moving-ball",
      "how-long-does-emdr-take",
      "emdr-check-ins-after-sets",
    ],
    sections: [
      {
        heading: "Before the ball moves",
        paragraphs: [
          "You have a target you can name in a sentence. You have grounded enough to feel the chair. You know how you will stop.",
          "If any of those are missing, you do not have a set. You have a hope. AI agent-guided will stall you at grounding for this reason.",
        ],
      },
      {
        heading: "While it moves",
        paragraphs: [
          "Follow the ball. Let the target be present without narrating a documentary over it. If you drift to your grocery list, that is information — maybe the target was too hot, or you are tired.",
          "You do not have to “do it right.” You have to stay in some contact with now.",
        ],
      },
      {
        heading: "When it stops",
        paragraphs: [
          "Breathe. Look at the room. Notice. Then decide: another set, a different target, or done for today.",
          "That decision is the protocol. The ball is only the metronome. How a full session wraps those metronomes is on the EMDR page.",
        ],
      },
    ],
  },
];

/**
 * Editorial category map for the built-in guides. Slugs come from
 * `lib/blog-categories.ts`; order sets the primary chip on cards.
 */
const SEED_ARTICLE_CATEGORIES: Record<string, string[]> = {
  "what-is-emdr": ["trauma", "ptsd"],
  "what-is-bilateral-stimulation": ["trauma"],
  "visual-sets-and-the-moving-ball": [],
  "emdr-vs-cbt": ["trauma", "anxiety"],
  "emdr-between-sessions": ["trauma"],
  "can-you-do-emdr-alone": [],
  "how-long-does-emdr-take": [],
  "emdr-for-anxiety": ["anxiety", "panic"],
  "emdr-for-ptsd": ["ptsd", "trauma"],
  "emdr-online-what-to-expect": [],
  "guided-vs-free-mode": [],
  "grounding-before-a-set": ["panic", "anxiety"],
  "when-to-pause-or-stop": ["panic"],
  "emdr-session-structure": [],
  "self-help-emdr-vs-a-therapist": [],
  "eye-movements-and-online-emdr": [],
  "emdr-check-ins-after-sets": [],
  "what-happens-in-an-emdr-set": [],
};

/** Built-in corpus. The blog DB seeds from this and falls back to it. */
export const CLUSTER_ARTICLES: ClusterArticle[] = CLUSTER_ARTICLE_SEEDS.map(
  (seed) => ({
    ...seed,
    categories: sanitizeBlogCategorySlugs(
      SEED_ARTICLE_CATEGORIES[seed.slug] ?? []
    ),
  })
);

const BY_SLUG = new Map(CLUSTER_ARTICLES.map((a) => [a.slug, a]));

export type ClusterFaq = { q: string; a: string };

const VAGUE_SECTION =
  /^(the short version|in short|bottom line|next steps?|also|remember|a note|one more)$/i;

function clipAnswer(text: string, max = 400): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function ensureQuestion(heading: string): string {
  const h = heading.trim();
  if (h.endsWith("?")) return h;
  if (/^(what|how|when|why|who|can|does|do|is|are|should)\b/i.test(h)) {
    return `${h}?`;
  }
  return `What about ${h.charAt(0).toLowerCase()}${h.slice(1)}?`;
}

/** Primary FAQ from the SEO title (query-shaped) + meta description. */
function primaryFaqFromTitle(article: ClusterArticle): ClusterFaq {
  const qMatch = article.title.match(/^([^?]+\?)/);
  if (qMatch) {
    return { q: qMatch[1].trim(), a: article.description };
  }
  const stem = article.title.split("—")[0].trim();
  if (/^EMDR for /i.test(stem)) {
    return { q: `What is ${stem}?`, a: article.description };
  }
  if (/^EMDR vs /i.test(stem)) {
    return {
      q: `How do ${stem.replace(/^EMDR vs /i, "EMDR and ")} differ?`,
      a: article.description,
    };
  }
  return {
    q: stem.endsWith("?") ? stem : `${stem}?`,
    a: article.description,
  };
}

/**
 * Visible + schema FAQ for each guide (Google requires matching on-page copy).
 * Builds from the title query + up to two non-vague sections.
 */
export function clusterArticleFaqs(article: ClusterArticle): ClusterFaq[] {
  const out: ClusterFaq[] = [primaryFaqFromTitle(article)];
  for (const section of article.sections) {
    if (out.length >= 4) break;
    if (VAGUE_SECTION.test(section.heading.trim())) continue;
    const body = section.paragraphs.filter(Boolean).join(" ").trim();
    if (body.length < 40) continue;
    out.push({
      q: ensureQuestion(section.heading),
      a: clipAnswer(body),
    });
  }
  return out;
}

export function listClusterArticles(): ClusterArticle[] {
  return [...CLUSTER_ARTICLES].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );
}

export function getClusterArticle(slug: string): ClusterArticle | null {
  return BY_SLUG.get(slug) ?? null;
}

export function clusterArticlesByTopic(): Record<ClusterTopic, ClusterArticle[]> {
  const out: Record<ClusterTopic, ClusterArticle[]> = {
    understand: [],
    practice: [],
    safety: [],
  };
  for (const article of listClusterArticles()) {
    out[article.topic].push(article);
  }
  return out;
}

/**
 * Curated /learn reading order (not the full archive).
 * Keep short — /blog is the chronological dump of every guide.
 */
export const LEARN_READING_ORDER: Record<ClusterTopic, readonly string[]> = {
  understand: [
    "what-is-emdr",
    "what-is-bilateral-stimulation",
    "self-help-emdr-vs-a-therapist",
  ],
  practice: [
    "visual-sets-and-the-moving-ball",
    "emdr-session-structure",
    "emdr-between-sessions",
  ],
  safety: ["grounding-before-a-set", "when-to-pause-or-stop"],
};

export function learnReadingPath(
  topic: ClusterTopic
): ClusterArticle[] {
  return LEARN_READING_ORDER[topic]
    .map((slug) => getClusterArticle(slug))
    .filter((a): a is ClusterArticle => Boolean(a));
}

/** Anchor id for /learn topic sections. */
export function learnTopicHref(topic: ClusterTopic): string {
  return `/learn#${topic}`;
}

export function relatedClusterArticles(article: ClusterArticle): ClusterArticle[] {
  return article.related
    .map((slug) => getClusterArticle(slug))
    .filter((a): a is ClusterArticle => Boolean(a));
}

/** Built-in guides in one clinical category (seed fallback / tests). */
export function clusterArticlesByCategory(slug: string): ClusterArticle[] {
  const wanted = normalizeBlogCategorySlug(slug);
  return listClusterArticles().filter((a) => a.categories.includes(wanted));
}

/** Rough reading time for blog cards (~200 wpm). */
export function estimateClusterReadMinutes(article: ClusterArticle): number {
  const words = article.sections.reduce((sum, section) => {
    const heading = section.heading.split(/\s+/).length;
    const body = section.paragraphs.reduce(
      (n, p) => n + p.split(/\s+/).filter(Boolean).length,
      0
    );
    return sum + heading + body;
  }, article.dek.split(/\s+/).filter(Boolean).length);
  return Math.max(2, Math.min(12, Math.ceil(words / 200)));
}

export function clusterSitemapPaths(): {
  path: string;
  lastModified: Date;
}[] {
  return CLUSTER_ARTICLES.map((article) => ({
    path: `/blog/${article.slug}`,
    lastModified: new Date(article.publishedAt),
  }));
}

export function latestClusterModified(): Date {
  let latest = new Date(0);
  for (const article of CLUSTER_ARTICLES) {
    const d = new Date(article.publishedAt);
    if (d > latest) latest = d;
  }
  return latest;
}

export function clusterToLandingPost(article: ClusterArticle): LandingBlogPost {
  return {
    slug: article.slug,
    title: article.title,
    summary: article.dek,
    kind: article.topic === "safety" ? "safety" : "article",
    tag: article.categories.length
      ? blogCategoryName(article.categories[0]!)
      : CLUSTER_TOPIC_LABEL[article.topic],
    coverUrl: article.coverUrl,
    createdAt: article.publishedAt,
    readMinutes: estimateClusterReadMinutes(article),
  };
}

export function featuredClusterPosts(limit = 3): LandingBlogPost[] {
  const featured = CLUSTER_ARTICLES.filter((a) => a.featured);
  const rest = CLUSTER_ARTICLES.filter((a) => !a.featured);
  return [...featured, ...rest]
    .slice(0, limit)
    .map((article) => clusterToLandingPost(article));
}

export function clusterHasBlsAcronym(): boolean {
  const blob = CLUSTER_ARTICLES.map((a) =>
    [
      a.title,
      a.description,
      a.kicker,
      a.dek,
      a.emdrAnchor,
      ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs]),
    ].join("\n")
  ).join("\n");
  return /\bBLS\b/.test(blob);
}
