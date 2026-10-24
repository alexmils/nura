/**
 * Voice mode open / close stress: 50 cycles with mocked AudioContext,
 * getUserMedia, MediaRecorder and timers. Every cycle must return live
 * audio contexts, mic tracks, audio-graph connections, intervals, timers and
 * in-flight uploads to baseline (the "slower and slower after 5-6 opens" bug
 * class). Pure Node, no DOM.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

// ---------------- tracked timers ----------------
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;
const liveTimeouts = new Set<unknown>();
const liveIntervals = new Set<unknown>();

function installTimers() {
  // Short waits (pre-roll, chime cleanup) run at once so 50 cycles stay fast;
  // long guards (10 s mic start) stay real and must be cleared by teardown.
  (globalThis as any).setTimeout = (fn: (...a: unknown[]) => void, ms?: number, ...rest: unknown[]) => {
    const delay = (ms ?? 0) <= 3000 ? 0 : ms;
    const h: any = realSetTimeout(() => {
      liveTimeouts.delete(h);
      fn(...rest);
    }, delay);
    liveTimeouts.add(h);
    return h;
  };
  (globalThis as any).clearTimeout = (h: any) => {
    liveTimeouts.delete(h);
    realClearTimeout(h);
  };
  (globalThis as any).setInterval = (fn: () => void, ms?: number) => {
    const h = realSetInterval(fn, ms);
    liveIntervals.add(h);
    return h;
  };
  (globalThis as any).clearInterval = (h: any) => {
    liveIntervals.delete(h);
    realClearInterval(h);
  };
}
function restoreTimers() {
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClearTimeout;
  globalThis.setInterval = realSetInterval;
  globalThis.clearInterval = realClearInterval;
}

// ---------------- fake Web Audio ----------------
let contextsCreated = 0;
let liveConnections = 0;

class FakeParam {
  value = 0;
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeNode {
  private out = 0;
  connect() {
    this.out += 1;
    liveConnections += 1;
  }
  disconnect() {
    liveConnections -= this.out;
    this.out = 0;
  }
}
class FakeScheduled extends FakeNode {
  onended: (() => void) | null = null;
  start() {}
  stop() {
    queueMicrotask(() => this.onended?.());
  }
}
class FakeBufferSource extends FakeScheduled {
  buffer: unknown = null;
  start() {
    queueMicrotask(() => this.onended?.());
  }
}
class FakeOsc extends FakeScheduled {
  type = "sine";
  frequency = new FakeParam();
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeFilter extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam();
}
class FakeAnalyser extends FakeNode {
  fftSize = 1024;
  getByteTimeDomainData(a: Uint8Array) {
    a.fill(128);
  }
}
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  sampleRate = 48000;
  destination = new FakeNode();
  constructor() {
    contextsCreated += 1;
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  createBuffer(_c: number, len: number) {
    const data = new Float32Array(len);
    return { getChannelData: () => data };
  }
  createBufferSource() {
    return new FakeBufferSource();
  }
  createOscillator() {
    return new FakeOsc();
  }
  createGain() {
    return new FakeGain();
  }
  createBiquadFilter() {
    return new FakeFilter();
  }
  createAnalyser() {
    return new FakeAnalyser();
  }
  createMediaStreamSource() {
    return new FakeNode();
  }
}

// ---------------- fake mic ----------------
let liveTracks = 0;
let gumCalls = 0;
function fakeStream() {
  let stopped = false;
  liveTracks += 1;
  const track = {
    stop() {
      if (!stopped) {
        stopped = true;
        liveTracks -= 1;
      }
    },
    addEventListener() {},
  };
  return { getTracks: () => [track], getAudioTracks: () => [track] };
}
class FakeRecorder {
  static isTypeSupported() {
    return true;
  }
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: unknown = null;
  onstop: unknown = null;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
  }
}

const flush = () => new Promise<void>((r) => realSetTimeout(r, 0));

let startServerSpeech: typeof import("../lib/server-stt.ts").startServerSpeech;
let prepareVoicePlayback: typeof import("../lib/voice-audio.ts").prepareVoicePlayback;
let playVoiceChime: typeof import("../app/components/voice/voice-chime-player.ts").playVoiceChime;
let createSpokenTracker: typeof import("../lib/voice-playback.ts").createSpokenTracker;

before(async () => {
  installTimers();
  const g = globalThis as any;
  g.window = g;
  g.AudioContext = FakeAudioContext;
  g.MediaRecorder = FakeRecorder;
  g.document = { visibilityState: "visible" };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      maxTouchPoints: 5,
      language: "en-US",
      mediaDevices: {
        getUserMedia: async () => {
          gumCalls += 1;
          return fakeStream();
        },
      },
    },
  });
  ({ startServerSpeech } = await import("../lib/server-stt.ts"));
  ({ prepareVoicePlayback } = await import("../lib/voice-audio.ts"));
  ({ playVoiceChime } = await import("../app/components/voice/voice-chime-player.ts"));
  ({ createSpokenTracker } = await import("../lib/voice-playback.ts"));
});

after(() => {
  restoreTimers();
});

describe("voice mode open / close stress (50 cycles)", () => {
  it("mic session: tracks, graph, intervals and timers return to baseline every cycle", async () => {
    const base = { tracks: liveTracks, conns: liveConnections, ints: liveIntervals.size, tos: liveTimeouts.size };
    for (let i = 0; i < 50; i++) {
      const s = startServerSpeech({});
      await flush();
      assert.equal(liveTracks, base.tracks + 1, "one mic track while open, cycle " + i);
      assert.equal(liveIntervals.size, base.ints + 1, "one meter interval while open, cycle " + i);
      s.abort();
      await flush();
      assert.equal(liveTracks, base.tracks, "tracks stopped, cycle " + i);
      assert.equal(liveConnections, base.conns, "graph disconnected, cycle " + i);
      assert.equal(liveIntervals.size, base.ints, "interval cleared, cycle " + i);
      assert.equal(liveTimeouts.size, base.tos, "timers cleared, cycle " + i);
    }
    assert.equal(gumCalls, 50);
    assert.equal(contextsCreated, 1, "one shared AudioContext for all 50 cycles");
  });

  it("closing before the mic resolves still stops the late track", async () => {
    const before = liveTracks;
    for (let i = 0; i < 50; i++) {
      const s = startServerSpeech({});
      s.abort(); // rapid toggle: close while getUserMedia is pending
      await flush();
      assert.equal(liveTracks, before, "late track stopped, cycle " + i);
      assert.equal(liveTimeouts.size, 0, "no start timer left, cycle " + i);
    }
  });

  it("start chime + TTS pre-roll: audio nodes freed every cycle, one context", async () => {
    const conns = liveConnections;
    for (let i = 0; i < 50; i++) {
      playVoiceChime("start", true);
      const ok = await prepareVoicePlayback();
      assert.equal(ok, true);
      playVoiceChime("end", true);
      // Let note onended + delayed chime cleanup run.
      for (let k = 0; k < 5; k++) await flush();
      assert.equal(liveConnections, conns, "chime / pre-roll nodes disconnected, cycle " + i);
      assert.equal(liveTimeouts.size, 0, "no pending timers, cycle " + i);
    }
    assert.equal(contextsCreated, 1);
  });

  it("cancelled pre-roll (barge-in / close) reports false and leaks nothing", async () => {
    const conns = liveConnections;
    for (let i = 0; i < 50; i++) {
      const ok = await prepareVoicePlayback({ isCancelled: () => true });
      assert.equal(ok, false);
      await flush();
      assert.equal(liveConnections, conns);
    }
  });

  it("spoken-line tracker stays bounded and never replays across 50 opens", () => {
    const t = createSpokenTracker();
    for (let i = 0; i < 50; i++) {
      t.baseline("shown-" + i); // open: line on screen
      assert.equal(t.claim("shown-" + i), false);
      assert.equal(t.claim("reply-" + i), true); // new reply in voice
      assert.equal(t.claim("reply-" + i), false);
    }
  });
});
