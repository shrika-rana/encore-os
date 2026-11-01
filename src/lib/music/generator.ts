// Chord progression engine: a mood-weighted Markov chain over scale degrees,
// blended with proven pop templates, then coloured by genre.

import {
  borrowedChords, Chord, ChordQuality, diatonicChord, Mode, withQuality,
} from './theory';

export type Mood = 'bright' | 'melancholic' | 'dreamy' | 'anthemic' | 'tense';
export type Genre = 'indie-pop' | 'rock' | 'lofi' | 'folk' | 'rnb' | 'bollywood';
export type SectionName = 'Verse' | 'Pre-chorus' | 'Chorus' | 'Bridge';

export interface SongSection {
  id: string;
  name: SectionName;
  chords: Chord[];
  locked: boolean[];
}

export interface SongSettings {
  key: number;
  mood: Mood;
  genre: Genre;
  bpm: number;
}

export const MOODS: { id: Mood; label: string; mode: Mode; hint: string }[] = [
  { id: 'bright', label: 'Bright', mode: 'major', hint: 'Open, hopeful, sunlit' },
  { id: 'anthemic', label: 'Anthemic', mode: 'major', hint: 'Big singalong chorus' },
  { id: 'dreamy', label: 'Dreamy', mode: 'major', hint: 'Soft, floating, lush' },
  { id: 'melancholic', label: 'Melancholic', mode: 'minor', hint: 'Bittersweet and reflective' },
  { id: 'tense', label: 'Tense', mode: 'minor', hint: 'Dark, restless, cinematic' },
];

export const GENRES: { id: Genre; label: string }[] = [
  { id: 'indie-pop', label: 'Indie pop' },
  { id: 'rock', label: 'Rock' },
  { id: 'lofi', label: 'Lo-fi' },
  { id: 'folk', label: 'Folk' },
  { id: 'rnb', label: 'R&B / Soul' },
  { id: 'bollywood', label: 'Bollywood ballad' },
];

export function modeForMood(mood: Mood): Mode {
  return MOODS.find((m) => m.id === mood)!.mode;
}

/** Deterministic PRNG so a seed always reproduces the same song */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Transition probabilities between scale degrees (0 = I/i … 6 = vii°/VII)
const MAJOR_T: number[][] = [
  /* I   */ [0, 0.12, 0.06, 0.3, 0.27, 0.25, 0],
  /* ii  */ [0.1, 0, 0.1, 0.1, 0.55, 0.1, 0.05],
  /* iii */ [0.1, 0.1, 0, 0.35, 0, 0.45, 0],
  /* IV  */ [0.3, 0.1, 0.05, 0, 0.35, 0.2, 0],
  /* V   */ [0.5, 0, 0, 0.15, 0, 0.35, 0],
  /* vi  */ [0.05, 0.2, 0.1, 0.45, 0.2, 0, 0],
  /* vii */ [0.8, 0, 0.2, 0, 0, 0, 0],
];
const MINOR_T: number[][] = [
  /* i   */ [0, 0.05, 0.15, 0.25, 0.1, 0.25, 0.2],
  /* ii° */ [0.2, 0, 0, 0, 0.5, 0, 0.3],
  /* III */ [0.15, 0, 0, 0.25, 0, 0.35, 0.25],
  /* iv  */ [0.3, 0, 0.1, 0, 0.2, 0.15, 0.25],
  /* v   */ [0.5, 0, 0, 0.2, 0, 0.3, 0],
  /* VI  */ [0.1, 0, 0.25, 0.2, 0.1, 0, 0.35],
  /* VII */ [0.35, 0, 0.35, 0.1, 0, 0.2, 0],
];

// Mood bias multiplies the probability of landing on each degree
const MOOD_BIAS: Record<Mood, number[]> = {
  bright: [1.5, 0.8, 0.5, 1.4, 1.4, 0.9, 0.1],
  anthemic: [1.3, 0.6, 0.4, 1.5, 1.3, 1.5, 0.1],
  dreamy: [1.2, 1.0, 1.4, 1.5, 0.7, 1.3, 0.1],
  melancholic: [1.2, 0.3, 1.2, 1.4, 0.8, 1.5, 1.3],
  tense: [1.3, 1.4, 0.8, 1.2, 1.5, 1.0, 1.0],
};

