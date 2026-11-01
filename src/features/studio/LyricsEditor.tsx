import { KeyboardEvent, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../store';
import { Dict, rhymeScheme, syllablesInLine } from '../../lib/lyrics/pron';
import { chordSymbol, useFlats } from '../../lib/music/theory';
import { modeForMood } from '../../lib/music/generator';

const LETTER_STYLES = [
  { background: 'var(--glacier-soft)', color: 'var(--glacier-deep)' },
  { background: 'var(--spruce-soft)', color: 'var(--spruce)' },
  { background: 'var(--berry-soft)', color: 'var(--berry)' },
  { background: '#f6ecda', color: 'var(--amber)' },
  { background: '#ece8f4', color: '#5b4a87' },
];

interface Props {
  dict: Dict | null;
  section: string;
  onSection: (s: string) => void;
  focused: number;
  onFocus: (i: number) => void;
}

export function LyricsEditor({ dict, section, onSection, focused, onFocus }: Props) {
  const sections = useStore((s) => s.sections);
  const lyrics = useStore((s) => s.lyrics);
  const setLyrics = useStore((s) => s.setLyrics);
  const settings = useStore((s) => s.settings);
  const flats = useFlats(settings.key, modeForMood(settings.mood));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const pendingFocus = useRef<number | null>(null);

  const text = lyrics[section] ?? '';
  const lines = text.length ? text.split('\n') : [''];
  const scheme = useMemo(() => rhymeScheme(lines, dict), [text, dict]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => lines.map((l) => (l.trim() ? syllablesInLine(l, dict) : 0)), [text, dict]); // eslint-disable-line react-hooks/exhaustive-deps
  const filled = counts.filter((c) => c > 0);
  const target = filled.length ? Math.round(filled.reduce((a, b) => a + b, 0) / filled.length) : 0;
  const sec = sections.find((s) => s.name === section);

  useEffect(() => {
    if (pendingFocus.current !== null) {
      refs.current[pendingFocus.current]?.focus();
      pendingFocus.current = null;
    }
  });

  const write = (next: string[]) => setLyrics(section, next.join('\n'));

  const onKey = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    const input = e.currentTarget;
    if (e.key === 'Enter') {
      e.preventDefault();
      const pos = input.selectionStart ?? input.value.length;
      const next = [...lines];
      next.splice(i, 1, lines[i].slice(0, pos), lines[i].slice(pos));
      write(next);
      pendingFocus.current = i + 1;
      onFocus(i + 1);
    } else if (e.key === 'Backspace' && input.selectionStart === 0 && input.selectionEnd === 0 && i > 0) {
      e.preventDefault();
      const next = [...lines];
      const merged = next[i - 1] + next[i];
      next.splice(i - 1, 2, merged);
      write(next);
      pendingFocus.current = i - 1;
      onFocus(i - 1);
    } else if (e.key === 'ArrowUp' && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowDown' && i < lines.length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  };

  const letterIndex = (l: string) => (l ? (l.charCodeAt(0) - 65) % LETTER_STYLES.length : 0);

  return (
    <div>
      <div className="panel-head" style={{ padding: 0 }}>
        <h2 className="h-section">Lyrics</h2>
        <span className="small muted">{dict ? 'Pronunciation dictionary loaded' : 'Loading pronunciation dictionary…'}</span>
      </div>
      <div className="lyric-tabs" role="tablist">
        {sections.map((s) => {
          const n = (lyrics[s.name] ?? '').split('\n').filter((l) => l.trim()).length;
          return (
            <button key={s.id} role="tab" className="lyric-tab" aria-selected={s.name === section} onClick={() => { onSection(s.name); onFocus(0); }}>
              {s.name}<span className="count">{n}</span>
            </button>
          );
        })}
      </div>
      {sec && (
        <div className="chord-strip" aria-label={`${section} chords`}>
          {sec.chords.map((c, i) => <span key={i}>{chordSymbol(c, flats)}</span>)}
        </div>
      )}
      <div className="lines">
        {lines.map((line, i) => {
          const off = counts[i] > 0 && target > 0 && Math.abs(counts[i] - target) >= 3;
          return (
            <div key={i} className={`line${focused === i ? ' focused' : ''}`}>
              <span className="n">{i + 1}</span>
              <input
                ref={(el) => (refs.current[i] = el)}
                value={line}
                placeholder={i === 0 ? `Start your ${section.toLowerCase()} here…` : 'Next line'}
                onFocus={() => onFocus(i)}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = e.target.value;
                  write(next);
                }}
                onKeyDown={(e) => onKey(e, i)}
                aria-label={`${section} line ${i + 1}`}
                spellCheck
              />
              <span className="rhyme-letter" style={scheme[i] ? LETTER_STYLES[letterIndex(scheme[i])] : undefined} title={scheme[i] ? `Rhyme group ${scheme[i]}` : ''}>
                {scheme[i]}
              </span>
              <span className={`syl${off ? ' off' : ''}`} title={off ? `About ${target} syllables would match the other lines` : 'Syllables'}>
                {counts[i] > 0 ? `${counts[i]} syl` : ''}
              </span>
            </div>
          );
        })}
      </div>
      <p className="lyric-hint">
        Lines that rhyme share a letter. Syllable counts turn amber when a line is much longer or shorter than the rest, which usually means it won't fit the melody.
      </p>
    </div>
  );
}
