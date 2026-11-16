// Light Gray Mini: the songs, as note data for the chip synth in audio.js.
//
// One step is a sixteenth note; a bar is 16 steps. "e4:8" is E4 for 8 steps,
// "-:4" is a rest, "|" is only a bar line for the reader. A track shorter than
// the song repeats to fill it.
//
// House rules (Anthony's, from the Suno rounds): minor or modal, never happy;
// few voices you can follow; half-time, carried by a slow bass; no drums in
// calm places; a short loop. Calm areas get one steady bass line and a lead of
// long notes. Riffs with rests belong to caves and danger. Busy belongs to
// bosses.

const LEAD = { voice: 'pulse', duty: 0.25, vol: 0.16, attack: 0.012, decay: 0.12, sustain: 0.7, release: 0.09, vibrato: 0.006 };
const SOFT = { voice: 'pulse', duty: 0.125, vol: 0.055, attack: 0.004, decay: 0.16, sustain: 0.25, release: 0.05, gate: 0.6 };
const BASS = { voice: 'tri', vol: 0.3, attack: 0.008, decay: 0.2, sustain: 0.8, release: 0.08 };

export const SONGS = {
  // Room Zero. A minor, 80. A pulse melody alone in a gray room.
  zero: {
    bpm: 80,
    tracks: [
      { ...LEAD, notes: `
        a4:8 c5:4 e5:4 | d5:8 c5:4 b4:4 | a4:8 e4:8 | -:4 e4:4 a4:4 b4:4 |
        c5:8 e5:4 g5:4 | f5:8 e5:4 d5:4 | e5:12 d5:4 | e5:8 -:8` },
      { ...BASS, notes: `
        a2:16 | d3:8 g2:8 | a2:16 | e2:16 |
        c3:16 | f2:8 d3:8 | a2:16 | e2:16` },
    ],
  },

  // Grassy Field. E dorian, 72. Slow, pleasant yet melancholy: land of the
  // wanderers. One steady bass, a lead of long notes, a quiet pluck under it.
  field: {
    bpm: 72,
    tracks: [
      { ...LEAD, duty: 0.5, vol: 0.14, notes: `
        e5:8 b4:8 | c#5:12 b4:4 | g4:8 b4:4 a4:4 | e4:12 -:4 |
        d5:8 b4:8 | a4:8 f#4:4 a4:4 | b4:12 g4:4 | f#4:8 a4:4 b4:4` },
      { ...BASS, notes: `
        e2:8 b2:8 | a2:8 e3:8 | e2:8 b2:8 | a2:8 e3:8 |
        g2:8 d3:8 | d3:8 a2:8 | e2:8 b2:8 | b2:8 a2:8` },
      { ...SOFT, notes: `
        e3:4 g3 b3 g3 | a3 c#4 e4 c#4 | e3 g3 b3 g3 | a3 c#4 e4 c#4 |
        g3 b3 d4 b3 | d3 f#3 a3 f#3 | e3 g3 b3 g3 | b3 d4 a3 c#4` },
    ],
  },

  // Caves under the field. G minor with a chromatic crawl, 104, half-time.
  // One riff with rests, one thin lead that comes and goes.
  cave: {
    bpm: 104,
    tracks: [
      { ...BASS, vol: 0.32, decay: 0.09, sustain: 0.55, gate: 0.8, notes: `
        g2:2 -:2 g2:2 -:1 bb2:1 -:2 a2:2 ab2:2 -:2 |
        g2:2 -:2 g2:2 -:1 bb2:1 -:2 c3:2 c#3:2 d3:2` },
      { ...LEAD, duty: 0.125, vol: 0.11, notes: `
        -:16 | d5:12 c5:4 | bb4:16 | a4:8 -:8 |
        -:16 | g5:12 f5:4 | eb5:8 d5:8 | d5:8 -:8` },
    ],
  },

  // Boss. F phrygian, 128. This one is allowed to be busy, and has drums.
  boss: {
    bpm: 128,
    tracks: [
      { ...BASS, vol: 0.34, decay: 0.05, sustain: 0.5, gate: 0.7, notes: `
        f2:1 f2 -:1 f2:1 gb2 -:1 f2:1 -:1 f2:1 f2 -:1 ab2:1 gb2 -:1 f2:1 -:1` },
      { ...LEAD, duty: 0.25, vol: 0.15, notes: `
        c5:6 db5:2 c5:4 ab4:4 | bb4:6 c5:2 ab4:8 |
        f5:6 gb5:2 f5:4 eb5:4 | db5:4 c5:4 bb4:4 c5:4` },
      { voice: 'noise', vol: 0.2, notes: `
        k:2 h:2 h:2 h:2 s:2 h:2 k:1 h:1 h:2` },
    ],
  },

  // The Forest. F# dorian, 84. A road song: steady bass, a tune you could walk to.
  forest: {
    bpm: 84,
    tracks: [
      { ...LEAD, notes: `
        c#5:8 f#5:8 | d#5:12 c#5:4 | a4:8 c#5:4 b4:4 | g#4:12 -:4 |
        e5:8 c#5:8 | b4:8 d#5:4 b4:4 | c#5:12 a4:4 | g#4:8 b4:4 c#5:4` },
      { ...BASS, notes: `
        f#2:8 c#3:8 | b2:8 f#3:8 | f#2:8 c#3:8 | e2:8 b2:8 |
        a2:8 e3:8 | b2:8 f#3:8 | f#2:8 c#3:8 | c#3:8 e3:8` },
    ],
  },

  // Red Town. C# minor over a drone, 96. A town square, not a happy one.
  town: {
    bpm: 96,
    tracks: [
      { ...LEAD, duty: 0.5, vol: 0.13, notes: `
        c#5:4 e5 g#5 e5 | f#5:4 e5:4 d#5:8 | c#5:4 e5 g#5 b5 | a5:8 g#5:8 |
        f#5:4 a5 g#5 e5 | f#5:4 e5 d#5 b4 | c#5:4 d#5 e5 d#5 | c#5:12 -:4` },
      { ...BASS, notes: 'c#3:8 g#2:8' },
    ],
  },

  // The Blue Ocean. D minor, 76. Island time: a bass that leaves gaps, a chop on the offbeat.
  ocean: {
    bpm: 76,
    tracks: [
      { ...LEAD, duty: 0.5, vol: 0.13, notes: `
        d5:8 f5:8 | g5:12 f5:4 | d5:8 f5:4 d5:4 | e5:12 -:4 |
        a5:8 f5:8 | g5:8 bb5:4 g5:4 | f5:8 d5:8 | e5:8 c#5:8` },
      { ...BASS, gate: 0.8, notes: `
        d2:6 -:2 a2:6 -:2 | g2:6 -:2 d3:6 -:2 | bb2:6 -:2 f2:6 -:2 | a2:6 -:2 e2:6 -:2` },
      { ...SOFT, vol: 0.07, notes: `
        -:2 f4:2 -:2 f4:2 -:2 f4:2 -:2 f4:2 | -:2 g4:2 -:2 g4:2 -:2 g4:2 -:2 g4:2 |
        -:2 f4:2 -:2 f4:2 -:2 f4:2 -:2 f4:2 | -:2 e4:2 -:2 e4:2 -:2 e4:2 -:2 e4:2` },
    ],
  },

  // The Dark Forest. F# minor, 66. Lonely and thin: one bass note a bar.
  dark: {
    bpm: 66,
    tracks: [
      { ...LEAD, duty: 0.125, vol: 0.12, notes: `
        f#4:12 a4:4 | g#4:16 | c#5:8 b4:8 | a4:12 -:4 |
        d5:12 c#5:4 | b4:8 a4:8 | g#4:8 f#4:8 | f#4:8 -:8` },
      { ...BASS, vol: 0.28, notes: `
        f#2:16 | e2:16 | d2:16 | c#2:16 | b1:16 | d2:16 | c#2:16 | f#2:8 c#2:8` },
    ],
  },

  // The Mountains. G# minor, 70. Cold, high, far from home.
  mountain: {
    bpm: 70,
    tracks: [
      { ...LEAD, notes: `
        d#5:8 g#5:8 | f#5:12 e5:4 | d#5:8 b4:8 | c#5:12 -:4 |
        e5:8 g#5:8 | f#5:8 d#5:8 | c#5:8 b4:4 a#4:4 | g#4:16` },
      { ...BASS, notes: `
        g#2:8 d#3:8 | e2:8 b2:8 | b2:8 f#2:8 | c#3:8 g#2:8 |
        e2:8 b2:8 | b2:8 f#2:8 | c#3:8 d#3:8 | g#2:16` },
    ],
  },

  // Camp Hero. Room Zero's tune come back, with company. A minor, 84.
  camp: {
    bpm: 84,
    tracks: [
      { ...LEAD, notes: `
        a4:8 c5:4 e5:4 | d5:8 c5:4 b4:4 | a4:8 e4:8 | -:4 e4:4 a4:4 b4:4 |
        c5:8 e5:4 g5:4 | f5:8 e5:4 d5:4 | e5:12 d5:4 | e5:8 -:8` },
      { ...BASS, notes: `
        a2:8 e3:8 | d3:8 g2:8 | a2:8 e3:8 | e2:8 b2:8 |
        c3:8 g3:8 | f2:8 d3:8 | a2:8 e3:8 | e2:8 e3:8` },
      { ...SOFT, notes: `
        a3:4 c4 e4 c4 | d4 f4 g3 b3 | a3 c4 e4 c4 | e3 g3 b3 g3 |
        c4 e4 g4 e4 | f3 a3 d4 f4 | a3 c4 e4 c4 | e3 g#3 b3 e4` },
    ],
  },

  // The Plane of Rebirth. A minor, 60. Almost nothing.
  rebirth: {
    bpm: 60,
    tracks: [
      { ...LEAD, duty: 0.5, vol: 0.12, notes: `
        e5:16 | c5:12 d5:4 | a4:16 | -:16` },
      { ...BASS, vol: 0.24, notes: `
        a2:16 | f2:16 | d2:16 | e2:16` },
    ],
  },
};
