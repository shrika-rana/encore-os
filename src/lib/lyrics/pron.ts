// Pronunciation helpers built on the CMU Pronouncing Dictionary (134k words).
// Used for syllable counts, rhyme detection and offline rhyme search.

import { syllable as syllableHeuristic } from 'syllable';

export type Dict = Record<string, string>;

let dictPromise: Promise<Dict> | null = null;
let dictCache: Dict | null = null;

/** Lazily load the dictionary (it is ~4.7 MB, so it lives in its own chunk) */
export function loadDictionary(): Promise<Dict> {
  if (!dictPromise) {
    dictPromise = import('cmu-pronouncing-dictionary').then((m) => {
      dictCache = m.dictionary as Dict;
      return dictCache;
    });
  }
  return dictPromise;
}

export function getLoadedDictionary(): Dict | null {
  return dictCache;
}

export function cleanWord(w: string): string {
  return w.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z']/g, '').replace(/^'+|'+$/g, '');
}

export function phonemes(word: string, dict: Dict | null): string[] | null {
  if (!dict) return null;
  const p = dict[cleanWord(word)];
  return p ? p.split(' ') : null;
}

const isVowel = (ph: string) => /\d$/.test(ph);

export function syllablesInWord(word: string, dict: Dict | null): number {
  const w = cleanWord(word);
  if (!w) return 0;
  const ph = phonemes(w, dict);
  if (ph) return ph.filter(isVowel).length;
  return Math.max(1, syllableHeuristic(w));
}

export function syllablesInLine(line: string, dict: Dict | null): number {
  return line
    .split(/[\s\-–—/]+/)
    .map((w) => syllablesInWord(w, dict))
    .reduce((a, b) => a + b, 0);
}

export function lastWord(line: string): string {
  const words = line.trim().split(/\s+/).map(cleanWord).filter(Boolean);
  return words[words.length - 1] ?? '';
}

/**
 * The rhyming part of a word: everything from its last stressed vowel to the
 * end, with stress marks removed. "remember" → "EH M B ER", "ember" → "EH M B ER".
 */
export function rhymeTail(word: string, dict: Dict | null): string | null {
  const ph = phonemes(word, dict);
  if (ph) {
    let idx = -1;
    for (let i = ph.length - 1; i >= 0; i--) {
      if (/[12]$/.test(ph[i])) { idx = i; break; }
    }
    if (idx === -1) idx = ph.findLastIndex(isVowel);
    if (idx === -1) return null;
    return ph.slice(idx).map((p) => p.replace(/\d/, '')).join(' ');
  }
  // Spelling fallback for words outside the dictionary (names, Hinglish)
  const w = cleanWord(word);
  const m = w.match(/[aeiouy]+[^aeiouy]*e?$/);
  return m ? `~${m[0].replace(/e$/, '')}` : null;
}

/** The stressed vowel sound alone, used for near (slant) rhymes */
export function rhymeVowel(tail: string | null): string | null {
  if (!tail) return null;
  return tail.split(' ')[0];
}

export type RhymeStrength = 'perfect' | 'near' | 'none';

export function rhymeStrength(a: string, b: string, dict: Dict | null): RhymeStrength {
  const wa = cleanWord(a);
  const wb = cleanWord(b);
  if (!wa || !wb) return 'none';
  const ta = rhymeTail(wa, dict);
  const tb = rhymeTail(wb, dict);
  if (!ta || !tb) return 'none';
  if (ta === tb) return wa === wb ? 'near' : 'perfect';
  if (ta.startsWith('~') || tb.startsWith('~')) return 'none';
  const va = rhymeVowel(ta);
  const vb = rhymeVowel(tb);
  if (va && va === vb) {
    // same vowel; endings in the same consonant family count as a slant rhyme
    const ea = ta.split(' ').slice(1);
    const eb = tb.split(' ').slice(1);
    const family = (p?: string) => {
      if (!p) return 'open';
      if (['M', 'N', 'NG'].includes(p)) return 'nasal';
      if (['P', 'B', 'T', 'D', 'K', 'G'].includes(p)) return 'stop';
      if (['F', 'V', 'TH', 'DH', 'S', 'Z', 'SH', 'ZH'].includes(p)) return 'fric';
      return p;
    };
    if (family(ea[ea.length - 1]) === family(eb[eb.length - 1])) return 'near';
  }
  return 'none';
}

/**
 * Label each line with a rhyme-scheme letter (A, B, C…). Lines that rhyme
 * (perfect or near) share a letter. Empty lines get an empty label.
 */
export function rhymeScheme(lines: string[], dict: Dict | null): string[] {
  const groups: string[] = []; // representative last word per letter
  return lines.map((line) => {
    const w = lastWord(line);
    if (!w) return '';
    for (let g = 0; g < groups.length; g++) {
      if (rhymeStrength(w, groups[g], dict) !== 'none' || cleanWord(w) === groups[g]) {
        return String.fromCharCode(65 + g);
      }
    }
    groups.push(cleanWord(w));
    return String.fromCharCode(65 + groups.length - 1);
  });
}
