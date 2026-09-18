import { TRIAL_DAYS } from "@/lib/billing-constants";
import { BRAND_SPOKEN } from "@/lib/brand";

export type LandingFaqItem = {
  q: string;
  a: string;
};

/** Visible homepage FAQ — JSON-LD must use these strings verbatim. */
export const LANDING_FAQ_ITEMS: readonly LandingFaqItem[] = [
  {
    q: `What is ${BRAND_SPOKEN}?`,
    a: `${BRAND_SPOKEN} is a calm self-help workspace for AI agent-guided EMDR practice and self-guided visual sets — structured support in the app, on your schedule. It is not a licensed therapist or emergency care.`,
  },
  {
    q: "What is the difference between AI agent-guided and Self-guided?",
    a: "AI agent-guided sessions use a session agent through protocol phases and check-ins. Self-guided is sets you run yourself: animation, sound, and joystick rumble, with no agent and no chat.",
  },
  {
    q: "Do I need a therapist to use it?",
    a: `No. ${BRAND_SPOKEN} is built for practice between sessions or on your own. If you are in crisis, contact local emergency services — the app does not replace professional care.`,
  },
  {
    q: "How does the trial work?",
    a: `New accounts get a ${TRIAL_DAYS}-day trial with a limited number of AI agent-guided sessions and self-guided set time. Paid plans unlock the full app with no trial caps.`,
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Manage or cancel billing in the customer portal from your account — no phone calls required.",
  },
];
