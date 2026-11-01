// Lyric co-writer. Two engines:
//  • "ai"      — a large language model (Google Gemini or any OpenAI-compatible
//                API) using the writer's own key, prompted with full song context.
//  • "offline" — a template engine that combines theme imagery with real rhymes
//                and fits lines to a syllable target. No network or key needed.

import { MOOD_IMAGERY, Pos } from './wordbank';
import { Dict, syllablesInLine } from './pron';
import { RhymeResult } from './rhymes';
import { mulberry32 } from '../music/generator';

export type Provider = 'gemini' | 'openai';

export interface AIConfig {
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export const DEFAULT_AI: AIConfig = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-2.5-flash',
  baseUrl: 'https://api.openai.com/v1',
};

export interface CowriteRequest {
  title: string;
  theme: string;
  mood: string;
  genre: string;
  section: string;
  chords: string;
  previousLines: string[];
  targetSyllables: number;
  rhymeWith?: string;
  count?: number;
}

export interface Suggestion {
  text: string;
  syllables: number;
}

export function buildPrompt(r: CowriteRequest): string {
  const prev = r.previousLines.filter((l) => l.trim()).slice(-8);
  return [
    'You are a lyric co-writer helping an independent songwriter. Suggest the NEXT line of their song.',
    `Song title: ${r.title || 'Untitled'}`,
    `Theme: ${r.theme || 'open'}`,
    `Mood: ${r.mood}. Genre: ${r.genre}. Section: ${r.section}. Chords: ${r.chords}.`,
    prev.length ? `Lines so far:\n${prev.map((l) => `  ${l}`).join('\n')}` : 'This is the first line of the section.',
    `Each suggestion should be about ${r.targetSyllables} syllables so it fits the melody.`,
    r.rhymeWith ? `Each suggestion must end with a word that rhymes with "${r.rhymeWith}".` : '',
    'Use concrete images, avoid clichés, keep the writer\'s voice. Do not repeat earlier lines.',
    `Return JSON only: {"lines": [${Array.from({ length: r.count ?? 4 }, (_, i) => `"line ${i + 1}"`).join(', ')}]}`,
  ].filter(Boolean).join('\n');
}

function parseLines(text: string): string[] {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]) as { lines?: unknown };
      if (Array.isArray(obj.lines)) return obj.lines.map(String).map((s) => s.trim()).filter(Boolean);
    } catch {
      /* fall through */
    }
  }
  return text.split('\n').map((s) => s.replace(/^[\s\-*\d.)"]+|["\s]+$/g, '')).filter((s) => s.length > 3);
}

export async function aiSuggest(cfg: AIConfig, req: CowriteRequest, dict: Dict | null): Promise<Suggestion[]> {
  const prompt = buildPrompt(req);
  let text = '';
  if (cfg.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.95, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new Error(await errorText(res));
    const data = await res.json();
    text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  } else {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.95,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You write song lyrics. Reply with JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(await errorText(res));
    const data = await res.json();
    text = data?.choices?.[0]?.message?.content ?? '';
  }
  const lines = parseLines(text).slice(0, req.count ?? 4);
  if (lines.length === 0) throw new Error('The model replied without any lines. Try again.');
  return lines.map((t) => ({ text: t, syllables: syllablesInLine(t, dict) }));
}

async function errorText(res: Response): Promise<string> {
  try {
    const j = await res.json();
    const msg = j?.error?.message ?? JSON.stringify(j);
    return `AI request failed (${res.status}): ${msg}`;
  } catch {
    return `AI request failed (${res.status})`;
  }
}

// ---------------- Offline template engine ----------------

const TEMPLATES: Record<Pos, string[]> = {
  noun: [
    'I keep your name like a {img} by the {END}',
    'Every {img} I follow leads me back to the {END}',
    'Hold on, hold on to the {END}',
    'Meet me where the {img} runs into the {END}',
    'Under the {img}, I am still looking for the {END}',
    'Tell me there is a way back to the {END}',
    'Leave a light on by the {END}',
    'We were dancing on the {END}',
    'Waiting with the {img} at the {END}',
    'Nothing left but the {img} and the {END}',
    'We said goodbye at the edge of the {END}',
    'Burning like a {img} beneath the {END}',
    'Nobody warned us about the {END}',
    'Your {img} on my collar, my heart on the {END}',
  ],
  verb: [
    'Tell me that we will never {END}',
    'Maybe it is too late to {END}',
    'All I want tonight is to {END}',
    'Teach me how to {END}',
    'Under the {img} we learn to {END}',
    'Don\'t let the {img} tell you not to {END}',
    'I am still waiting for the {img} to {END}',
    'Give me one more reason to {END}',
    'Even the {adj} {img} wants to {END}',
  ],
  adj: [
    'And everything we were is {END}',
    'Since you left, the {img} feels {END}',
    'Tonight the {img} is {END}',
    'Even in the {img}, you look {END}',
    'Tell me why I still feel {END}',
    'We were young and we were {END}',
    'The {img} outside is {adj} and {END}',
  ],
};

const ADJ_POOL = ['quiet', 'golden', 'restless', 'frozen', 'gentle', 'hollow', 'endless', 'silver', 'distant', 'burning'];

export interface OfflineInput {
  mood: string;
  theme: string;
  themeWords: string[];
  rhymes: RhymeResult[];
  targetSyllables: number;
  count?: number;
  seed?: number;
}

export function offlineSuggest(input: OfflineInput, dict: Dict | null): Suggestion[] {
  const rand = mulberry32(input.seed ?? Date.now());
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const imagery = (input.themeWords.length ? input.themeWords : MOOD_IMAGERY[input.mood] ?? MOOD_IMAGERY.bright)
    .filter((w) => /^[a-z]+$/.test(w));
  const endings = input.rhymes.length
    ? input.rhymes.filter((r) => r.pos).slice(0, 18)
    : imagery.map((w) => ({ word: w, pos: 'noun' as Pos, syllables: 1, strength: 'perfect' as const }));

  const candidates: Suggestion[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 80 && endings.length > 0; i++) {
    const end = pick(endings);
    const pos = end.pos ?? 'noun';
    let line = pick(TEMPLATES[pos]);
    let img = pick(imagery);
    if (img === end.word) img = pick(imagery);
    line = line.replace('{END}', end.word).replace('{img}', img).replace('{img}', pick(imagery)).replace('{adj}', pick(ADJ_POOL));
    line = line.charAt(0).toUpperCase() + line.slice(1);
    if (seen.has(line)) continue;
    seen.add(line);
    candidates.push({ text: line, syllables: syllablesInLine(line, dict) });
  }
  const t = input.targetSyllables;
  candidates.sort((a, b) => Math.abs(a.syllables - t) - Math.abs(b.syllables - t) || rand() - 0.5);
  // keep variety: no two suggestions with the same ending word
  const out: Suggestion[] = [];
  const usedEnds = new Set<string>();
  for (const c of candidates) {
    const endWord = c.text.split(' ').pop()!;
    if (usedEnds.has(endWord)) continue;
    usedEnds.add(endWord);
    out.push(c);
    if (out.length >= (input.count ?? 4)) break;
  }
  return out;
}
