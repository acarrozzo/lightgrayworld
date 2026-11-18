// Light Gray Mini: a four-voice chip synth and the sound effects.
// Voices follow the NES layout: two pulse channels, one stepped triangle, one
// noise channel. Songs are note data (see songs.js); nothing is a sound file.

import { SONGS } from './songs.js';

let ac = null;
let master = null;
let musicBus = null;
let sfxBus = null;
let noiseBuffer = null;
let triShape = null;
const pulseWaves = {};
let muted = false;

const NOTE_INDEX = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** "f#4" -> Hz. Flats are written with a trailing b: "bb3". */
export function noteHz(name) {
  const m = /^([a-g])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note "${name}"`);
  let semi = NOTE_INDEX[m[1]];
  if (m[2] === '#') semi += 1;
  if (m[2] === 'b') semi -= 1;
  const midi = 12 * (Number(m[3]) + 1) + semi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Parse one track: tokens split on spaces, "|" is a bar line for the reader.
 *   e4:8   a note for 8 steps      -:4   a rest for 4 steps
 *   k s h  kick, snare, hat (noise track), each with an optional :length
 * A missing length reuses the previous one.
 * Pure: no audio context needed, so tests can read song lengths.
 */
export function parseTrack(src) {
  const events = [];
  let step = 0;
  let len = 4;
  for (const tok of src.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const [head, lenStr] = tok.split(':');
    if (lenStr !== undefined) {
      len = Number(lenStr);
      if (!(len > 0)) throw new Error(`bad length in "${tok}"`);
    }
    if (head === '-') { step += len; continue; }
    if (head === 'k' || head === 's' || head === 'h') events.push({ step, len, drum: head });
    else events.push({ step, len, hz: noteHz(head) });
    step += len;
  }
  return { events, steps: step };
}

/** The length of a song in steps, and whether every track fits it. */
export function songShape(song) {
  const parsed = song.tracks.map((t) => parseTrack(t.notes));
  const steps = Math.max(...parsed.map((p) => p.steps));
  const misfit = parsed.filter((p) => p.steps > 0 && steps % p.steps !== 0).length;
  return { steps, parsed, misfit };
}

// ------------------------------------------------------------------ set-up

export function audioReady() {
  return !!ac;
}

export function initAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();

  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.9;
  master.connect(ac.destination);

  sfxBus = ac.createGain();
  sfxBus.gain.value = 0.55;
  sfxBus.connect(master);

  // Music goes out dry and through a short dark echo, the cheap-hardware kind.
  musicBus = ac.createGain();
  musicBus.gain.value = 0.42;
  musicBus.connect(master);
  const delay = ac.createDelay(1);
  delay.delayTime.value = 0.23;
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2200;
  const feedback = ac.createGain();
  feedback.gain.value = 0.26;
  const wet = ac.createGain();
  wet.gain.value = 0.2;
  musicBus.connect(delay);
  delay.connect(tone);
  tone.connect(feedback);
  feedback.connect(delay);
  tone.connect(wet);
  wet.connect(master);

  for (const duty of [0.125, 0.25, 0.5]) {
    const n = 40;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (4 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    pulseWaves[duty] = ac.createPeriodicWave(real, imag);
  }

  // A 16-step staircase, so the triangle has the gritty edge of the real chip.
  triShape = new Float32Array(256);
  for (let i = 0; i < 256; i++) triShape[i] = Math.round(((i / 255) * 2 - 1) * 7.5) / 7.5;

  const len = Math.floor(ac.sampleRate * 1.5);
  noiseBuffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let hold = 0;
  for (let i = 0; i < len; i++) {
    if (i % 3 === 0) hold = Math.random() * 2 - 1; // held samples: a duller hiss
    data[i] = hold;
  }
}

export function setMuted(value) {
  muted = !!value;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ac.currentTime, 0.02);
}

export function isMuted() {
  return muted;
}

// ------------------------------------------------------------------ voices

function playTone({ voice = 'pulse', duty = 0.5, hz, hzEnd = null, t, dur, vol = 0.2,
  attack = 0.005, decay = 0.08, sustain = 0.7, release = 0.05, vibrato = 0, out }) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  let head = osc;
  if (voice === 'pulse') {
    osc.setPeriodicWave(pulseWaves[duty] || pulseWaves[0.5]);
  } else if (voice === 'tri') {
    osc.type = 'triangle';
    const shaper = ac.createWaveShaper();
    shaper.curve = triShape;
    osc.connect(shaper);
    head = shaper;
  } else {
    osc.type = voice;
  }
  osc.frequency.setValueAtTime(hz, t);
  if (hzEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, hzEnd), t + dur);

  if (vibrato > 0 && dur > 0.5) {
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.frequency.value = 5.2;
    depth.gain.setValueAtTime(0, t);
    depth.gain.setValueAtTime(0, t + 0.28);
    depth.gain.linearRampToValueAtTime(hz * vibrato, t + 0.5);
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }

  const a = Math.min(attack, dur * 0.3);
  const decayEnd = Math.min(t + a + decay, t + dur * 0.7);
  const releaseStart = Math.max(decayEnd, t + dur - release);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + a);
  gain.gain.linearRampToValueAtTime(vol * sustain, decayEnd);
  gain.gain.setValueAtTime(vol * sustain, releaseStart);
  gain.gain.linearRampToValueAtTime(0, t + dur);

  head.connect(gain);
  gain.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function playNoise({ t, dur, vol = 0.2, rate = 1, filter = 'highpass', cutoff = 1000, out }) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  src.playbackRate.value = rate;
  const f = ac.createBiquadFilter();
  f.type = filter;
  f.frequency.value = cutoff;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(gain);
  gain.connect(out);
  src.start(t, Math.random());
  src.stop(t + dur + 0.02);
}

function playDrum(kind, t, vol, out) {
  if (kind === 'k') {
    playTone({ voice: 'tri', hz: 150, hzEnd: 45, t, dur: 0.14, vol: vol * 1.6, decay: 0.1, sustain: 0.3, out });
  } else if (kind === 's') {
    playNoise({ t, dur: 0.16, vol: vol * 0.9, rate: 0.7, filter: 'bandpass', cutoff: 1700, out });
  } else {
    playNoise({ t, dur: 0.04, vol: vol * 0.45, rate: 1.4, filter: 'highpass', cutoff: 6000, out });
  }
}

// ------------------------------------------------------------------- music

let playing = null; // { name, gain, timer }

export function currentSong() {
  return playing ? playing.name : null;
}

export function stopSong(fade = 0.25) {
  if (!playing) return;
  const old = playing;
  playing = null;
  clearInterval(old.timer);
  if (ac) {
    old.gain.gain.cancelScheduledValues(ac.currentTime);
    old.gain.gain.setTargetAtTime(0, ac.currentTime, fade / 3);
    setTimeout(() => old.gain.disconnect(), (fade + 0.4) * 1000);
  }
}

/** Start a song by name. Asking for the one already playing does nothing. */
export function playSong(name) {
  if (playing && playing.name === name) return;
  stopSong();
  if (!ac || !name) return;
  const song = SONGS[name];
  if (!song) return;

  const { steps, parsed } = songShape(song);
  if (!steps) return;
  const stepDur = 60 / song.bpm / 4;
  const loopDur = steps * stepDur;
  const gain = ac.createGain();
  gain.gain.value = song.gain ?? 1;
  gain.connect(musicBus);

  const start = ac.currentTime + 0.08;
  const tracks = song.tracks.map((def, i) => {
    // A short track repeats to fill the song, so a two-bar bass can sit under
    // an eight-bar tune.
    const p = parsed[i];
    const events = [];
    if (p.steps > 0) {
      for (let off = 0; off + p.steps <= steps; off += p.steps) {
        for (const ev of p.events) events.push({ ...ev, step: ev.step + off });
      }
    }
    return { def, events, idx: 0, loop: 0 };
  });

  const state = { name, gain, timer: 0 };
  const schedule = () => {
    if (playing !== state) return;
    const horizon = ac.currentTime + 0.2;
    for (const tr of tracks) {
      if (!tr.events.length) continue;
      for (;;) {
        const ev = tr.events[tr.idx];
        const t = start + tr.loop * loopDur + ev.step * stepDur;
        if (t > horizon) break;
        if (t >= ac.currentTime - 0.05) {
          const d = tr.def;
          if (ev.drum) {
            playDrum(ev.drum, t, d.vol ?? 0.2, gain);
          } else {
            playTone({
              voice: d.voice, duty: d.duty, hz: ev.hz, t,
              dur: ev.len * stepDur * (d.gate ?? 0.92),
              vol: d.vol ?? 0.15, attack: d.attack, decay: d.decay,
              sustain: d.sustain, release: d.release, vibrato: d.vibrato ?? 0, out: gain,
            });
          }
        }
        tr.idx += 1;
        if (tr.idx >= tr.events.length) { tr.idx = 0; tr.loop += 1; }
      }
    }
  };
  playing = state;
  schedule();
  state.timer = setInterval(schedule, 40);
}

// ----------------------------------------------------------- sound effects

function arp(notes, step, opts = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + 0.005;
  notes.forEach((n, i) => {
    const last = i === notes.length - 1;
    playTone({
      voice: 'pulse', duty: opts.duty ?? 0.25, hz: typeof n === 'number' ? n : noteHz(n),
      t: t0 + i * step, dur: last ? (opts.tail ?? step * 2.5) : step * 1.05,
      vol: opts.vol ?? 0.22, decay: 0.05, sustain: 0.55, release: last ? 0.12 : 0.02, out: sfxBus,
    });
  });
}

export const sfx = {
  swing() {
    if (!ac) return;
    playNoise({ t: ac.currentTime, dur: 0.09, vol: 0.22, rate: 1.8, filter: 'bandpass', cutoff: 3200, out: sfxBus });
  },
  hit() {
    if (!ac) return;
    const t = ac.currentTime;
    playTone({ voice: 'pulse', duty: 0.25, hz: 520, hzEnd: 180, t, dur: 0.09, vol: 0.26, sustain: 0.5, out: sfxBus });
    playNoise({ t, dur: 0.05, vol: 0.2, rate: 1, filter: 'highpass', cutoff: 2000, out: sfxBus });
  },
  block() {
    if (!ac) return;
    playTone({ voice: 'tri', hz: 1500, hzEnd: 1100, t: ac.currentTime, dur: 0.05, vol: 0.3, sustain: 0.4, out: sfxBus });
  },
  hurt() {
    if (!ac) return;
    const t = ac.currentTime;
    playTone({ voice: 'pulse', duty: 0.5, hz: 240, hzEnd: 80, t, dur: 0.2, vol: 0.28, sustain: 0.6, out: sfxBus });
    playNoise({ t, dur: 0.1, vol: 0.18, rate: 0.6, filter: 'lowpass', cutoff: 900, out: sfxBus });
  },
  kill() {
    if (!ac) return;
    const t = ac.currentTime;
    playNoise({ t, dur: 0.24, vol: 0.26, rate: 0.8, filter: 'bandpass', cutoff: 1200, out: sfxBus });
    playTone({ voice: 'pulse', duty: 0.125, hz: 330, hzEnd: 70, t, dur: 0.22, vol: 0.2, sustain: 0.5, out: sfxBus });
  },
  coin() { arp(['b5', 'e6'], 0.06, { duty: 0.125, tail: 0.22, vol: 0.18 }); },
  item() { arp(['e5', 'g5', 'b5', 'e6'], 0.07, { tail: 0.3 }); },
  level() { arp(['e5', 'b5', 'e6', 'g6', 'b6'], 0.085, { duty: 0.5, tail: 0.5, vol: 0.24 }); },
  heal() { arp(['a4', 'c5', 'e5', 'a5'], 0.09, { duty: 0.5, tail: 0.35, vol: 0.18 }); },
  select() { arp(['e5'], 0.04, { duty: 0.125, tail: 0.05, vol: 0.14 }); },
  confirm() { arp(['e5', 'a5'], 0.05, { duty: 0.125, tail: 0.1, vol: 0.16 }); },
  deny() { arp(['e4', 'bb3'], 0.08, { duty: 0.5, tail: 0.14, vol: 0.2 }); },
  text() {
    if (!ac) return;
    playTone({ voice: 'pulse', duty: 0.125, hz: 880, t: ac.currentTime, dur: 0.018, vol: 0.07, sustain: 0.8, out: sfxBus });
  },
  door() {
    if (!ac) return;
    playNoise({ t: ac.currentTime, dur: 0.22, vol: 0.18, rate: 0.35, filter: 'lowpass', cutoff: 700, out: sfxBus });
  },
  cut() {
    if (!ac) return;
    playNoise({ t: ac.currentTime, dur: 0.12, vol: 0.2, rate: 1.2, filter: 'highpass', cutoff: 2600, out: sfxBus });
  },
  cast() { arp(['e5', 'g#5', 'b5'], 0.035, { duty: 0.125, tail: 0.18, vol: 0.18 }); },
  shoot() {
    if (!ac) return;
    playTone({ voice: 'pulse', duty: 0.125, hz: 900, hzEnd: 300, t: ac.currentTime, dur: 0.1, vol: 0.16, sustain: 0.5, out: sfxBus });
  },
  dead() { arp(['e4', 'd4', 'c4', 'b3', 'e3'], 0.16, { duty: 0.5, tail: 0.8, vol: 0.24 }); },
  boss() { arp(['f3', 'gb3', 'f3', 'c3'], 0.12, { duty: 0.5, tail: 0.5, vol: 0.26 }); },
  secret() { arp(['e5', 'f#5', 'a5', 'b5', 'd6', 'e6'], 0.075, { duty: 0.25, tail: 0.4 }); },
  crit() { arp(['b5', 'e6', 'b6', 'e7'], 0.035, { duty: 0.125, tail: 0.22, vol: 0.24 }); },
  fanfare() { arp(['e4', 'e4', 'e4', 'g4', 'b4', 'e5', 'd5', 'e5', 'g5', 'b5', 'e6'], 0.11, { duty: 0.5, tail: 1.1, vol: 0.26 }); },
};
