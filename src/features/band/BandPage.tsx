import { useMemo, useState } from 'react';
import {
  Check, ChevronDown, ChevronUp, Download, FileSignature, Plus, Search, Trash2, UserPlus, X,
} from 'lucide-react';
import { useStore } from '../../store';
import { MUSICIANS } from '../../lib/band/data';
import { matchLabel, MatchResult, OpenRole, rankCandidates } from '../../lib/band/matching';
import { checkSplits, evenSplit, splitSheet } from '../../lib/band/splits';
import { downloadText, slug } from '../../lib/songSheet';
import { Avatar, ScoreRing } from '../../components/ScoreRing';
import { RoleForm } from './RoleForm';
import { toast } from '../../components/toast';

const MEMBER_COLOURS = ['var(--spruce)', 'var(--glacier-deep)', 'var(--berry)', 'var(--glacier)', 'var(--amber)', '#5b4a87'];

export function BandPage() {
  const bandName = useStore((s) => s.bandName);
  const setBandName = useStore((s) => s.setBandName);
  const roles = useStore((s) => s.roles);
  const members = useStore((s) => s.members);
  const addRole = useStore((s) => s.addRole);
  const [selected, setSelected] = useState<string | null>(roles[0]?.id ?? null);
  const [showForm, setShowForm] = useState(false);
  const role = roles.find((r) => r.id === selected) ?? roles[0] ?? null;
  const openCount = roles.filter((r) => r.status === 'open').length;

  return (
    <>
      <header className="topbar">
        <div className="studio-head">
          <input className="title-input" value={bandName} onChange={(e) => setBandName(e.target.value)} aria-label="Band name" />
          <span className="subtitle-input" style={{ display: 'block' }}>
            {members.length} member{members.length === 1 ? '' : 's'} · {openCount} open role{openCount === 1 ? '' : 's'} · {MUSICIANS.length} musicians in the demo talent pool
          </span>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setShowForm(true)} data-testid="new-role"><Plus size={15} /> Post a role</button>
        </div>
      </header>

      <div className="page">
        <div className="band-grid">
          <div className="band-side">
          <section aria-label="Your open roles" style={{ display: 'grid', gap: 10 }}>
            <h2 className="h-section">Your roles</h2>
            <div className="roles">
              {roles.length === 0 && (
                <div className="panel empty">
                  <b>No roles yet</b>
                  <span>Post the role your band is missing and we'll rank musicians who fit.</span>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}><Plus size={14} /> Post a role</button>
                </div>
              )}
              {roles.map((r) => <RoleCard key={r.id} role={r} active={role?.id === r.id} onSelect={() => setSelected(r.id)} />)}
            </div>
          </section>
          <BandRoster />
          </div>

          <section className="panel" aria-label="Matches">
            {role ? <RoleMatches role={role} onDeleted={() => setSelected(null)} /> : (
              <div className="empty"><b>Pick or post a role</b><span>Matches appear here, ranked and explained.</span></div>
            )}
          </section>
        </div>
      </div>

      {showForm && (
        <RoleForm
          onClose={() => setShowForm(false)}
          onSubmit={(d) => {
            const r = addRole(d);
            setSelected(r.id);
            setShowForm(false);
            const n = rankCandidates(r, MUSICIANS, 40).length;
            toast(`Role posted. ${n} musician${n === 1 ? '' : 's'} match at 40 or above.`);
          }}
        />
      )}
    </>
  );
}

function RoleCard({ role, active, onSelect }: { role: OpenRole; active: boolean; onSelect: () => void }) {
  const cands = useStore((s) => s.candidates[role.id] ?? []);
  const invited = cands.filter((c) => c.status === 'invited').length;
  return (
    <button className="role-card" aria-current={active} onClick={onSelect}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span className={`status ${role.status}`}>{role.status === 'open' ? 'Open' : 'Filled'}</span>
        <span className="small muted">{role.split}% share</span>
      </div>
      <b>{role.title}</b>
      <div className="role-meta">
        <span className="chip chip-spruce">{role.instrument}</span>
        <span className="chip">{role.city}{role.remoteOk ? ' or remote' : ''}</span>
      </div>
      {cands.length > 0 && (
        <span className="small muted">{cands.length} invited{invited ? `, ${invited} waiting for a reply` : ''}</span>
      )}
    </button>
  );
}

