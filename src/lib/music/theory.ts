// Core music theory: pitch classes, keys, diatonic chords and voicings.

export const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export type Mode = 'major' | 'minor';
export type ChordQuality = 'maj' | 'min' | 'dim' | 'aug' | 'sus2' | 'sus4' | 'maj7' | 'min7' | 'dom7' | 'add9' | 'min9' | 'm7b5';

export interface Chord {
  /** Pitch class of the root, 0 = C */
  root: number;
  quality: ChordQuality;
  /** Roman numeral relative to the song key, e.g. "vi", "bVII", "IVmaj7" */
  roman: string;
  /** Harmonic function, used for substitutions and cadences */
  fn: 'tonic' | 'subdominant' | 'dominant' | 'borrowed';
}

export const KEYS = NOTE_NAMES_SHARP.map((_, i) => i);

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]; // natural minor

export function scaleOf(mode: Mode): number[] {
  return mode === 'major' ? MAJOR_SCALE : MINOR_SCALE;
}

/** Keys that are conventionally spelled with flats */
const FLAT_KEYS_MAJOR = new Set([5, 10, 3, 8, 1, 6]); // F Bb Eb Ab Db Gb
const FLAT_KEYS_MINOR = new Set([2, 7, 0, 5, 10, 3]); // Dm Gm Cm Fm Bbm Ebm

export function useFlats(key: number, mode: Mode): boolean {
  return mode === 'major' ? FLAT_KEYS_MAJOR.has(key) : FLAT_KEYS_MINOR.has(key);
}

export function noteName(pc: number, flats = false): string {
  const i = ((pc % 12) + 12) % 12;
  return flats ? NOTE_NAMES_FLAT[i] : NOTE_NAMES_SHARP[i];
}

export function keyLabel(key: number, mode: Mode): string {
  return `${noteName(key, useFlats(key, mode))} ${mode}`;
}

export const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  add9: [0, 4, 7, 14],
  min9: [0, 3, 7, 10, 14],
  m7b5: [0, 3, 6, 10],
};

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '', min: 'm', dim: '°', aug: '+', sus2: 'sus2', sus4: 'sus4',
  maj7: 'maj7', min7: 'm7', dom7: '7', add9: 'add9', min9: 'm9', m7b5: 'm7♭5',
};

export function chordSymbol(chord: Pick<Chord, 'root' | 'quality'>, flats = false): string {
  return noteName(chord.root, flats) + QUALITY_SUFFIX[chord.quality];
}

/** Pitch classes contained in a chord */
export function chordPitchClasses(chord: Pick<Chord, 'root' | 'quality'>): number[] {
  return QUALITY_INTERVALS[chord.quality].map((i) => (chord.root + i) % 12);
}

/**
 * MIDI notes for a smooth, mid-register voicing.
 * Bass = root in octave 2/3; upper structure is placed around middle C so
 * consecutive chords move by small steps (simple voice-leading).
 */
export function voiceChord(chord: Pick<Chord, 'root' | 'quality'>): { bass: number; upper: number[] } {
  const bass = 36 + chord.root + (chord.root > 7 ? -12 : 0) + 12; // E2..G3 range
  const center = 62; // D4
  const upper = QUALITY_INTERVALS[chord.quality].map((iv) => {
    let n = 48 + chord.root + iv;
    while (n < center - 6) n += 12;
    while (n > center + 7) n -= 12;
    return n;
  });
  return { bass, upper: Array.from(new Set(upper)).sort((a, b) => a - b) };
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function triadQualityFor(mode: Mode, degree: number): ChordQuality {
  const scale = scaleOf(mode);
  const r = scale[degree];
  const third = (scale[(degree + 2) % 7] - r + 12) % 12;
  const fifth = (scale[(degree + 4) % 7] - r + 12) % 12;
  if (third === 4 && fifth === 7) return 'maj';
  if (third === 3 && fifth === 7) return 'min';
  if (third === 3 && fifth === 6) return 'dim';
  return 'aug';
}

function functionFor(mode: Mode, degree: number): Chord['fn'] {
  // degree index 0..6
  if (mode === 'major') return ([0, 2, 5].includes(degree) ? 'tonic' : [1, 3].includes(degree) ? 'subdominant' : 'dominant');
  return ([0, 2, 5].includes(degree) ? 'tonic' : [1, 3].includes(degree) ? 'subdominant' : 'dominant');
}

export function romanFor(degree: number, quality: ChordQuality, prefix = ''): string {
  const base = ROMAN[degree];
  const lower = ['min', 'dim', 'min7', 'min9', 'm7b5'].includes(quality);
  let r = prefix + (lower ? base.toLowerCase() : base);
  if (quality === 'dim') r += '°';
  if (quality === 'maj7') r += 'maj7';
  if (quality === 'min7' || quality === 'dom7') r += '7';
  if (quality === 'add9') r += 'add9';
  if (quality === 'min9') r += '9';
  if (quality === 'sus2') r += 'sus2';
  if (quality === 'sus4') r += 'sus4';
  if (quality === 'm7b5') r += 'ø7';
  return r;
}

/** The diatonic triad on a scale degree (0-based) in a key */
export function diatonicChord(key: number, mode: Mode, degree: number): Chord {
  const scale = scaleOf(mode);
  const quality = triadQualityFor(mode, degree);
  return {
    root: (key + scale[degree]) % 12,
    quality,
    roman: romanFor(degree, quality),
    fn: functionFor(mode, degree),
  };
}

/** Borrowed / chromatic chords commonly used in pop writing */
export function borrowedChords(key: number, mode: Mode): Chord[] {
  if (mode === 'major') {
    return [
      { root: (key + 5) % 12, quality: 'min', roman: 'iv', fn: 'borrowed' },
      { root: (key + 10) % 12, quality: 'maj', roman: '♭VII', fn: 'borrowed' },
      { root: (key + 8) % 12, quality: 'maj', roman: '♭VI', fn: 'borrowed' },
      { root: (key + 2) % 12, quality: 'dom7', roman: 'II7', fn: 'borrowed' },
    ];
  }
  return [
    { root: (key + 7) % 12, quality: 'maj', roman: 'V', fn: 'dominant' }, // harmonic-minor V
    { root: (key + 5) % 12, quality: 'maj', roman: 'IV', fn: 'borrowed' }, // dorian IV
    { root: (key + 1) % 12, quality: 'maj', roman: '♭II', fn: 'borrowed' }, // neapolitan
  ];
}

/** Apply a colour/extension to a chord, keeping its roman numeral in sync */
export function withQuality(chord: Chord, quality: ChordQuality, key: number, mode: Mode = 'major'): Chord {
  const interval = (chord.root - key + 12) % 12;
  const majorMap: Record<number, [number, string]> = {
    0: [0, ''], 1: [1, '♭'], 2: [1, ''], 3: [2, '♭'], 4: [2, ''], 5: [3, ''],
    6: [4, '♭'], 7: [4, ''], 8: [5, '♭'], 9: [5, ''], 10: [6, '♭'], 11: [6, ''],
  };
  const minorMap: Record<number, [number, string]> = {
    0: [0, ''], 1: [1, '♭'], 2: [1, ''], 3: [2, ''], 4: [2, '♯'], 5: [3, ''],
    6: [4, '♭'], 7: [4, ''], 8: [5, ''], 9: [5, '♯'], 10: [6, ''], 11: [6, '♯'],
  };
  const [degree, prefix] = (mode === 'major' ? majorMap : minorMap)[interval];
  return { ...chord, quality, roman: romanFor(degree, quality, prefix) };
}
