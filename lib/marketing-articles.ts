import { BRAND_LIMITS_LINE, BRAND_SPOKEN } from "@/lib/brand";
import { CLINICAL_AUTHORITIES } from "@/lib/clinical-authorities";

/**
 * Default article bodies for the long-form public pages (/safety, /limits,
 * /about/clinical-team, /emdr). Rendered by `RichArticle`:
 *   # / ## / ### headings, "- " list lines, "> " note paragraphs,
 *   **bold**, [label](/path | https://... | mailto: | tel:).
 * Blank lines separate blocks. Defaults reproduce the previous page markup.
 */

const B = BRAND_SPOKEN;

export const SAFETY_ARTICLE = `# Using AI-guided EMDR safely

${B} is a self-help tool for bilateral stimulation. It gives structure to practice you do on your own \u2014 it is not therapy, not a diagnosis, and not emergency care. Bilateral stimulation can stir things up. This page is about noticing when to stop, when to bring in a clinician, and where to turn if you are not safe.

> **If you are in danger right now, do not use the app.** In the US, call or text [988](tel:988) (Suicide & Crisis Lifeline). Anywhere, call your local emergency number (often 112 or 911). ${B} cannot respond to a crisis.

## Stop the session and move to grounding if

- Your disturbance rating is going up rather than down
- You feel detached from your body, or the room feels unreal
- You cannot remember what you were just doing
- Your heart is racing and you cannot settle
- You feel like you are back in the memory rather than looking at it

Stopping is not failing. In a session, let the set end, return to your safe place or a grounding technique, and close out before you leave. If you are mid-set, the \u201cI need help now\u201d button opens crisis resources at any point.

## Contact a professional before using ${B} again if

- Difficult material keeps surfacing outside sessions
- You feel worse rather than better over several days
- You are avoiding things you used to do
- You are using sessions to punish yourself rather than to process

These are signs the work needs a trained clinician holding the room, not a self-help tool. An [EMDR-trained therapist](https://www.emdria.org/find-an-emdr-therapist/) through EMDRIA is a good place to start.

## Get help immediately if

- You have thoughts of harming yourself or someone else
- You feel unable to keep yourself safe
- You are in crisis

In the US, call or text [988](tel:988) (Suicide & Crisis Lifeline). Outside the US, contact your local emergency number or a crisis line in your country \u2014 you can [find a local helpline](https://findahelpline.com/) for your region.

## Who should not use ${B}

Self-directed bilateral stimulation is not appropriate for everyone. Please work with a clinician instead if you are under 18, in an active crisis, or you have a dissociative disorder, complex or developmental trauma, or psychosis. For more on the boundary between what the app can and cannot do, see [how a Nura session works](/emdr) and [what Nura does not do](/limits).

> ${B} is self-help software. It is not a licensed therapist, not a medical device, and it does not diagnose or treat any condition. Read the [Terms](/terms) and [Privacy policy](/privacy) for how the app works and how your data is handled.`;

