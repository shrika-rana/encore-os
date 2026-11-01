import { describe, expect, it } from 'vitest';
import {
  chordPitchClasses, chordSymbol, diatonicChord, keyLabel, voiceChord, withQuality,
} from '../src/lib/music/theory';
import {
  generateSong, MOODS, GENRES, modeForMood, regenerateSection, SongSettings, substitutionsFor,
} from '../src/lib/music/generator';

const scale = (key: number, mode: 'major' | 'minor') =>
  (mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10]).map((i) => (key + i) % 12);

describe('music theory', () => {
  it('builds the correct diatonic triads in C major', () => {
    const names = [0, 1, 2, 3, 4, 5, 6].map((d) => chordSymbol(diatonicChord(0, 'major', d)));
    expect(names).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
  });

  it('builds the correct diatonic triads in A minor with roman numerals', () => {
    const chords = [0, 1, 2, 3, 4, 5, 6].map((d) => diatonicChord(9, 'minor', d));
    expect(chords.map((c) => chordSymbol(c))).toEqual(['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G']);
    expect(chords.map((c) => c.roman)).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
  });

  it('spells flat keys with flats', () => {
    expect(keyLabel(10, 'major')).toBe('Bb major');
    expect(chordSymbol(diatonicChord(10, 'major', 3), true)).toBe('Eb');
  });

  it('keeps roman numerals in sync when a chord is recoloured', () => {
    const v = diatonicChord(0, 'major', 4);
    expect(withQuality(v, 'dom7', 0).roman).toBe('V7');
    expect(chordSymbol(withQuality(v, 'dom7', 0))).toBe('G7');
  });

  it('voices chords in a playable register with the right notes', () => {
    const chord = diatonicChord(7, 'major', 0); // G
    const { bass, upper } = voiceChord(chord);
    expect(new Set(upper.map((n) => n % 12))).toEqual(new Set(chordPitchClasses(chord)));
    expect(Math.min(...upper)).toBeGreaterThanOrEqual(55);
    expect(Math.max(...upper)).toBeLessThanOrEqual(70);
    expect(bass % 12).toBe(7);
  });
});

describe('progression generator', () => {
  const all: SongSettings[] = [];
  for (const mood of MOODS) for (const genre of GENRES) for (const key of [0, 3, 7, 10]) all.push({ key, mood: mood.id, genre: genre.id, bpm: 90 });

  it('is deterministic for the same seed', () => {
    const s: SongSettings = { key: 2, mood: 'bright', genre: 'rock', bpm: 100 };
    expect(generateSong(s, 42)).toEqual(expect.objectContaining({ length: 4 }));
    const a = generateSong(s, 42).map((x) => x.chords);
    const b = generateSong(s, 42).map((x) => x.chords);
    expect(a).toEqual(b);
  });

  it('writes 4 sections of the right length for every mood × genre × key', () => {
    for (const s of all) {
      const song = generateSong(s, 7);
      expect(song.map((x) => x.name)).toEqual(['Verse', 'Pre-chorus', 'Chorus', 'Bridge']);
      expect(song.map((x) => x.chords.length)).toEqual([4, 2, 4, 4]);
    }
  });

  it('roots every non-borrowed chord in the key (1,000 songs)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 50; seed++) {
      for (const s of all.slice(0, 20)) {
        const mode = modeForMood(s.mood);
        const inKey = scale(s.key, mode);
        for (const sec of generateSong(s, seed)) {
          for (const c of sec.chords) {
            const ok = inKey.includes(c.root) || (mode === 'minor' && c.roman.startsWith('V'));
            expect(ok).toBe(true);
          }
        }
        checked++;
      }
    }
    expect(checked).toBe(1000);
  });

  it('never repeats the same chord twice in a row inside a section', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const song = generateSong({ key: 0, mood: 'anthemic', genre: 'indie-pop', bpm: 90 }, seed);
      for (const sec of song) {
        for (let i = 1; i < sec.chords.length; i++) expect(sec.chords[i].root).not.toBe(sec.chords[i - 1].root);
      }
    }
  });

  it('starts verses on the tonic chord', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s: SongSettings = { key: 5, mood: 'melancholic', genre: 'folk', bpm: 80 };
      expect(generateSong(s, seed)[0].chords[0].root).toBe(5);
    }
  });

  it('keeps locked chords when a section is rewritten', () => {
    const s: SongSettings = { key: 0, mood: 'bright', genre: 'rock', bpm: 100 };
    const verse = generateSong(s, 3)[0];
    const locked = { ...verse, locked: [false, true, false, true] };
    for (let seed = 1; seed <= 50; seed++) {
      const next = regenerateSection(locked, s, seed);
      expect(next.chords[1]).toEqual(verse.chords[1]);
      expect(next.chords[3]).toEqual(verse.chords[3]);
    }
  });

  it('colours chords by genre (lo-fi uses 7ths)', () => {
    const song = generateSong({ key: 0, mood: 'dreamy', genre: 'lofi', bpm: 75 }, 11);
    const qualities = song.flatMap((s) => s.chords.map((c) => c.quality));
    expect(qualities.every((q) => ['maj7', 'min7', 'dom7', 'm7b5'].includes(q))).toBe(true);
  });

  it('offers substitutions that exclude the current chord', () => {
    const s: SongSettings = { key: 0, mood: 'bright', genre: 'rock', bpm: 100 };
    const c = diatonicChord(0, 'major', 0);
    const groups = substitutionsFor(c, s);
    expect(groups.length).toBeGreaterThanOrEqual(3);
    const same = groups.find((g) => g.label.startsWith('Same job'))!;
    expect(same.chords.map((x) => chordSymbol(x)).sort()).toEqual(['Am', 'Em']);
  });
});
