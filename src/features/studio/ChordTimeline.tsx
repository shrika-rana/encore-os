import { useEffect, useRef, useState } from 'react';
import { Lock, LockOpen, Play, RefreshCw, Square } from 'lucide-react';
import { useStore } from '../../store';
import { modeForMood, substitutionsFor } from '../../lib/music/generator';
import { Chord, chordSymbol, useFlats } from '../../lib/music/theory';
import { player, PlaybackStep } from '../../lib/music/audio';

interface Props {
  step: PlaybackStep | null;
  stepKey: number;
  playingSection: string | null;
  onPlaySection: (sectionId: string) => void;
}

const SECTION_HINT: Record<string, string> = {
  Verse: 'Tells the story',
  'Pre-chorus': 'Builds the lift',
  Chorus: 'The hook',
  Bridge: 'A turn before the end',
};

export function ChordTimeline({ step, stepKey, playingSection, onPlaySection }: Props) {
  const sections = useStore((s) => s.sections);
  const settings = useStore((s) => s.settings);
  const regenerate = useStore((s) => s.regenerate);
  const flats = useFlats(settings.key, modeForMood(settings.mood));
  const barSeconds = (60 / settings.bpm) * 4;
  const [open, setOpen] = useState<{ sectionId: string; index: number; rect: DOMRect } | null>(null);

  return (
    <div className="timeline-rows" style={{ display: 'grid', gap: 12 }}>
      {sections.map((sec, si) => (
        <div className="sec-row" key={sec.id}>
          <div className="sec-name">
            {sec.name}
            <small>{SECTION_HINT[sec.name]}</small>
          </div>
          <div className="chords">
            {sec.chords.map((c, ci) => {
              const active = step?.sectionIndex === si && step?.chordIndex === ci;
              return (
                <button
                  key={ci}
                  className={`chord${active ? ' active' : ''}${sec.locked[ci] ? ' locked' : ''}`}
                  onClick={(e) => setOpen({ sectionId: sec.id, index: ci, rect: e.currentTarget.getBoundingClientRect() })}
                  aria-label={`${sec.name} chord ${ci + 1}: ${chordSymbol(c, flats)} (${c.roman}). Click to change.`}
                  data-testid={`chord-${sec.name}-${ci}`}
                >
                  <span className="sym">{chordSymbol(c, flats)}</span>
                  <span className="rn">{c.roman}</span>
                  {sec.locked[ci] && <Lock size={12} className="lock" />}
                  {active && <span key={stepKey} className="bar" style={{ animationDuration: `${barSeconds}s` }} />}
                </button>
              );
            })}
          </div>
          <div className="sec-tools">
            <button
              className="icon-btn"
              onClick={() => onPlaySection(sec.id)}
              aria-label={playingSection === sec.id ? `Stop ${sec.name}` : `Loop ${sec.name}`}
              title={playingSection === sec.id ? 'Stop' : `Loop the ${sec.name.toLowerCase()}`}
            >
              {playingSection === sec.id ? <Square size={15} /> : <Play size={15} />}
            </button>
            <button
              className="icon-btn"
              onClick={() => regenerate(sec.id)}
              aria-label={`New chords for ${sec.name}`}
              title="New chords (locked chords stay)"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      ))}
      {open && <SubPopover {...open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SubPopover({ sectionId, index, rect, onClose }: { sectionId: string; index: number; rect: DOMRect; onClose: () => void }) {
  const section = useStore((s) => s.sections.find((x) => x.id === sectionId))!;
  const settings = useStore((s) => s.settings);
  const replaceChord = useStore((s) => s.replaceChord);
  const toggleLock = useStore((s) => s.toggleLock);
  const ref = useRef<HTMLDivElement>(null);
  const chord = section.chords[index];
  const flats = useFlats(settings.key, modeForMood(settings.mood));
  const groups = substitutionsFor(chord, settings);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => window.addEventListener('mousedown', onDown), 0);
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const width = 330;
  const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
  const below = rect.bottom + 8;
  const top = below + 380 > window.innerHeight ? Math.max(12, rect.top - 388) : below;

  const choose = (c: Chord) => {
    replaceChord(sectionId, index, c);
    player.preview(c);
  };

  return (
    <div className="popover" ref={ref} style={{ left, top, width }} role="dialog" aria-label="Change chord">
      {groups.map((g) => (
        <div key={g.label}>
          <h4>{g.label}</h4>
          <div className="sub-grid">
            {g.chords.slice(0, 9).map((c, i) => (
              <button key={i} className="sub-chord" onClick={() => choose(c)}>
                <b>{chordSymbol(c, flats)}</b>
                <span>{c.roman}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="pop-actions">
        <button className="btn btn-sm" onClick={() => player.preview(chord)}>
          <Play size={13} /> Hear {chordSymbol(chord, flats)}
        </button>
        <button className="btn btn-sm" onClick={() => toggleLock(sectionId, index)}>
          {section.locked[index] ? <><LockOpen size={13} /> Unlock</> : <><Lock size={13} /> Lock chord</>}
        </button>
      </div>
    </div>
  );
}
