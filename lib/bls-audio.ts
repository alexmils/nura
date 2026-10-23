import type { BlsSoundId } from "@/lib/types";
import { blsSoundOption } from "@/lib/bls-sounds";

/**
 * Stereo clicks for a set. Every timbre is synthesized with Web Audio.
 * No instrument samples.
 */
export class BlsAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private pink: AudioBuffer | null = null;

  resume() {
    this.ensure();
  }

  private ensure() {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** Center (0) for a preview, or hard left/right while a set runs. */
  play(id: BlsSoundId, pan: number) {
    this.ensure();
    if (!this.ctx || !this.master) return;
    this.schedule(id, pan, this.master, this.ctx.currentTime);
  }

  /**
   * A short stoppable preview: `hits` strikes of one sound on one side.
   * Must be called from the tap (resumes the context for iOS). `onEnd`
   * fires once, from the Web Audio ended event or stop(); a timer backs it
   * up in case the context never resumes.
   */
  preview(
    id: BlsSoundId,
    pan: number,
    opts: { hits?: number; gap?: number; onEnd?: () => void } = {}
  ): { stop: () => void } {
    this.ensure();
    const onEnd = opts.onEnd ?? (() => {});
    let done = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let bus: GainNode | null = null;
    let marker: OscillatorNode | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (marker) marker.onended = null;
      try {
        marker?.stop();
      } catch {
        // already stopped
      }
      try {
        bus?.disconnect();
      } catch {
        // already gone
      }
      onEnd();
    };
    if (!this.ctx || !this.master) {
      timer = setTimeout(finish, 0);
      return { stop: finish };
    }
    const ctx = this.ctx;
    const hits = Math.max(1, Math.round(opts.hits ?? 3));
    const gap = Math.max(0.15, opts.gap ?? 0.5);
    bus = ctx.createGain();
    bus.connect(this.master);
    const t0 = ctx.currentTime + 0.02;
    let tail = 0;
    for (let i = 0; i < hits; i += 1) {
      tail = this.schedule(id, pan, bus, t0 + i * gap);
    }
    const total = (hits - 1) * gap + tail + 0.06;
    // Silent marker node: its "ended" event is the end of the preview.
    marker = ctx.createOscillator();
    const silent = ctx.createGain();
    silent.gain.value = 0;
    marker.connect(silent);
    silent.connect(bus);
    marker.onended = finish;
    marker.start(t0);
    marker.stop(t0 + total);
    timer = setTimeout(finish, Math.ceil(total * 1000) + 600);
    return { stop: finish };
  }

  /** Schedule one strike at `t` into `dest`; returns its length in seconds. */
  private schedule(id: BlsSoundId, pan: number, dest: AudioNode, t: number): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const option = blsSoundOption(id);
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(dest);

    if (option.kind === "beep" && option.hz) {
      this.tone(ctx, panner, t, option.hz, 0.09, 0.22, "sine");
      return 0.11;
    }
    if (option.kind === "piano" && option.hz) {
      this.piano(ctx, panner, t, option.hz);
      return 0.44;
    }
    if (option.kind === "pink") {
      this.burst(ctx, panner, t, this.pinkBuffer(ctx), 0.2, "lowpass", 1800);
      return 0.22;
    }
    if (option.kind === "sticks") {
      this.burst(ctx, panner, t, this.noiseBurst(ctx, 0.03), 0.03, "bandpass", 2200);
      this.burst(ctx, panner, t + 0.045, this.noiseBurst(ctx, 0.025), 0.025, "bandpass", 2800);
      return 0.09;
    }
    if (option.kind === "hat") {
      this.burst(ctx, panner, t, this.noiseBurst(ctx, 0.07), 0.07, "highpass", 7000);
      return 0.09;
    }
    this.burst(ctx, panner, t, this.noiseBurst(ctx, 0.045), 0.045, "highpass", 1400);
    return 0.065;
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.pink = null;
  }

  private tone(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    hz: number,
    dur: number,
    peak: number,
    type: OscillatorType
  ) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = hz;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private piano(ctx: AudioContext, dest: AudioNode, t: number, hz: number) {
    const partials = [1, 2, 3, 4.02, 5.07];
    const levels = [0.34, 0.14, 0.07, 0.035, 0.02];
    const dur = 0.42;
    partials.forEach((ratio, index) => {
      this.tone(ctx, dest, t, hz * ratio, dur, levels[index] ?? 0.02, "sine");
    });
  }

  private burst(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    buffer: AudioBuffer,
    dur: number,
    filterType: BiquadFilterType,
    freq: number
  ) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = filterType === "bandpass" ? 0.8 : 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.55, t + Math.min(0.008, dur / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private noiseBurst(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const env = Math.pow(1 - i / length, 2);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    return buffer;
  }

  private pinkBuffer(ctx: AudioContext): AudioBuffer {
    if (this.pink && this.pink.sampleRate === ctx.sampleRate) return this.pink;
    const length = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    this.pink = buffer;
    return buffer;
  }
}
