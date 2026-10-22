import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reviewStars } from "../lib/email/review-stars";
import { renderEmailTemplate } from "../lib/email/templates";
import { parseFeedbackSubmitSource } from "../lib/feedback-eligibility";

const URL = "https://nurahelp.com/app/feedback?source=review&x=1";

describe("review stars block", () => {
  it("renders five rows of five stars, all pointing at the form", () => {
    const { html } = reviewStars(URL);
    assert.equal((html.match(/<tr>/g) ?? []).length, 5);
    assert.equal((html.match(/<td /g) ?? []).length, 25);
    assert.equal((html.match(/href=/g) ?? []).length, 25);
    // The query string is HTML-escaped once, not twice.
    assert.match(html, /source=review&amp;x=1/);
    assert.doesNotMatch(html, /&amp;amp;/);
  });

  it("gives the text part one link per row", () => {
    const { text } = reviewStars(URL);
    const lines = text.split("\n");
    assert.equal(lines.length, 5);
    assert.match(lines[0]!, /^5 stars:/);
    assert.match(lines[4]!, /^1 star:/);
  });
});

describe("review request email", () => {
  it("puts the stars and the form link in the rendered mail", () => {
    const { subject, html, text } = renderEmailTemplate(
      "trial_feedback",
      {
        name: "Ana",
        feedbackUrl: "https://nurahelp.com/app/feedback?source=review",
      },
      "Nura",
      "https://nurahelp.com"
    );

    assert.equal(subject, "How did we do?");
    assert.match(html, /I would love to hear how it felt/);
    assert.equal((html.match(/<td /g) ?? []).length >= 25, true);
    assert.match(html, /Leave a review/);
    assert.match(html, /Hi Ana/);
    assert.match(text, /How did we do\?/);
  });
});

describe("review feedback attribution", () => {
  it("records the email as its own source", () => {
    assert.equal(parseFeedbackSubmitSource("review"), "review_email");
    assert.equal(parseFeedbackSubmitSource("review_email"), "review_email");
  });
});