function RoleMatches({ role, onDeleted }: { role: OpenRole; onDeleted: () => void }) {
  const deleteRole = useStore((s) => s.deleteRole);
  const [minScore, setMinScore] = useState(40);
  const [query, setQuery] = useState('');
  const [sameCity, setSameCity] = useState(false);
  const [limit, setLimit] = useState(8);

  const ranked = useMemo(() => rankCandidates(role, MUSICIANS), [role]);
  const shown = ranked.filter((r) =>
    r.score >= minScore &&
    (!sameCity || r.musician.city === role.city) &&
    (!query || r.musician.name.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div className="role-detail">
      <div className="panel-head" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <h2 className="h-section" style={{ fontSize: 21 }}>{role.title}</h2>
          <div className="role-facts">
            <span className="chip chip-spruce">{role.instrument}</span>
            {role.genres.map((g) => <span key={g} className="chip chip-glacier">{g}</span>)}
            <span className="chip">{role.city}{role.remoteOk ? ' or remote' : ''}</span>
            <span className="chip">{role.availability.join(', ')}</span>
            <span className="chip">{role.commitment}</span>
            <span className="chip">{role.minYears}+ years</span>
            <span className="chip">{role.split}% revenue share</span>
          </div>
          {role.notes && <p className="muted" style={{ margin: 0 }}>{role.notes}</p>}
        </div>
        <button className="icon-btn" aria-label="Delete role" title="Delete role" onClick={() => { deleteRole(role.id); onDeleted(); toast('Role deleted', 'info'); }}>
          <Trash2 size={15} />
        </button>
      </div>
      <div className="panel-body" style={{ paddingTop: 0 }}>
        <div className="filters">
          <label style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 9, color: 'var(--ink-3)' }} />
            <input className="input" style={{ paddingLeft: 28 }} placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search musicians" />
          </label>
          <label>
            Minimum score
            <input type="range" min={0} max={90} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} aria-label="Minimum match score" />
            <b style={{ width: 22, fontVariantNumeric: 'tabular-nums' }}>{minScore}</b>
          </label>
          <label><input type="checkbox" checked={sameCity} onChange={(e) => setSameCity(e.target.checked)} /> Only {role.city}</label>
          <span className="small muted" style={{ marginLeft: 'auto' }}>{shown.length} of {ranked.length} who play {role.instrument.toLowerCase()}</span>
        </div>
        {role.status === 'filled' && (
          <div className="agreement" style={{ marginTop: 12 }}>This role is filled. Post another role to keep building the band.</div>
        )}
        <div style={{ marginTop: 6 }}>
          {shown.length === 0 && (
            <div className="empty">
              <b>No one matches these filters</b>
              <span>Lower the minimum score or allow other cities.</span>
            </div>
          )}
          {shown.slice(0, limit).map((m, i) => <MatchRow key={m.musician.id} role={role} match={m} top={i === 0 && minScore <= m.score} />)}
          {shown.length > limit && (
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 6 }} onClick={() => setLimit((l) => l + 8)}>
              Show {Math.min(8, shown.length - limit)} more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchRow({ role, match, top }: { role: OpenRole; match: MatchResult; top: boolean }) {
  const invite = useStore((s) => s.invite);
  const cand = useStore((s) => s.candidates[role.id]?.find((c) => c.musicianId === match.musician.id));
  const [open, setOpen] = useState(false);
  const m = match.musician;
  const reasons = [...match.factors].filter((f) => f.points > 0).sort((a, b) => b.points / b.max - a.points / a.max).slice(0, 3);

  return (
    <div className="match" data-testid="match-row">
      <ScoreRing score={match.score} />
      <div className="who">
        <div className="who-line">
          <Avatar name={m.name} hue={m.hue} />
          <strong>{m.name}</strong>
          <span className="small muted">{m.instruments.join(' & ')} · {m.city} · {m.years} yr{m.years === 1 ? '' : 's'} · {m.gigs} gig{m.gigs === 1 ? '' : 's'}</span>
          {top && <span className="chip chip-berry">Best fit</span>}
        </div>
        <div className="reasons">
          <span className="small" style={{ fontWeight: 600 }}>{matchLabel(match.score)}:</span>
          {reasons.map((f) => <span key={f.factor} className="chip">{f.note}</span>)}
        </div>
        <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start', padding: '2px 6px' }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Why this score
        </button>
        {open && (
          <div className="breakdown">
            {match.factors.map((f) => (
              <div key={f.factor} className="bd-row">
                <span>{f.factor}</span>
                <div className="bd-track"><div className="bd-fill" style={{ width: `${(f.points / f.max) * 100}%` }} /></div>
                <span className="bd-pts">{f.points}/{f.max}</span>
                <span className="bd-note small">{f.note}</span>
              </div>
            ))}
            <span className="small muted">Influences: {m.influences.join(', ')}. “{m.bio}”</span>
          </div>
        )}
      </div>
      <div className="match-actions">
        {!cand && (
          <button className="btn btn-sm btn-primary" disabled={role.status === 'filled'} onClick={() => { invite(role.id, m.id, match.score); toast(`Invitation sent to ${m.name}`, 'info'); }}>
            <UserPlus size={14} /> Invite
          </button>
        )}
        {cand?.status === 'invited' && <span className="pending"><span className="dot" /> Waiting for reply</span>}
        {cand?.status === 'accepted' && <span className="chip chip-spruce"><Check size={13} /> Joined the band</span>}
        {cand?.status === 'declined' && <span className="chip"><X size={13} /> Declined</span>}
        <span className="small muted">Replies to {Math.round(m.responseRate * 100)}% of invites</span>
      </div>
    </div>
  );
}

