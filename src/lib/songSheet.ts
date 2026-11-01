import { SongSection, SongSettings, MOODS, GENRES, modeForMood } from './music/generator';
import { chordSymbol, keyLabel, useFlats } from './music/theory';

export function songSheet(title: string, theme: string, settings: SongSettings, sections: SongSection[], lyrics: Record<string, string>, artist: string): string {
  const mode = modeForMood(settings.mood);
  const flats = useFlats(settings.key, mode);
  const out: string[] = [
    title || 'Untitled',
    `by ${artist}`,
    '',
    `Key: ${keyLabel(settings.key, mode)}   Tempo: ${settings.bpm} BPM   Mood: ${MOODS.find((m) => m.id === settings.mood)?.label}   Genre: ${GENRES.find((g) => g.id === settings.genre)?.label}`,
    theme ? `Theme: ${theme}` : '',
    '',
  ];
  for (const s of sections) {
    out.push(`[${s.name}]`);
    out.push(s.chords.map((c) => chordSymbol(c, flats).padEnd(8)).join('| ') + '|');
    out.push(s.chords.map((c) => c.roman.padEnd(8)).join('  '));
    const text = (lyrics[s.name] ?? '').trim();
    if (text) out.push('', text);
    out.push('');
  }
  out.push('Written in ENCORE OS Song Studio (prototype).');
  return out.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) => (s || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