export const LIMITS_ARTICLE = `# What ${B} does not do

> ${BRAND_LIMITS_LINE}

Most tools list what they can do. This page is the other half \u2014 an honest account of where ${B} stops. If a claim is not on this page, we are not making it.

## It does not diagnose

${B} does not assess, label, or diagnose any condition. It will not tell you whether you have PTSD, anxiety, or a trauma disorder, and it will not screen you into or out of one. Only a qualified clinician can do that.

## It does not treat or cure anything

${B} does not treat, cure, or manage any illness. Bilateral stimulation is a technique you can practise; running it in a structured session is not the same as receiving treatment for a condition. If you need treatment, you need a clinician.

## It does not make clinical judgments

The AI runs the session structure \u2014 it keeps time, prompts grounding, tracks your ratings, and closes the session. It does not decide whether you are ready to process a memory, whether a reaction has crossed from uncomfortable into unsafe, or what to do when something unexpected surfaces. Those are clinical judgments, and a tool cannot make them.

## It does not hold a therapeutic relationship

There is no therapist on the other side. The AI does not know you, remember you as a person across sessions, or form a treatment alliance. It is a guide for a technique, not a relationship.

## It does not provide crisis or emergency care

${B} cannot respond to an emergency. If you are in crisis, having thoughts of harming yourself, or unable to stay safe, contact help now \u2014 in the US, call or text [988](tel:988), or call your local emergency number. The full guide is on [Safety](/safety).

## It is not for everyone

${B} is not appropriate if you are under 18, in an active crisis, or if you have a dissociative disorder, complex or developmental trauma, or psychosis. Self-directed work is not safe for those situations \u2014 please work with a clinician. See [Safety](/safety) for the full list and what to do instead.

## It does not replace a therapist

The most useful thing ${B} does is give structure to practice between sessions \u2014 grounding, containment, and sets you run yourself. That is real value, and it is also the whole of it. For the assessment, the clinical judgment, and the hard parts of processing trauma, you need a person. [How a Nura session works](/emdr) explains exactly where the line sits.

> ${B} is self-help software operated by Receptly LLC. It is not a licensed therapist, not a medical device, and it does not diagnose or treat any condition. Read the [Terms](/terms) and [Privacy policy](/privacy).`;

export const CLINICAL_INTRO_ARTICLE = `# How clinical review works

${B} is self-help software. This page explains how we check intake screening, safety copy, and protocol barriers \u2014 and which external authorities we cite. It is not a claim that the app is therapy or a medical device.

## What we review

- Intake screening and red-flag barriers before sets can run
- Safety copy, crisis language, and consent gate wording
- When Self-guided and AI agent-guided sets stay off

## Authorities we cite

Until a named clinician reviews these materials, we align product barriers and public safety copy against published guidance \u2014 not against an invented byline.

${CLINICAL_AUTHORITIES.map((a) => `- [${a.label}](${a.url}) \u2014 ${a.name}`).join("\n")}`;

export const CLINICAL_ADVISOR_FALLBACK =
  "We do not list a named clinician as author or reviewer until someone has agreed to be named and has reviewed the materials. We will not invent credentials to look trustworthy.";

export const CLINICAL_OUTRO_ARTICLE =
  "Public guides remain product-team explainers \u2014 see [How we write](/editorial). Related: [About](/about), [Safety](/safety), [Terms](/terms).";

