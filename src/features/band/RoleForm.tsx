import { useState } from 'react';
import { Modal } from '../../components/Modal';
import {
  AVAILABILITY, Availability, BAND_GENRES, BandGenre, CITIES, COMMITMENTS, Commitment, Instrument, INSTRUMENTS,
} from '../../lib/band/data';
import { OpenRole } from '../../lib/band/matching';

type Draft = Omit<OpenRole, 'id' | 'createdAt' | 'status'>;

const EMPTY: Draft = {
  title: '',
  instrument: 'Drums',
  genres: ['Indie rock'],
  city: 'Mumbai',
  remoteOk: false,
  availability: ['Weekends'],
  commitment: 'Semi-pro',
  minYears: 2,
  split: 20,
  notes: '',
};

function defaultTitle(d: Draft): string {
  const g = (d.genres[0] ?? 'new').toLowerCase();
  const names: Record<Instrument, string> = {
    Vocals: 'Vocalist', Guitar: 'Guitarist', Bass: 'Bassist', Drums: 'Drummer', Keys: 'Keys player', Violin: 'Violinist',
    Tabla: 'Tabla player', Flute: 'Flautist', Saxophone: 'Saxophonist', Producer: 'Producer',
  };
  const who = names[d.instrument];
  return `${who} for ${/^[aeiou]/.test(g) ? 'an' : 'a'} ${g} project`;
}

export function RoleForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>(EMPTY);
  const [tried, setTried] = useState(false);
  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const errors: string[] = [];
  if (d.genres.length === 0) errors.push('Pick at least one genre.');
  if (d.availability.length === 0) errors.push('Pick at least one time you rehearse.');
  if (d.split < 0 || d.split > 60) errors.push('Revenue share should be between 0% and 60%.');

  const submit = () => {
    setTried(true);
    if (errors.length) return;
    onSubmit({ ...d, title: d.title.trim() || defaultTitle(d) });
  };

  return (
    <Modal
      title="Post an open role"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} data-testid="post-role">Post role and find matches</button>
        </>
      }
    >
      <label className="field">
        <span>Role title</span>
        <input className="input" value={d.title} onChange={(e) => patch({ title: e.target.value })} placeholder={defaultTitle(d)} />
      </label>
      <div className="grid-2">
        <label className="field">
          <span>Instrument needed</span>
          <select className="select" value={d.instrument} onChange={(e) => patch({ instrument: e.target.value as Instrument })} data-testid="role-instrument">
            {INSTRUMENTS.map((i) => <option key={i}>{i}</option>)}
          </select>
        </label>
        <label className="field">
          <span>City</span>
          <select className="select" value={d.city} onChange={(e) => patch({ city: e.target.value })}>
            {CITIES.map((c) => <option key={c.name}>{c.name}</option>)}
          </select>
        </label>
      </div>
      <div className="field">
        <span>Genres</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {BAND_GENRES.map((g) => (
            <button key={g} type="button" className="chip chip-toggle" aria-pressed={d.genres.includes(g)} onClick={() => patch({ genres: toggle<BandGenre>(d.genres, g) })}>{g}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>When you rehearse</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {AVAILABILITY.map((a) => (
            <button key={a} type="button" className="chip chip-toggle" aria-pressed={d.availability.includes(a)} onClick={() => patch({ availability: toggle<Availability>(d.availability, a) })}>{a}</button>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <label className="field">
          <span>Commitment</span>
          <select className="select" value={d.commitment} onChange={(e) => patch({ commitment: e.target.value as Commitment })}>
            {COMMITMENTS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Minimum years playing</span>
          <input className="input" type="number" min={0} max={20} value={d.minYears} onChange={(e) => patch({ minYears: Math.max(0, Number(e.target.value)) })} />
        </label>
      </div>
      <div className="grid-2">
        <label className="field">
          <span>Revenue share offered (%)</span>
          <input className="input" type="number" min={0} max={60} value={d.split} onChange={(e) => patch({ split: Number(e.target.value) })} />
        </label>
        <label className="field" style={{ alignSelf: 'end' }}>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
            <input type="checkbox" checked={d.remoteOk} onChange={(e) => patch({ remoteOk: e.target.checked })} />
            Open to musicians in other cities (remote)
          </span>
        </label>
      </div>
      <label className="field">
        <span>Notes for applicants</span>
        <textarea className="input" rows={2} value={d.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Where you rehearse, songs you have, gigs coming up…" />
      </label>
      {tried && errors.length > 0 && <div className="engine-note" style={{ color: 'var(--berry)' }}>{errors.join(' ')}</div>}
    </Modal>
  );
}
