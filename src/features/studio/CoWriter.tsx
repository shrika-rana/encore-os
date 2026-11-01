import { useEffect, useMemo, useState } from 'react';
import { Info, Loader2, Plug, Sparkles } from 'lucide-react';
import { useStore } from '../../store';
import { cleanWord, Dict, lastWord, syllablesInLine } from '../../lib/lyrics/pron';
import { findRhymes, RhymeSearch, themeWords } from '../../lib/lyrics/rhymes';
import { aiSuggest, offlineSuggest, Suggestion } from '../../lib/lyrics/cowriter';
import { GENRES, MOODS, modeForMood } from '../../lib/music/generator';
import { chordSymbol, useFlats } from '../../lib/music/theory';
import { AISettings } from './AISettings';
import { toast } from '../../components/toast';

interface Props {
  dict: Dict | null;
  section: string;
  focused: number;
  onFocus: (i: number) => void;
}

export function CoWriter({ dict, section, focused, onFocus }: Props) {
  const lyrics = useStore((s) => s.lyrics);
  const setLyrics = useStore((s) => s.setLyrics);
  const ai = useStore((s) => s.ai);
  const title = useStore((s) => s.title);
  const theme = useStore((s) => s.theme);
  const settings = useStore((s) => s.settings);
  const sections = useStore((s) => s.sections);
  const [showSettings, setShowSettings] = useState(false);

  const lines = (lyrics[section] ?? '').split('\n');
  const current = lines[focused] ?? '';
  const prevLine = [...lines.slice(0, focused)].reverse().find((l) => l.trim()) ?? '';
  const autoWord = lastWord(current) || lastWord(prevLine);

  // ---- Rhyme finder ----
  const [query, setQuery] = useState(autoWord);
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!touched) setQuery(autoWord); }, [autoWord, touched]);
  const [rhymes, setRhymes] = useState<RhymeSearch | null>(null);
  const [loadingRhymes, setLoadingRhymes] = useState(false);
  useEffect(() => {
    const w = cleanWord(query);
    if (!w) { setRhymes(null); return; }
    let alive = true;
    setRhymes(null);
    setLoadingRhymes(true);
    const t = setTimeout(() => {
      findRhymes(w, dict).then((r) => { if (alive) { setRhymes(r); setLoadingRhymes(false); } });
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query, dict]);

  const insertWord = (word: string) => {
    const next = [...lines];
    const base = next[focused] ?? '';
    next[focused] = base.trim() ? `${base.replace(/\s+$/, '')} ${word}` : word.charAt(0).toUpperCase() + word.slice(1);
    setLyrics(section, next.join('\n'));
  };

  // ---- Line suggestions ----
  const endWords = useMemo(() => {
    const seen = new Set<string>();
    return lines.slice(0, Math.max(focused, 0) + 1).map(lastWord).reverse().filter((w) => w && !seen.has(w) && seen.add(w));
  }, [lyrics, section, focused]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rhymeWith, setRhymeWith] = useState<string>('auto');
  const rhymeTarget = rhymeWith === 'auto' ? lastWord(prevLine) : rhymeWith === 'none' ? '' : rhymeWith;
  const autoSyl = prevLine ? syllablesInLine(prevLine, dict) : 8;
  const [syl, setSyl] = useState<number | null>(null);
  const targetSyl = syl ?? autoSyl;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [engineUsed, setEngineUsed] = useState<'ai' | 'offline' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAI = ai.apiKey.trim().length > 0;

  const suggest = async () => {
    setBusy(true);
    setError(null);
    const mood = MOODS.find((m) => m.id === settings.mood)!;
    const sec = sections.find((s) => s.name === section);
    const flats = useFlats(settings.key, modeForMood(settings.mood));
    try {
      if (hasAI) {
        const res = await aiSuggest(ai, {
          title, theme, mood: mood.label, genre: GENRES.find((g) => g.id === settings.genre)!.label, section,
          chords: sec ? sec.chords.map((c) => chordSymbol(c, flats)).join(' ') : '',
          previousLines: lines.slice(0, focused + (current.trim() ? 1 : 0)),
          targetSyllables: targetSyl, rhymeWith: rhymeTarget || undefined, count: 4,
        }, dict);
        setSuggestions(res);
        setEngineUsed('ai');
      } else {
        const [rh, tw] = await Promise.all([
          rhymeTarget ? findRhymes(rhymeTarget, dict) : Promise.resolve({ results: [], source: 'offline' as const }),
          themeWords(theme),
        ]);
        setSuggestions(offlineSuggest({ mood: settings.mood, theme, themeWords: tw, rhymes: rh.results, targetSyllables: targetSyl, count: 4 }, dict));
        setEngineUsed('offline');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const addLine = (text: string) => {
    const next = [...lines];
    let at = focused;
    if ((next[focused] ?? '').trim()) {
      at = focused + 1;
      next.splice(at, 0, text);
    } else {
      next[focused] = text;
    }
    // leave an empty line after the new one, ready for the next idea
    if (next[at + 1] === undefined || next[at + 1].trim()) next.splice(at + 1, 0, '');
    setLyrics(section, next.join('\n'));
    onFocus(at + 1);
    toast('Line added to your lyrics');
  };

  const perfect = rhymes?.results.filter((r) => r.strength === 'perfect') ?? [];
  const near = rhymes?.results.filter((r) => r.strength === 'near') ?? [];

  return (
    <>
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="panel-head" style={{ padding: 0 }}>
          <h2 className="h-section">Rhymes</h2>
          {rhymes && <span className="source">{rhymes.source === 'datamuse' ? 'From Datamuse word API' : 'From built-in dictionary'}</span>}
        </div>
        <input
          className="input"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setTouched(e.target.value !== ''); }}
          placeholder="Type a word to rhyme"
          aria-label="Word to rhyme"
        />
        {loadingRhymes && query && <span className="small muted">Looking for rhymes…</span>}
        {!loadingRhymes && rhymes && rhymes.results.length === 0 && <span className="small muted">No rhymes found for “{query}”. Try a different ending word.</span>}
        {perfect.length > 0 && (
          <div className="rhyme-chips" aria-label="Perfect rhymes">
            {perfect.slice(0, 18).map((r) => (
              <button key={r.word} className="rhyme-chip" onClick={() => insertWord(r.word)} title="Add to the current line">
                {r.word}<small>{r.syllables}</small>
              </button>
            ))}
          </div>
        )}
        {near.length > 0 && (
          <>
            <span className="small muted">Near rhymes</span>
            <div className="rhyme-chips" aria-label="Near rhymes">
              {near.slice(0, 10).map((r) => (
                <button key={r.word} className="rhyme-chip near" onClick={() => insertWord(r.word)} title="Add to the current line">
                  {r.word}<small>{r.syllables}</small>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div className="panel-head" style={{ padding: 0 }}>
          <h2 className="h-section">Next-line ideas</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)}>
            <Plug size={13} /> {hasAI ? (ai.provider === 'gemini' ? 'Gemini connected' : 'AI connected') : 'Connect AI'}
          </button>
        </div>
        <div className="ctrl-row">
          <label className="field">
            <span>Rhyme with</span>
            <select className="select" value={rhymeWith} onChange={(e) => setRhymeWith(e.target.value)}>
              <option value="auto">Previous line{lastWord(prevLine) ? ` (${lastWord(prevLine)})` : ''}</option>
              {endWords.filter((w) => w !== lastWord(prevLine)).map((w) => <option key={w} value={w}>{w}</option>)}
              <option value="none">No rhyme</option>
            </select>
          </label>
          <label className="field" style={{ maxWidth: 96, minWidth: 80 }}>
            <span>Syllables</span>
            <input className="input" type="number" min={3} max={20} value={targetSyl} onChange={(e) => setSyl(Number(e.target.value) || null)} />
          </label>
        </div>
        <button className="btn btn-primary" onClick={suggest} disabled={busy} data-testid="suggest">
          {busy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} Suggest lines
        </button>
        {error && <div className="engine-note" style={{ color: 'var(--berry)' }}><Info size={14} /> {error}</div>}
        {suggestions.map((s, i) => (
          <div key={i} className="suggestion">
            <div>
              <p>{s.text}</p>
              <small>{s.syllables} syllables</small>
            </div>
            <button className="btn btn-sm" onClick={() => addLine(s.text)}>Use line</button>
          </div>
        ))}
        {engineUsed && (
          <div className="engine-note">
            <Info size={14} style={{ flex: 'none', marginTop: 2 }} />
            {engineUsed === 'ai'
              ? `Written by ${ai.model} using your song's title, theme, chords and previous lines.`
              : 'Offline mode: lines are assembled from templates, your theme and real rhymes. Connect an AI model for fully original lines.'}
          </div>
        )}
      </div>
      {showSettings && <AISettings onClose={() => setShowSettings(false)} />}
    </>
  );
}
