/** Visible FAQ on `/emdr` — JSON-LD FAQPage must use these strings verbatim. */

export type EmdrFaqItem = {
  q: string;
  a: string;
};

export const EMDR_FAQ_ITEMS: readonly EmdrFaqItem[] = [
  {
    q: "Is AI-guided EMDR as effective as EMDR with a therapist?",
    a: "No, and no honest tool would claim so. The bilateral stimulation component is well studied and appears to work through working-memory load, which does not require a clinician to be present. The assessment, preparation, and clinical judgment around it do. Research into self-administered EMDR is early — a 2020 review in BJPsych Open found only one small primary study, with promising results but significant methodological limits.",
  },
  {
    q: "Can bilateral stimulation work on its own?",
    a: "The lab evidence suggests the core mechanism does not depend on a therapist being in the room. Studies consistently find that holding a negative memory while doing a demanding left-right task reduces its vividness and emotionality. What a therapist adds is knowing whether you should be doing that at all, and what to do when it goes sideways.",
  },
  {
    q: "Do I need a therapist to use Nura?",
    a: "No. But if you have complex trauma, a dissociative disorder, or you are in crisis, you should not use it without one.",
  },
  {
    q: "Is my data private?",
    a: "Sessions are encrypted and never used to train AI models. Read the Privacy Policy for exactly what is stored, where, and for how long.",
  },
  {
    q: "What if I feel worse after a session?",
    a: "Stop, use grounding, and do not run another set. If it persists for more than a day or two, contact a clinician. You can also log it in the app so it is on the record.",
  },
  {
    q: "Does it work on a phone?",
    a: "Yes — the ball, tones, and session flow all run in the browser.",
  },
  {
    q: "How long is a session?",
    a: "Typically 15–30 minutes. You can stop at any point, though the app will always ask you to close out properly first.",
  },
  {
    q: "What is the difference between AI agent-guided and Self-guided?",
    a: "AI agent-guided runs the full session with the AI. Self-guided gives you the set alone — no structure, no prompts — useful if you already have a protocol from your therapist.",
  },
];