export const EMDR_INTRO_ARTICLE = `# AI-guided EMDR therapy online

Nura is a guided self-help tool for bilateral stimulation. You work with a moving ball, optional tones, and a structured session that follows the shape of an EMDR protocol \u2014 intake, grounding, sets, and closure. An AI guides the pacing and checks in between sets.

It is not therapy, it does not diagnose, and it does not replace a trained clinician. What it does is give you a structured, private place to practise the parts of EMDR that happen around the clinical work.

## What AI-guided EMDR actually is

EMDR \u2014 Eye Movement Desensitization and Reprocessing \u2014 is a structured approach built around **bilateral stimulation**: alternating left\u2013right input, usually eye movements, taps, or tones. While you hold a difficult memory or feeling in mind, the stimulation runs. Most people notice the memory becomes less vivid and less charged over a set.

Nura takes that core mechanic and wraps an AI guide around it. The AI does not perform therapy. It runs the session structure:

- It opens with an intake conversation and a short safety screen
- It helps you settle before any set begins
- It paces sets and prompts the check-ins between them
- It watches for signs you are getting overwhelmed and pulls you back to grounding
- It closes every session properly, even if you try to leave mid-set

The distinction matters. In clinical EMDR, a trained therapist holds the room \u2014 they judge whether you are ready to process, when to slow down, and what to do if something surfaces. Nura does not do that. What Nura does is give structure to the practice you do on your own, and refuse to let you skip the parts that keep it safe.

**AI-guided EMDR is not a faster version of therapy.** It is a self-help tool for people who want structure, privacy, and something to do between sessions.

## How a Nura session works, step by step

### 1. Intake and grounding

Every session starts with a conversation, not a set. The AI asks what brings you in, what is present for you right now, and whether anything has changed since last time.

Part of that intake is a **safety screen**. The AI asks directly about prior EMDR or therapy, dissociation or feeling unreal, self-harm or suicidal thoughts, and whether you are currently in crisis or feel unsafe. If any of those come back as a red flag, the session does not advance to processing. You get grounding only, and a clear recommendation to contact a professional.

If screening is clear, you build resources first: a safe place, a container for difficult material, and a grounding technique you can return to. Nothing else happens until those are in place.

### 2. Choosing a target

You and the AI agree on **one** concrete target \u2014 a short phrase or image, not a whole history. Recent, specific, and manageable beats old, vague, and enormous.

You rate how disturbing it feels right now on a 0\u201310 scale. That number is your baseline. Everything after this is measured against it.

### 3. Bilateral stimulation sets

The moving ball starts. You follow it with your eyes while holding the target in mind. The AI runs the set, stays quiet during it, and checks in when it ends.

Between sets you rate the disturbance again. If the number is dropping, you continue. If it is not moving, the AI changes something \u2014 speed, channel, or the target itself. If it is **rising**, the set stops and you go back to grounding. That rule is not negotiable, and the design does not let you override it.

### 4. Check-in and closure

Every session ends with closure, and closure is mandatory. If you try to leave during a set, the app stops you and walks you through a short containment exercise first. If you close the tab mid-set, the next time you open Nura it offers to finish the closure you skipped.

**This is the part most self-help tools get wrong.** Ending mid-processing is how people end up with material surfacing at 2am with nothing to do about it. Nura does not let a session end that way.

You finish with a body scan, a final rating, and a note on what to carry forward.

## Bilateral stimulation: visual, audio, and tactile

Nura offers three channels, and you can switch between them:

**Visual.** A ball moves side to side across the screen. This is the classic EMDR experience and the one most people start with. Size, speed, path, and background are adjustable \u2014 a slower, wider ball is usually easier to follow when you are already activated.

**Audio.** Alternating tones through headphones. Useful if closing your eyes helps you stay with the material, or if you find the visual track distracting. Many people use audio when they are working on something that makes looking at the screen uncomfortable.

**Tactile.** Gentle alternating pulses, for people who regulate better through physical sensation than through sight or sound.

**On speed:** the research on bilateral stimulation points to working-memory load as the active ingredient. Following a moving ball while holding a memory taxes the same cognitive resources the memory needs to stay vivid. Faster is not better \u2014 pick a pace that lets you actually stay with the target. If you are losing the memory, slow down.

There is no single correct channel. Try all three, notice which one lets you stay present, and use that.

## What the AI does \u2014 and what it does not do

This section matters more than any other on this page, so it is worth being blunt.

**The AI does:**

- Run the session structure and keep time
- Prompt grounding, check-ins, and closure
- Track your disturbance ratings across sets and respond to them
- Refuse to start or continue a set when the safety screen flags something
- Offer grounding and containment when you are flooded
- Sit with you between sessions when something surfaces and your therapist is not available

**The AI does not:**

- Diagnose anything, ever
- Assess whether you are clinically ready to process trauma
- Hold a therapeutic relationship or remember you as a person across sessions
- Make clinical judgments about pacing when something unexpected comes up
- Provide emergency care
- Know when a reaction has crossed from uncomfortable into unsafe

**An AI cannot do EMDR reprocessing the way a trained clinician does**, and this app does not claim otherwise. What Nura can do is give you structure, keep you inside the parts you can safely do alone, and stop you when you reach the edge of them.

That boundary is deliberate. It is also the reason this tool exists rather than a claim that it replaces anyone. See the full list of [what Nura does not do](/limits).`;

