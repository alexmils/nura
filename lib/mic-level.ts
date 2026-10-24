/** Mic level helpers for voice UI (RMS + noise gate + smoothing). */

/** 0–1 RMS from AnalyserNode time-domain bytes (128 = silence). */
export function rmsFromTimeDomain(data: Uint8Array): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i]! - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

/** Map raw RMS into a UI-friendly 0–1 with a soft noise gate. */
export function normalizeMicRms(rms: number, gate = 0.02, gain = 4.2): number {
  const gated = Math.max(0, rms - gate);
  return Math.min(1, gated * gain);
}

/** Attack/release smoothing so motion doesn’t flicker. */
export function smoothLevel(
  prev: number,
  next: number,
  attack = 0.42,
  release = 0.14
): number {
  const t = next > prev ? attack : release;
  return prev + (next - prev) * t;
}
