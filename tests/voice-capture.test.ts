import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extensionForMime,
  initialVadState,
  isIosUserAgent,
  meterLevel,
  pickRecorderMimeType,
  rmsLevel,
  selectVoiceEngine,
  vadStep,
} from "../lib/voice-capture.ts";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

describe("voice engine selection", () => {
  it("iOS Safari uses server STT when available, even though Web Speech exists", () => {
    assert.equal(selectVoiceEngine({ hasSpeechRecognition: true, hasMediaRecorder: true, serverStt: true, userAgent: IPHONE_SAFARI }), "server");
  });
  it("Chrome on iOS (no Web Speech) uses server STT", () => {
    assert.equal(selectVoiceEngine({ hasSpeechRecognition: false, hasMediaRecorder: true, serverStt: true, userAgent: IPHONE_CHROME }), "server");
  });
  it("iPadOS desktop-mode Safari counts as iOS", () => {
    assert.equal(isIosUserAgent(IPAD_DESKTOP, 5), true);
    assert.equal(isIosUserAgent(IPAD_DESKTOP, 0), false);
    assert.equal(selectVoiceEngine({ hasSpeechRecognition: true, hasMediaRecorder: true, serverStt: true, userAgent: IPAD_DESKTOP, maxTouchPoints: 5 }), "server");
  });
  it("iOS falls back to Web Speech when the server cannot transcribe", () => {
    assert.equal(selectVoiceEngine({ hasSpeechRecognition: true, hasMediaRecorder: true, serverStt: false, userAgent: IPHONE_SAFARI }), "browser");
  });
  it("Android and desktop keep the browser engine", () => {
    assert.equal(selectVoiceEngine({ hasSpeechRecognition: true, hasMediaRecorder: true, serverStt: true, userAgent: ANDROID }), "browser");
    assert.equal(selectVoiceEngine({ hasSpeechRecognition: true, hasMediaRecorder: true, serverStt: true, userAgent: DESKTOP }), "browser");
  });
  it("no Web Speech: server if possible, else none", () => {
    assert.equal(selectVoiceEngine({ hasSpeechRecognition: false, hasMediaRecorder: true, serverStt: true, userAgent: DESKTOP }), "server");
    assert.equal(selectVoiceEngine({ hasSpeechRecognition: false, hasMediaRecorder: false, serverStt: true, userAgent: IPHONE_CHROME }), "none");
    assert.equal(selectVoiceEngine({ hasSpeechRecognition: false, hasMediaRecorder: true, serverStt: false, userAgent: IPHONE_CHROME }), "none");
  });
});

describe("recorder mime type", () => {
  const iosSupports = (t: string) => t.startsWith("audio/mp4") || t === "audio/aac";
  const chromeSupports = (t: string) => t.startsWith("audio/webm");
  it("iOS gets audio/mp4 (AAC)", () => {
    assert.equal(pickRecorderMimeType(iosSupports, { ios: true }), "audio/mp4;codecs=mp4a.40.2");
  });
  it("iOS prefers mp4 even if webm is claimed", () => {
    assert.equal(pickRecorderMimeType(() => true, { ios: true }), "audio/mp4;codecs=mp4a.40.2");
  });
  it("Chrome gets webm/opus", () => {
    assert.equal(pickRecorderMimeType(chromeSupports), "audio/webm;codecs=opus");
  });
  it("no isTypeSupported or nothing supported: let the browser choose", () => {
    assert.equal(pickRecorderMimeType(undefined), "");
    assert.equal(pickRecorderMimeType(() => false), "");
    assert.equal(pickRecorderMimeType(() => { throw new Error("x"); }), "");
  });
  it("file extensions match the container", () => {
    assert.equal(extensionForMime("audio/mp4;codecs=mp4a.40.2"), "m4a");
    assert.equal(extensionForMime("audio/webm;codecs=opus"), "webm");
    assert.equal(extensionForMime("audio/aac"), "aac");
    assert.equal(extensionForMime(""), "webm");
  });
});

describe("level + voice activity detection", () => {
  it("rms of silence is 0 and a full-scale square is 1", () => {
    assert.equal(rmsLevel(new Uint8Array(64).fill(128)), 0);
    assert.ok(Math.abs(rmsLevel(Uint8Array.from({ length: 64 }, (_, i) => (i % 2 ? 0 : 256 - 1e-9))) - 1) < 0.01);
    assert.equal(meterLevel(0), 0);
    assert.ok(meterLevel(0.1) > meterLevel(0.01));
  });
  it("starts after attack, ends after release of silence", () => {
    let s = initialVadState();
    let t = 0;
    const events: string[] = [];
    const feed = (rms: number, ms: number) => {
      for (let end = t + ms; t < end; t += 40) {
        const r = vadStep(s, rms, t);
        s = r.state;
        if (r.event) events.push(`${r.event}@${t}`);
      }
    };
    feed(0.004, 1000); // quiet room
    feed(0.12, 600); // speech
    feed(0.004, 2000); // silence
    assert.equal(events.length, 2);
    assert.match(events[0], /^start@/);
    assert.match(events[1], /^end@/);
  });
  it("a short click does not start an utterance", () => {
    let s = initialVadState();
    let started = false;
    for (let t = 0; t < 2000; t += 40) {
      const rms = t >= 1000 && t < 1060 ? 0.2 : 0.004;
      const r = vadStep(s, rms, t);
      s = r.state;
      if (r.event === "start") started = true;
    }
    assert.equal(started, false);
  });
  it("caps one utterance at maxUtteranceMs", () => {
    let s = initialVadState();
    let ended = -1;
    for (let t = 0; t < 40_000; t += 40) {
      const r = vadStep(s, 0.15, t, { ratio: 2.6, minRms: 0.018, attackMs: 120, releaseMs: 1300, maxUtteranceMs: 5000 });
      s = r.state;
      if (r.event === "end" && ended < 0) ended = t;
    }
    assert.ok(ended > 4000 && ended < 6000, String(ended));
  });
});
