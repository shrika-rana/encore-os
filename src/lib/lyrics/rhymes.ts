// Rhyme & theme-word search. Uses the free Datamuse API when online and
// falls back to the local CMU dictionary + curated word bank when offline.

import { ALL_BANK_WORDS, Pos } from './wordbank';
import { cleanWord, Dict, rhymeStrength, syllablesInWord } from './pron';

export interface RhymeResult {
  word: string;
  syllables: number;
  strength: 'perfect' | 'near';
  pos?: Pos;
}

export interface RhymeSearch {
  results: RhymeResult[];
  source: 'datamuse' | 'offline';
}

const DATAMUSE = 'https://api.datamuse.com/words';

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

interface DatamuseWord { word: string; numSyllables?: number; tags?: string[]; score?: number }

function posFromTags(tags?: string[]): Pos | undefined {
  if (!tags) return undefined;
  if (tags.includes('n')) return 'noun';
  if (tags.includes('v')) return 'verb';
  if (tags.includes('adj')) return 'adj';
  return undefined;
}

export function offlineRhymes(word: string, dict: Dict | null, limit = 30): RhymeResult[] {
  const target = cleanWord(word);
  if (!target) return [];
  const out: RhymeResult[] = [];
  const seen = new Set<string>();
  for (const { word: w, pos } of ALL_BANK_WORDS) {
    if (w === target || seen.has(w)) continue;
    seen.add(w);
    const s = rhymeStrength(target, w, dict);
    if (s !== 'none') out.push({ word: w, syllables: syllablesInWord(w, dict), strength: s, pos });
  }
  out.sort((a, b) => (a.strength === b.strength ? a.syllables - b.syllables : a.strength === 'perfect' ? -1 : 1));
  return out.slice(0, limit);
}

export async function findRhymes(word: string, dict: Dict | null, online = true): Promise<RhymeSearch> {
  const target = cleanWord(word);
  if (!target) return { results: [], source: 'offline' };
  if (online && typeof fetch !== 'undefined') {
    try {
      const [perfect, near] = await Promise.all([
        fetchWithTimeout(`${DATAMUSE}?rel_rhy=${encodeURIComponent(target)}&md=sp&max=40`, 3500).then((r) => r.json() as Promise<DatamuseWord[]>),
        fetchWithTimeout(`${DATAMUSE}?rel_nry=${encodeURIComponent(target)}&md=sp&max=20`, 3500).then((r) => r.json() as Promise<DatamuseWord[]>),
      ]);
      const seen = new Set<string>();
      const results: RhymeResult[] = [];
      const add = (list: DatamuseWord[], strength: 'perfect' | 'near') => {
        for (const d of list) {
          if (seen.has(d.word) || d.word.includes(' ') || d.word === target) continue;
          seen.add(d.word);
          results.push({ word: d.word, syllables: d.numSyllables ?? syllablesInWord(d.word, dict), strength, pos: posFromTags(d.tags) });
        }
      };
      add(perfect, 'perfect');
      add(near, 'near');
      if (results.length > 0) return { results, source: 'datamuse' };
    } catch {
      // network unavailable — fall through to offline search
    }
  }
  return { results: offlineRhymes(target, dict), source: 'offline' };
}

/** Words associated with a theme ("means like" + "triggers"), for imagery */
export async function themeWords(theme: string): Promise<string[]> {
  const t = theme.trim();
  if (!t) return [];
  try {
    const res = await fetchWithTimeout(`${DATAMUSE}?ml=${encodeURIComponent(t)}&md=p&max=40`, 3500);
    const list = (await res.json()) as DatamuseWord[];
    return list
      .filter((d) => !d.word.includes(' ') && d.tags?.includes('n'))
      .map((d) => d.word)
      .slice(0, 16);
  } catch {
    return [];
  }
}
