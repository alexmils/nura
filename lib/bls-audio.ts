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
    const option = blsSoundOption(id);
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(this.master);

    if (option.kind === "beep" && option.hz) {
      this.tone(ctx, panner, t, option.hz, 0.09, 0.22, "sine");
      return;
    }
    if (option.kind === "piano" && option.hz) {
      this.piano(ctx, panner, t, option.hz);
      return;
    }
    if (option.kind === "pink") {
      this.burst(ctx, panner, t, this.pinkBuffer(ctx), 0.2, "lowpass", 1800);
      return;
    }
    if (option.kind === "sticks") {
      this.burst(ctx, panner, t, this.noiseBurst(ctx, 0.03), 0.03, "bandpass", 2200);
      this.burst(ctx, panner, t + 0.045, this.noiseBurst(ctx, 0.025), 0.025, "bandpass", 2800);
      return;
    }
    if (option.kind === "hat") {
      this.burst(ctx, panner, t, this.noiseBurst(ctx, 0.07), 0.07, "highpass", 7000);
      return;
    }
    this.burst(ctx, panner, t, this.noiseBurst(ctx, 0.045), 0.045, "highpass", 1400);
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