// Well-known progressions, expressed as scale degrees
const TEMPLATES: Record<Mood, number[][]> = {
  bright: [[0, 4, 5, 3], [0, 3, 4, 3], [0, 5, 3, 4], [3, 0, 4, 4]],
  anthemic: [[5, 3, 0, 4], [0, 4, 5, 3], [3, 0, 4, 5], [0, 3, 5, 4]],
  dreamy: [[0, 2, 5, 3], [3, 0, 3, 0], [0, 3, 1, 4], [5, 3, 0, 2]],
  melancholic: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [5, 6, 0, 0]],
  tense: [[0, 5, 6, 4], [0, 1, 4, 0], [0, 3, 4, 0], [0, 6, 5, 4]],
};

const SECTION_LENGTH: Record<SectionName, number> = { Verse: 4, 'Pre-chorus': 2, Chorus: 4, Bridge: 4 };
export const SECTION_ORDER: SectionName[] = ['Verse', 'Pre-chorus', 'Chorus', 'Bridge'];

function weightedPick(weights: number[], rand: () => number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function nextDegree(prev: number, mood: Mood, mode: Mode, rand: () => number, avoid: number[] = []): number {
  const table = mode === 'major' ? MAJOR_T : MINOR_T;
  const bias = MOOD_BIAS[mood];
  const weights = table[prev].map((p, i) => (avoid.includes(i) ? 0 : p * bias[i]));
  return weightedPick(weights, rand);
}

/** Generate scale degrees for one section */
export function generateDegrees(
  name: SectionName, mood: Mood, rand: () => number, fixed: (number | null)[] = [],
): number[] {
  const mode = modeForMood(mood);
  const len = SECTION_LENGTH[name];
  let degrees: number[];

  const useTemplate = (name === 'Chorus' && rand() < 0.55) || (name === 'Verse' && rand() < 0.3);
  if (useTemplate) {
    let t = TEMPLATES[mood][Math.floor(rand() * TEMPLATES[mood].length)];
    // Verses establish the key, so rotate the loop to begin on the tonic
    if (name === 'Verse' && t[0] !== 0) {
      const i = t.indexOf(0);
      t = i >= 0 ? [...t.slice(i), ...t.slice(0, i)] : [0, ...t.slice(1)];
    }
    degrees = t.slice(0, len);
  } else {
    const start = name === 'Verse' ? 0 : name === 'Bridge' ? (mode === 'major' ? 5 : 5) : name === 'Pre-chorus' ? 3 : 0;
    degrees = [start];
    while (degrees.length < len) {
      const prev = degrees[degrees.length - 1];
      const isLast = degrees.length === len - 1;
      let d = nextDegree(prev, mood, mode, rand, [prev]);
      // Pre-chorus and bridge should lean into the dominant to set up the chorus
      if (isLast && (name === 'Pre-chorus' || name === 'Bridge') && rand() < 0.7) d = 4;
      degrees.push(d);
    }
  }
  // Respect locked positions, then remove accidental repeats of neighbours
  fixed.forEach((f, i) => { if (f !== null && i < degrees.length) degrees[i] = f; });
  for (let i = 1; i < degrees.length; i++) {
    if (degrees[i] === degrees[i - 1] && fixed[i] == null) {
      degrees[i] = nextDegree(degrees[i - 1], mood, mode, rand, [degrees[i - 1]]);
    }
  }
  return degrees;
}

/** Choose a genre-appropriate colour for a diatonic chord */
export function colourFor(base: Chord, degree: number, genre: Genre, mood: Mood, rand: () => number): ChordQuality {
  const q = base.quality;
  if (q === 'dim') return genre === 'rnb' || genre === 'lofi' ? 'm7b5' : 'dim';
  const isMajor = q === 'maj';
  const isDominant = degree === 4 && isMajor;
  switch (genre) {
    case 'lofi':
    case 'rnb':
      if (isDominant) return 'dom7';
      if (isMajor) return 'maj7';
      return genre === 'rnb' && rand() < 0.4 ? 'min9' : 'min7';
    case 'indie-pop':
      if (isMajor && rand() < 0.3) return degree === 0 || degree === 3 ? 'add9' : 'sus2';
      return q;
    case 'rock':
      if (isDominant && rand() < 0.3) return 'sus4';
      return q;
    case 'folk':
      if (isMajor && rand() < 0.25) return rand() < 0.5 ? 'sus2' : 'sus4';
      return q;
    case 'bollywood':
      if (isMajor && rand() < 0.3) return 'add9';
      if (!isMajor && mood !== 'tense' && rand() < 0.25) return 'min7';
      return q;
  }
  return q;
}

export function degreesToChords(
  degrees: number[], settings: SongSettings, rand: () => number,
): Chord[] {
  const mode = modeForMood(settings.mood);
  return degrees.map((d) => {
    const base = diatonicChord(settings.key, mode, d);
    // Tense minor songs use the harmonic-minor V for a stronger pull home
    if (mode === 'minor' && d === 4 && settings.mood === 'tense') {
      return withQuality({ ...base, quality: 'maj', fn: 'dominant' }, settings.genre === 'rnb' || settings.genre === 'lofi' ? 'dom7' : 'maj', settings.key, mode);
    }
    const quality = colourFor(base, d, settings.genre, settings.mood, rand);
    return quality === base.quality ? base : withQuality(base, quality, settings.key, mode);
  });
}

let idCounter = 0;
const newId = () => `s${Date.now().toString(36)}${(idCounter++).toString(36)}`;

/** Build a full song: verse, pre-chorus, chorus and bridge */
export function generateSong(settings: SongSettings, seed: number): SongSection[] {
  const rand = mulberry32(seed);
  const sections: SongSection[] = [];
  for (const name of SECTION_ORDER) {
    let degrees = generateDegrees(name, settings.mood, rand);
    // Keep the chorus distinct from the verse
    const verse = sections.find((s) => s.name === 'Verse');
    let guard = 0;
    while (name === 'Chorus' && verse && guard++ < 6 && sameDegrees(degrees, verse.chords, settings)) {
      degrees = generateDegrees(name, settings.mood, rand);
    }
    const chords = degreesToChords(degrees, settings, rand);
    sections.push({ id: newId(), name, chords, locked: chords.map(() => false) });
  }
  return sections;
}

function sameDegrees(degrees: number[], chords: Chord[], settings: SongSettings): boolean {
  const mode = modeForMood(settings.mood);
  const roots = degrees.map((d) => diatonicChord(settings.key, mode, d).root);
  return roots.length === chords.length && roots.every((r, i) => r === chords[i].root);
}

/** Regenerate one section, keeping locked chords where they are */
export function regenerateSection(section: SongSection, settings: SongSettings, seed: number): SongSection {
  const rand = mulberry32(seed);
  const mode = modeForMood(settings.mood);
  const fixed = section.chords.map((c, i) => (section.locked[i] ? degreeOf(c.root, settings.key, mode) : null));
  const degrees = generateDegrees(section.name, settings.mood, rand, fixed);
  const fresh = degreesToChords(degrees, settings, rand);
  return { ...section, chords: fresh.map((c, i) => (section.locked[i] ? section.chords[i] : c)) };
}

function degreeOf(root: number, key: number, mode: Mode): number | null {
  const scale = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  const idx = scale.indexOf((root - key + 12) % 12);
  return idx === -1 ? null : idx;
}

/** Alternatives offered when the writer clicks a chord */
export function substitutionsFor(chord: Chord, settings: SongSettings): { label: string; chords: Chord[] }[] {
  const mode = modeForMood(settings.mood);
  const diatonic = [0, 1, 2, 3, 4, 5, 6].map((d) => diatonicChord(settings.key, mode, d));
  const sameFn = diatonic.filter((c) => c.fn === chord.fn && c.root !== chord.root);
  const colourSet: ChordQuality[] = ['min', 'min7', 'min9'].includes(chord.quality)
    ? ['min', 'min7', 'min9']
    : ['dim', 'm7b5'].includes(chord.quality)
      ? ['dim', 'm7b5']
      : ['maj', 'maj7', 'add9', 'sus2', 'sus4', 'dom7'];
  return [
    { label: 'Same job, different colour', chords: sameFn },
    { label: 'Extensions', chords: colourSet.filter((q) => q !== chord.quality).map((q) => withQuality(chord, q, settings.key, mode)) },
    { label: 'Borrowed', chords: borrowedChords(settings.key, mode).filter((c) => c.root !== chord.root || c.quality !== chord.quality) },
    { label: 'All diatonic', chords: diatonic.filter((c) => c.root !== chord.root) },
  ].filter((g) => g.chords.length > 0);
}
