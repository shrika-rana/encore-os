import { useEffect, useRef, useState } from 'react';
import {
  AudioLines, CalendarDays, Disc3, RotateCcw, Users, Wallet,
} from 'lucide-react';
import { Module, useStore } from './store';
import { StudioPage } from './features/studio/StudioPage';
import { BandPage } from './features/band/BandPage';
import { Toasts, toast } from './components/toast';
import { MUSICIANS } from './lib/band/data';
import { willAccept } from './lib/band/responses';

const LIVE: { id: Module; label: string; desc: string; icon: JSX.Element }[] = [
  { id: 'studio', label: 'Song Studio', desc: 'Write chords & lyrics with AI', icon: <AudioLines size={18} /> },
  { id: 'band', label: 'Band Finder', desc: 'Fill roles, build your band', icon: <Users size={18} /> },
];
const PLANNED = [
  { label: 'Release', icon: <Disc3 size={18} /> },
  { label: 'Stage', icon: <CalendarDays size={18} /> },
  { label: 'Earn', icon: <Wallet size={18} /> },
];

/** Demo musicians answer invitations on their own after a short delay */
function useInviteResponder() {
  const scheduled = useRef(new Set<string>());
  const candidates = useStore((s) => s.candidates);
  const respond = useStore((s) => s.respond);
  useEffect(() => {
    for (const [roleId, list] of Object.entries(candidates)) {
      for (const c of list) {
        const key = `${roleId}:${c.musicianId}`;
        if (c.status !== 'invited' || scheduled.current.has(key)) continue;
        scheduled.current.add(key);
        const m = MUSICIANS.find((x) => x.id === c.musicianId);
        const delay = 2200 + Math.random() * 2800;
        window.setTimeout(() => {
          const state = useStore.getState();
          const role = state.roles.find((r) => r.id === roleId);
          const still = state.candidates[roleId]?.find((x) => x.musicianId === c.musicianId);
          if (!role || still?.status !== 'invited') return;
          if (role.status === 'filled') {
            respond(roleId, c.musicianId, 'declined');
            return;
          }
          const accepted = willAccept(roleId, c.musicianId, c.score, m?.responseRate ?? 0.8);
          respond(roleId, c.musicianId, accepted ? 'accepted' : 'declined');
          toast(
            accepted ? `${m?.name} accepted and joined ${state.bandName}` : `${m?.name} declined the ${role.instrument.toLowerCase()} role`,
            accepted ? 'ok' : 'info',
          );
        }, delay);
      }
    }
  }, [candidates, respond]);
}

export default function App() {
  const module = useStore((s) => s.module);
  const setModule = useStore((s) => s.setModule);
  const artistName = useStore((s) => s.artistName);
  const setArtistName = useStore((s) => s.setArtistName);
  const resetDemo = useStore((s) => s.resetDemo);
  const [confirmReset, setConfirmReset] = useState(false);
  useInviteResponder();

  return (
    <div className="shell">
      <nav className="rail" aria-label="Modules">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M14 3H4v12h10M4 9h8" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" /></svg>
          </div>
          <div>
            <div className="brand-name">ENCORE OS</div>
            <div className="brand-sub">Prototype v0.2</div>
          </div>
        </div>
        <div className="rail-group">Working now</div>
        {LIVE.map((m) => (
          <button key={m.id} className="rail-item" aria-current={module === m.id ? 'page' : undefined} onClick={() => setModule(m.id)}>
            {m.icon}
            <span>
              {m.label}
              <span className="rail-desc">{m.desc}</span>
            </span>
          </button>
        ))}
        <div className="rail-group">On the roadmap</div>
        {PLANNED.map((p) => (
          <div key={p.label} className="rail-item planned" title="Planned for a later version">
            {p.icon}
            <span>{p.label}</span>
            <span className="tag-planned">Planned</span>
          </div>
        ))}
        <div className="rail-foot">
          <label htmlFor="artist">Your artist name</label>
          <input id="artist" value={artistName} onChange={(e) => setArtistName(e.target.value)} maxLength={28} />
          <button
            className="rail-reset"
            onBlur={() => setConfirmReset(false)}
            onClick={() => {
              if (!confirmReset) { setConfirmReset(true); return; }
              resetDemo();
              setConfirmReset(false);
              toast('Demo reset to its starting state', 'info');
            }}
          >
            <RotateCcw size={13} /> {confirmReset ? 'Click again to clear everything' : 'Reset demo data'}
          </button>
        </div>
      </nav>
      <main className="main">{module === 'studio' ? <StudioPage /> : <BandPage />}</main>
      <Toasts />
    </div>
  );
}