function BandRoster() {
  const bandName = useStore((s) => s.bandName);
  const members = useStore((s) => s.members);
  const setShare = useStore((s) => s.setShare);
  const setMembers = useStore((s) => s.setMembers);
  const removeMember = useStore((s) => s.removeMember);
  const lockedAt = useStore((s) => s.agreementLockedAt);
  const lock = useStore((s) => s.lockAgreement);
  const unlock = useStore((s) => s.unlockAgreement);
  const check = checkSplits(members);

  return (
    <section className="panel" aria-label="Band and splits">
      <div className="panel-head"><h2 className="h-section">Band & splits</h2><span className="small muted">{members.length} member{members.length === 1 ? '' : 's'}</span></div>
      <div className="panel-body roster">
        <div className="share-bar" aria-hidden>
          {members.map((m, i) => <span key={m.id} style={{ width: `${Math.max(0, m.share)}%`, background: MEMBER_COLOURS[i % MEMBER_COLOURS.length] }} />)}
        </div>
        {members.map((m, i) => {
          const musician = MUSICIANS.find((x) => x.id === m.musicianId);
          return (
            <div key={m.id} className="member">
              {musician ? <Avatar name={m.name} hue={musician.hue} /> : <span className="avatar" style={{ background: MEMBER_COLOURS[i % MEMBER_COLOURS.length] }}>{m.name.slice(0, 1).toUpperCase()}</span>}
              <div className="nm">
                <b>{m.name}{m.isYou && m.name !== 'You' ? ' (you)' : ''}</b>
                <span>{m.role}</span>
              </div>
              <div className="share-input">
                <input
                  type="number" min={0} max={100} step={0.5} value={m.share} disabled={!!lockedAt}
                  onChange={(e) => setShare(m.id, Number(e.target.value))} aria-label={`${m.name} share in percent`}
                />
                <span className="small muted">%</span>
              </div>
              {!m.isYou && !lockedAt ? (
                <button className="icon-btn" aria-label={`Remove ${m.name}`} onClick={() => removeMember(m.id)}><X size={14} /></button>
              ) : <span />}
            </div>
          );
        })}
        <div className={`split-status ${check.valid ? 'ok' : 'bad'}`}>
          {check.valid ? <Check size={15} /> : <X size={15} />} {check.message}
        </div>
        {members.length === 1 && (
          <p className="small muted" style={{ margin: 0 }}>Invite musicians from a role. When someone accepts, they join with the share you offered and everyone else's share scales down to make room.</p>
        )}
        {!lockedAt ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={() => setMembers(evenSplit(members))} disabled={members.length < 2}>Split evenly</button>
            <button className="btn btn-sm btn-primary" disabled={!check.valid || members.length < 2} onClick={() => { lock(); toast('Split agreement locked'); }}>
              <FileSignature size={14} /> Lock agreement
            </button>
          </div>
        ) : (
          <div className="agreement">
            <b>Agreement locked on {new Date(lockedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
            <span>Every song this band releases will pay out using these shares. Changing a share unlocks the agreement.</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={() => { downloadText(`${slug(bandName)}-split-sheet.txt`, splitSheet(bandName, members)); toast('Split sheet downloaded'); }}>
                <Download size={14} /> Download split sheet
              </button>
              <button className="btn btn-sm btn-ghost" onClick={unlock}>Edit shares</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
