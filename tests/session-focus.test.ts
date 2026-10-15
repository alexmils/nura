import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFocusAggregateQuery, clampFocusDays, FOCUS_LANGUAGE_SQL } from "../lib/session-focus.ts";
import {
  classifyFocus,
  FOCUS_TOPICS,
  focusLanguageKey,
  focusShare,
  POST_TRAUMATIC_SQL,
  redactFocusTopics,
  type FocusTopicCount,
} from "../lib/session-focus-topics.ts";

function topic(partial: Partial<FocusTopicCount> & Pick<FocusTopicCount, "key">): FocusTopicCount {
  return {
    label: partial.key,
    sessions: 1,
    people: 1,
    sharePct: 100,
    search: "",
    blogPath: null,
    aim: "",
    ...partial,
  };
}

describe("session focus", () => {
  it("counts words people use, without treating them as a diagnosis list to quote", () => {
    assert.deepEqual(classifyFocus("I still have PTSD and trauma after the car crash").sort(), [
      "accident",
      "ptsd",
      "trauma",
    ]);
    assert.deepEqual(classifyFocus("I have post-traumatic stress").sort(), ["ptsd", "stress"]);
    assert.deepEqual(classifyFocus("Imam anksioznost i paniku"), ["anxiety", "panic"]);
    assert.deepEqual(classifyFocus("I can't sleep"), ["sleep"]);
    assert.deepEqual(classifyFocus("when I was a child"), ["childhood"]);
    assert.deepEqual(classifyFocus("hello there"), []);
    assert.deepEqual(classifyFocus("hispanic heritage"), []);
    assert.deepEqual(classifyFocus("the app crashed"), []);
    assert.deepEqual(classifyFocus("my partner left"), []);
    assert.deepEqual(classifyFocus("Tengo mucha ansiedad"), ["anxiety"]);
    assert.deepEqual(classifyFocus("我很焦虑"), ["anxiety"]);
    assert.deepEqual(classifyFocus("our relationship ended"), ["relationships"]);
    assert.deepEqual(classifyFocus("in relation to work"), []);
    assert.deepEqual(classifyFocus("sorgfältig geplant"), []);
    assert.deepEqual(classifyFocus("min sorg"), ["grief"]);
    assert.deepEqual(classifyFocus("我们的关系"), []);
    assert.deepEqual(classifyFocus("分手之后"), ["relationships"]);
    assert.deepEqual(classifyFocus("创伤后应激障碍"), ["ptsd"]);
  });

  it("keeps message text out of the aggregate select", () => {
    const query = buildFocusAggregateQuery(90);
    const outer = query.text.split("FROM (")[0] ?? "";
    assert.match(outer, /COUNT\(\*\)::int AS sessions/);
    assert.doesNotMatch(outer, /content/);
    assert.ok(query.text.includes(POST_TRAUMATIC_SQL));
    assert.equal(query.values[0], 90);
    assert.equal(query.values.length, 16);
  });

  it("hides a topic until 3 people used those words", () => {
    const redacted = redactFocusTopics([
      topic({ key: "anxiety", people: 1, sessions: 1 }),
      topic({ key: "trauma", people: 3, sessions: 4, sharePct: 40 }),
    ]);
    assert.equal(redacted.hiddenTopics, 1);
    assert.equal(redacted.topics.find((row) => row.key === "anxiety")?.people, 0);
    assert.equal(redacted.topics.find((row) => row.key === "trauma")?.people, 3);
  });

  it("groups a region tag with its language before the people threshold", () => {
    assert.equal(focusLanguageKey("en-US"), "en");
    assert.equal(focusLanguageKey("en"), "en");
    assert.equal(focusLanguageKey("zh-Hant"), "zh-hant");
    assert.equal(focusLanguageKey("not a language"), "unknown");
    const groupedAt = FOCUS_LANGUAGE_SQL.indexOf("split_part");
    const countedAt = FOCUS_LANGUAGE_SQL.indexOf("COUNT(DISTINCT user_id)");
    assert.ok(groupedAt > countedAt);
    assert.equal(FOCUS_TOPICS.find((topic) => topic.key === "shame")?.blogPath, null);
  });

  it("clamps the window and rounds share", () => {
    assert.equal(clampFocusDays(1), 7);
    assert.equal(clampFocusDays(900), 365);
    assert.equal(focusShare(1, 4), 25);
    assert.equal(focusShare(0, 0), 0);
  });
});
