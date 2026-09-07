'use client';

// Sound for the dice cup, synthesised with the Web Audio API rather than shipped as
// audio files. Two reasons: nothing extra to download, and every hit can be placed
// on the same beats as the picture, straight from BEATS in roll-timing.ts, so the
// clatter cannot drift out of step with the cup.
//
// Three ingredients, all short:
//   rattle  five dice knocking about inside a leather cup — bursts of band-passed
//           noise, plus one low thump per shake as the cup meets the table
//   lift    a soft woody scrape as the cup comes up
//   clacks  the dice landing, staggered exactly like the meshes appearing
//
// Nothing here can start on its own: playRollSound is only ever called from a roll,
// which only ever follows a button press, so the browser's autoplay rules are met.
// Spec: DICE_ANIMATION.md.

import { BEATS, SHAKE_CYCLES } from './roll-timing';

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** One AudioContext for the session, resumed if the browser suspended it. */
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: Ctor | undefined = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Half a second of white noise, generated once and reused for every hit. */
function noiseBuffer(ac: AudioContext) {
  if (noise) return noise;
  const length = Math.floor(ac.sampleRate * 0.5);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  noise = buffer;
  return buffer;
}

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** One dice knock: a band of noise with a sharp attack and a very short tail. */
function knock(ac: AudioContext, out: GainNode, at: number, freq: number, level: number, decay: number) {
  const source = ac.createBufferSource();
  source.buffer = noiseBuffer(ac);
  source.playbackRate.value = rand(0.85, 1.2);
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = 1.6;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  source.connect(band).connect(gain).connect(out);
  source.start(at, rand(0, 0.3), decay + 0.02);
  return source;
}

/** The body of the cup landing back on the table. */
function thump(ac: AudioContext, out: GainNode, at: number, level: number) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, at);
  osc.frequency.exponentialRampToValueAtTime(58, at + 0.09);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.14);
  return osc;
}

/** The cup coming up off the table: a filtered sweep that opens out and fades. */
function scrape(ac: AudioContext, out: GainNode, at: number, seconds: number) {
  const source = ac.createBufferSource();
  source.buffer = noiseBuffer(ac);
  source.loop = true;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(320, at);
  band.frequency.exponentialRampToValueAtTime(1500, at + seconds);
  band.Q.value = 0.9;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.1, at + seconds * 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  source.connect(band).connect(gain).connect(out);
  source.start(at);
  source.stop(at + seconds + 0.05);
  return source;
}

export type SoundHandle = { stop: () => void };

const SILENT: SoundHandle = { stop: () => undefined };

/**
 * Schedule the whole roll in one go, on the same clock as the picture.
 *
 * `startAt` is the point in the animation the caller is starting from, in ms — 0 for
 * a full roll, BEATS.liftFrom for the AI's reveal, which has already had its shake
 * and only lifts. Everything earlier than that is simply not scheduled.
 */
export function playRollSound(startAt = 0): SoundHandle {
  const ac = audio();
  if (!ac) return SILENT;

  const master = ac.createGain();
  master.gain.value = 0.5;
  master.connect(ac.destination);

  const t0 = ac.currentTime + 0.02;
  /** Animation time in ms to audio-clock seconds. */
  const at = (ms: number) => t0 + Math.max(0, ms - startAt) / 1000;
  const skipped = (ms: number) => ms < startAt;

  const sources: { stop: (when?: number) => void }[] = [];

  // Rattle: one burst per shake, each a handful of knocks, getting a touch busier
  // through the middle of the shake the way a real cup does.
  const cycle = BEATS.shakeTo / SHAKE_CYCLES;
  for (let i = 0; i < SHAKE_CYCLES; i += 1) {
    const ms = i * cycle;
    if (skipped(ms)) continue;
    const hits = 3 + (i % 2);
    for (let h = 0; h < hits; h += 1) {
      sources.push(knock(ac, master, at(ms + rand(4, cycle - 12)), rand(1500, 3400), rand(0.1, 0.24), rand(0.03, 0.06)));
    }
    sources.push(thump(ac, master, at(ms + cycle * 0.5), 0.22));
  }

  // Lift, then the dice landing on the same stagger as the meshes.
  if (!skipped(BEATS.liftFrom)) {
    sources.push(scrape(ac, master, at(BEATS.liftFrom), (BEATS.liftTo - BEATS.liftFrom) / 1000));
  }
  for (let i = 0; i < 5; i += 1) {
    const ms = BEATS.liftFrom + 150 + i * 70 + rand(-14, 14);
    if (skipped(ms)) continue;
    sources.push(knock(ac, master, at(ms), rand(900, 2000), rand(0.16, 0.3), rand(0.05, 0.09)));
  }

  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      const now = ac.currentTime;
      // Ramp the master down rather than cutting it, so skipping mid-rattle does not
      // click, then stop the sources that have not finished.
      try {
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0.0001, now + 0.04);
      } catch { /* context already closed */ }
      for (const source of sources) {
        try { source.stop(now + 0.05); } catch { /* already stopped */ }
      }
      window.setTimeout(() => { try { master.disconnect(); } catch { /* gone */ } }, 120);
    },
  };
}
