import { useEffect, useState } from 'react';
import { Download, Pause, Play, Save, Shuffle, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { GENRES, MOODS, modeForMood } from '../../lib/music/generator';
import { chordSymbol, keyLabel, KEYS, noteName, useFlats, voiceChord } from '../../lib/music/theory';
import { player, PlaybackStep } from '../../lib/music/audio';
import { useDictionary } from '../../lib/lyrics/useDictionary';
import { downloadText, slug, songSheet } from '../../lib/songSheet';
import { ChordTimeline } from './ChordTimeline';
import { Keyboard } from './Keyboard';
import { LyricsEditor } from './LyricsEditor';
import { CoWriter } from './CoWriter';
import { toast } from '../../components/toast';

export function StudioPage() {
  const s = useStore();
  const dict = useDictionary();
  const [step, setStep] = useState<PlaybackStep | null>(null);
  const [stepKey, setStepKey] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null); // 'song' | section id
  const [lyricSection, setLyricSection] = useState('Verse');
  const [focused, setFocused] = useState(1);

  const mode = modeForMood(s.settings.mood);
  const flats = useFlats(s.settings.key, mode);

  useEffect(() => {
    player.onStep((st) => {
      setStep(st);
      setStepKey((k) => k + 1);
      if (!st) setPlaying(null);
    });
    return () => player.stop();
  }, []);

  const begin = (which: string) => {
    const steps: PlaybackStep[] = [];
    s.sections.forEach((sec, si) => {
      if (which !== 'song' && sec.id !== which) return;
      sec.chords.forEach((chord, ci) => steps.push({ sectionIndex: si, chordIndex: ci, chord }));
    });
    player.play(steps, s.settings.bpm, true);
    setPlaying(which);
  };
  const start = (which: string) => {
    if (playing === which) player.stop();
    else begin(which);
  };

  // Restart playback with fresh chords when the progression changes mid-play
  useEffect(() => {
    if (playing) {
      begin(playing);
    }
  }, [s.sections, s.settings.bpm]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = step?.chord ?? s.sections[0]?.chords[0];
  const voicing = shown ? voiceChord(shown) : null;
  const totalBars = s.sections.reduce((a, sec) => a + sec.chords.length, 0);
  const seconds = Math.round(totalBars * (60 / s.settings.bpm) * 4);

  const save = () => {
    const song = s.saveSong();
    toast(`Saved “${song.title}” to your library`);
  };
  const exportSheet = () => {
    downloadText(`${slug(s.title)}-song-sheet.txt`, songSheet(s.title, s.theme, s.settings, s.sections, s.lyrics, s.artistName));
    toast('Song sheet downloaded');
  };

  return (
    <>
      <header className="topbar">
        <div className="studio-head">
          <input className="title-input" value={s.title} onChange={(e) => s.setTitle(e.target.value)} aria-label="Song title" placeholder="Untitled song" />
          <input className="subtitle-input" value={s.theme} onChange={(e) => s.setTheme(e.target.value)} aria-label="What the song is about" placeholder="What is this song about?" />
        </div>
        <div className="head-actions">
          <button className="btn" onClick={exportSheet}><Download size={15} /> Export song sheet</button>
          <button className="btn btn-primary" onClick={save}><Save size={15} /> Save song</button>
        </div>
      </header>

      <div className="page">
        <section className="panel setup" aria-label="Song settings">
          <label className="field">
            <span>Key</span>
            <select className="select" value={s.settings.key} onChange={(e) => s.updateSettings({ key: Number(e.target.value) })}>
              {KEYS.map((k) => <option key={k} value={k}>{noteName(k, useFlats(k, mode))}</option>)}
            </select>
          </label>
          <div className="field">
            <span>Mood</span>
            <div className="segmented" role="group" aria-label="Mood">
              {MOODS.map((m) => (
                <button key={m.id} aria-pressed={s.settings.mood === m.id} onClick={() => s.updateSettings({ mood: m.id })} title={m.hint}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Genre</span>
            <select className="select" value={s.settings.genre} onChange={(e) => s.updateSettings({ genre: e.target.value as typeof s.settings.genre })}>
              {GENRES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </label>
          <div className="field bpm-field">
            <span>Tempo</span>
            <div className="bpm-row">
              <input type="range" min={60} max={160} value={s.settings.bpm} onChange={(e) => s.updateSettings({ bpm: Number(e.target.value) })} aria-label="Tempo in BPM" style={{ flex: 1 }} />
              <output>{s.settings.bpm} bpm</output>
            </div>
          </div>
          <div className="spacer" />
          <button className="btn btn-berry" onClick={() => { s.generate(); toast('New progression written'); }} data-testid="generate">
            <Shuffle size={15} /> Write new progression
          </button>
        </section>

        <section className="panel stage" aria-label="Chord progression">
          <div className="timeline">
            <div className="transport">
              <button className={`play-btn${playing === 'song' ? ' playing' : ''}`} onClick={() => start('song')} aria-label={playing === 'song' ? 'Stop' : 'Play the whole song'} data-testid="play">
                {playing === 'song' ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: 3 }} />}
              </button>
              <div className="transport-meta">
                <strong>{playing ? 'Playing' : 'Play the progression'}</strong>
                <span className="small muted">{keyLabel(s.settings.key, mode)} · {totalBars} bars · about {seconds}s per pass</span>
              </div>
            </div>
            <ChordTimeline step={step} stepKey={stepKey} playingSection={playing === 'song' ? null : playing} onPlaySection={start} />
            <p className="small muted" style={{ margin: 0 }}>Click any chord to swap it, hear it or lock it. Locked chords stay when you rewrite a section.</p>
          </div>
          <aside className="side" aria-label="Now playing">
            <div>
              <div className="small muted">{step ? `${s.sections[step.sectionIndex]?.name}, bar ${step.chordIndex + 1}` : 'First chord'}</div>
              <div className={`now-chord${step ? '' : ' idle'}`}>{shown ? chordSymbol(shown, flats) : '—'}</div>
              <div className="small" style={{ color: 'var(--glacier-deep)' }}>{shown?.roman} {shown ? `· ${shown.fn === 'borrowed' ? 'borrowed colour' : `${shown.fn} function`}` : ''}</div>
            </div>
            <Keyboard notes={voicing?.upper ?? []} bass={voicing?.bass ?? null} />
            <div className="key-legend">
              <span><i style={{ background: 'var(--glacier)' }} />Chord tones</span>
              <span><i style={{ background: 'var(--spruce)' }} />Bass note</span>
            </div>
          </aside>
        </section>

        <section className="panel writer" aria-label="Lyric writing">
          <div className="lyrics">
            <LyricsEditor dict={dict} section={lyricSection} onSection={setLyricSection} focused={focused} onFocus={setFocused} />
          </div>
          <div className="cowriter">
            <CoWriter dict={dict} section={lyricSection} focused={focused} onFocus={setFocused} />
          </div>
        </section>

        {s.library.length > 0 && (
          <section className="panel">
            <div className="panel-head"><h2 className="h-section">Your songs</h2><span className="small muted">{s.library.length} saved</span></div>
            <div className="panel-body library">
              {s.library.map((song) => (
                <div key={song.id} className="song-card">
                  <b>{song.title}</b>
                  <span className="small muted">{keyLabel(song.settings.key, modeForMood(song.settings.mood))} · {song.settings.bpm} bpm</span>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button className="btn btn-sm" onClick={() => { s.loadSong(song.id); toast(`Opened “${song.title}”`, 'info'); }}>Open</button>
                    <button className="icon-btn" aria-label={`Delete ${song.title}`} onClick={() => s.deleteSong(song.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
