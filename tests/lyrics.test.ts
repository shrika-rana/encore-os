import { beforeAll, describe, expect, it } from 'vitest';
import { Dict, loadDictionary, rhymeScheme, rhymeStrength, syllablesInLine, syllablesInWord } from '../src/lib/lyrics/pron';
import { offlineRhymes } from '../src/lib/lyrics/rhymes';
import { buildPrompt, offlineSuggest } from '../src/lib/lyrics/cowriter';

let dict: Dict;
beforeAll(async () => { dict = await loadDictionary(); });

describe('pronunciation', () => {
  it('loads the CMU dictionary', () => {
    expect(Object.keys(dict).length).toBeGreaterThan(130000);
  });

  it('counts syllables in words and lines', () => {
    expect(syllablesInWord('beautiful', dict)).toBe(3);
    expect(syllablesInWord('fire', dict)).toBe(2);
    expect(syllablesInWord('remember', dict)).toBe(3);
    expect(syllablesInLine('Your coat still hangs behind the door', dict)).toBe(8);
  });

  it('falls back to a heuristic for unknown words', () => {
    expect(syllablesInWord('zindagiyaan', dict)).toBeGreaterThanOrEqual(3);
  });

  it('detects perfect, near and non-rhymes', () => {
    expect(rhymeStrength('door', 'floor', dict)).toBe('perfect');
    expect(rhymeStrength('remember', 'december', dict)).toBe('perfect');
    expect(rhymeStrength('night', 'light', dict)).toBe('perfect');
    expect(rhymeStrength('time', 'line', dict)).toBe('near');
    expect(rhymeStrength('snow', 'rain', dict)).toBe('none');
  });

  it('labels a rhyme scheme', () => {
    expect(rhymeScheme(['I waited by the door', 'The kettle sings for two', 'You left your coat on the floor', 'And I am missing you'], dict))
      .toEqual(['A', 'B', 'A', 'B']);
    expect(rhymeScheme(['Under the night', 'Holding the light', 'Lost in the rain', 'Calling your name'], dict))
      .toEqual(['A', 'A', 'B', 'B']);
  });
});

describe('co-writer', () => {
  it('finds offline rhymes from the word bank', () => {
    const words = offlineRhymes('heart', dict).map((r) => r.word);
    expect(words).toEqual(expect.arrayContaining(['art', 'start']));
    expect(new Set(words).size).toBe(words.length);
  });

  it('builds offline lines that end on a rhyme and fit the syllable target', () => {
    const rhymes = offlineRhymes('door', dict);
    const out = offlineSuggest({ mood: 'melancholic', theme: 'winter', themeWords: [], rhymes, targetSyllables: 8, seed: 5 }, dict);
    expect(out.length).toBe(4);
    for (const s of out) {
      const last = s.text.split(' ').pop()!;
      expect(rhymeStrength('door', last, dict)).not.toBe('none');
      expect(Math.abs(s.syllables - 8)).toBeLessThanOrEqual(3);
    }
  });

  it('gives the AI model the full song context', () => {
    const p = buildPrompt({
      title: 'Frost', theme: 'missing someone', mood: 'Melancholic', genre: 'Indie pop', section: 'Verse', chords: 'Gm Eb F Bb',
      previousLines: ['Your coat still hangs behind the door'], targetSyllables: 8, rhymeWith: 'door', count: 4,
    });
    expect(p).toContain('Frost');
    expect(p).toContain('Gm Eb F Bb');
    expect(p).toContain('rhymes with "door"');
    expect(p).toContain('about 8 syllables');
  });
});