export const EMDR_COMPARE_ROWS = [
  { label: "Structure", a: "Full session shape, AI-paced", b: "Full 8-phase protocol" },
  { label: "Bilateral stimulation", a: "Visual, audio, tactile", b: "Visual, audio, tactile" },
  { label: "Assessment", a: "Safety screen only", b: "Full history and readiness assessment" },
  { label: "Clinical judgment", a: "None", b: "Trained clinician, in the room" },
  { label: "Handles abreactions", a: "No \u2014 stops and grounds", b: "Yes" },
  { label: "Cost", a: "Subscription", b: "Per session" },
  { label: "Waiting list", a: "None", b: "Often weeks to months" },
  { label: "Complex trauma", a: "Not appropriate", b: "Appropriate with a specialist" },
];

export const EMDR_COMPARE_SUMMARY = `The honest summary: **Nura is a good place to practise and a bad place to do the hard part.** If your material is manageable, recent, and specific, structured self-help practice may be useful. If your history is complex, early, or you lose time when you get distressed, you need a clinician \u2014 and no app, including this one, is a substitute.

Many people use both. A session with your therapist, then structured practice in between so the work keeps moving. That is the use case Nura was built for.`;

export const EMDR_GUIDE_ARTICLE = `## Who this is for (and who it is not for)

**Nura may suit you if:**

- You want structured practice between therapy sessions
- You are working with everyday stress, a specific recent event, or a manageable worry
- You can notice when you are getting overwhelmed and stop
- You have no history of dissociation, complex trauma, or psychosis
- You want privacy and you do not want to wait for an appointment

**Nura is not for you if:**

- You are in an active crisis, or having thoughts of harming yourself
- You have a diagnosed dissociative disorder, or you sometimes lose time
- You have complex or developmental trauma without clinical support
- You are under 18
- You are looking for diagnosis or treatment

If you are in the second list, this tool can make things worse rather than better. Please talk to a clinician first. You can also [find an EMDR-trained therapist](https://www.emdria.org/find-an-emdr-therapist/) through EMDRIA.

## Between sessions: support when your therapist is unavailable

EMDR has a well-known gap: processing does not stop when the appointment ends. Material surfaces on a Tuesday night, and your next session is eleven days away.

Nura is useful here. You can open it, run grounding, use the container exercise to set something aside, or do a short stabilisation session without touching the difficult material at all. No processing, no sets \u2014 just the tools your therapist would want you to have between appointments.

This is the least risky way to use the app, and for a lot of people it is the most valuable.

## Safety: when to stop and when to get help

**Stop the session and move to grounding if:**

- Your disturbance rating is going up rather than down
- You feel detached from your body, or the room feels unreal
- You cannot remember what you were just doing
- Your heart is racing and you cannot settle
- You feel like you are back in the memory rather than looking at it

**Contact a professional before using Nura again if:**

- Difficult material keeps surfacing outside sessions
- You feel worse rather than better over several days
- You are avoiding things you used to do
- You are using sessions to punish yourself rather than to process

> **Get help immediately** if you have thoughts of harming yourself or someone else, feel unable to keep yourself safe, or you are in crisis. In the US, call or text **988** (Suicide & Crisis Lifeline). Outside the US, contact your local emergency number or a crisis line in your country. The full guide is on [Safety](/safety). Nura does not provide emergency care; the in-session **\u201cI need help now\u201d** button opens crisis resources at any point, including mid-set.`;

export const EMDR_PRIVACY_ANSWER =
  "Sessions are encrypted and never used to train AI models. Read the [Privacy Policy](/privacy) for exactly what is stored, where, and for how long.";

export const EMDR_CLOSE_NOTE =
  "Nura is self-help software. It is not a licensed therapist, not a medical device, and it does not diagnose or treat any condition. If you are in crisis, call 988 (US) or your local emergency number.";