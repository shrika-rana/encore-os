import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  generateSong, regenerateSection, SongSection, SongSettings,
} from './lib/music/generator';
import { Chord } from './lib/music/theory';
import { AIConfig, DEFAULT_AI } from './lib/lyrics/cowriter';
import { OpenRole } from './lib/band/matching';
import { addMemberWithShare, Member } from './lib/band/splits';
import { MUSICIANS } from './lib/band/data';

export type Module = 'studio' | 'band';

export interface SavedSong {
  id: string;
  title: string;
  theme: string;
  settings: SongSettings;
  sections: SongSection[];
  lyrics: Record<string, string>;
  savedAt: number;
}

export type CandidateStatus = 'invited' | 'accepted' | 'declined';
export interface Candidate {
  musicianId: string;
  score: number;
  status: CandidateStatus;
  updatedAt: number;
}

interface State {
  module: Module;
  artistName: string;

  // Studio
  title: string;
  theme: string;
  settings: SongSettings;
  seed: number;
  sections: SongSection[];
  lyrics: Record<string, string>;
  library: SavedSong[];
  ai: AIConfig;

  // Band
  bandName: string;
  members: Member[];
  roles: OpenRole[];
  candidates: Record<string, Candidate[]>;
  agreementLockedAt: number | null;

  setModule: (m: Module) => void;
  setArtistName: (n: string) => void;
  setTitle: (t: string) => void;
  setTheme: (t: string) => void;
  updateSettings: (patch: Partial<SongSettings>) => void;
  generate: () => void;
  regenerate: (sectionId: string) => void;
  toggleLock: (sectionId: string, index: number) => void;
  replaceChord: (sectionId: string, index: number, chord: Chord) => void;
  setLyrics: (section: string, text: string) => void;
  saveSong: () => SavedSong;
  loadSong: (id: string) => void;
  deleteSong: (id: string) => void;
  setAI: (cfg: Partial<AIConfig>) => void;

  setBandName: (n: string) => void;
  addRole: (role: Omit<OpenRole, 'id' | 'createdAt' | 'status'>) => OpenRole;
  deleteRole: (id: string) => void;
  invite: (roleId: string, musicianId: string, score: number) => void;
  respond: (roleId: string, musicianId: string, status: CandidateStatus) => void;
  setShare: (memberId: string, share: number) => void;
  setMembers: (members: Member[]) => void;
  removeMember: (memberId: string) => void;
  lockAgreement: () => void;
  unlockAgreement: () => void;
  resetDemo: () => void;
}

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const DEFAULT_SETTINGS: SongSettings = { key: 7, mood: 'melancholic', genre: 'indie-pop', bpm: 84 };
const DEFAULT_SEED = 1307;

const DEMO_ROLE: OpenRole = {
  id: 'role-demo',
  title: 'Bassist for an indie rock four-piece',
  instrument: 'Bass',
  genres: ['Indie rock', 'Indie pop'],
  city: 'Mumbai',
  remoteOk: false,
  availability: ['Weekends'],
  commitment: 'Semi-pro',
  minYears: 3,
  split: 20,
  notes: 'Rehearsals in Andheri on Saturdays. First gig planned for January.',
  createdAt: Date.UTC(2026, 9, 28),
  status: 'open',
};

function initialState() {
  return {
    module: 'studio' as Module,
    artistName: 'You',
    title: 'Frost on the Window',
    theme: 'Missing someone through a long winter',
    settings: DEFAULT_SETTINGS,
    seed: DEFAULT_SEED,
    sections: generateSong(DEFAULT_SETTINGS, DEFAULT_SEED),
    lyrics: {
      Verse: 'Your coat still hangs behind the door\nThe kettle sings for two',
      'Pre-chorus': '',
      Chorus: '',
      Bridge: '',
    } as Record<string, string>,
    library: [] as SavedSong[],
    ai: DEFAULT_AI,
    bandName: 'Northbound',
    members: [{ id: 'me', name: 'You', role: 'Vocals & guitar', share: 100, isYou: true, joinedAt: Date.UTC(2026, 9, 1) }] as Member[],
    roles: [DEMO_ROLE],
    candidates: {} as Record<string, Candidate[]>,
    agreementLockedAt: null as number | null,
  };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initialState(),

      setModule: (module) => set({ module }),
      setArtistName: (artistName) =>
        set((s) => ({ artistName, members: s.members.map((m) => (m.isYou ? { ...m, name: artistName || 'You' } : m)) })),
      setTitle: (title) => set({ title }),
      setTheme: (theme) => set({ theme }),
      updateSettings: (patch) =>
        set((s) => {
          const settings = { ...s.settings, ...patch };
          // A new key transposes the song; a new mood or genre rewrites it
          if (patch.mood !== undefined && patch.mood !== s.settings.mood || patch.genre !== undefined && patch.genre !== s.settings.genre) {
            return { settings, sections: generateSong(settings, s.seed) };
          }
          if (patch.key !== undefined && patch.key !== s.settings.key) {
            const delta = (patch.key - s.settings.key + 12) % 12;
            return {
              settings,
              sections: s.sections.map((sec) => ({ ...sec, chords: sec.chords.map((c) => ({ ...c, root: (c.root + delta) % 12 })) })),
            };
          }
          return { settings };
        }),

      generate: () => {
        const seed = Math.floor(Math.random() * 1e9);
        set((s) => ({ seed, sections: generateSong(s.settings, seed) }));
      },
      regenerate: (sectionId) =>
        set((s) => ({
          sections: s.sections.map((sec) =>
            sec.id === sectionId ? regenerateSection(sec, s.settings, Math.floor(Math.random() * 1e9)) : sec,
          ),
        })),
      toggleLock: (sectionId, index) =>
        set((s) => ({
          sections: s.sections.map((sec) =>
            sec.id === sectionId ? { ...sec, locked: sec.locked.map((l, i) => (i === index ? !l : l)) } : sec,
          ),
        })),
      replaceChord: (sectionId, index, chord) =>
        set((s) => ({
          sections: s.sections.map((sec) =>
            sec.id === sectionId ? { ...sec, chords: sec.chords.map((c, i) => (i === index ? chord : c)) } : sec,
          ),
        })),
      setLyrics: (section, text) => set((s) => ({ lyrics: { ...s.lyrics, [section]: text } })),

      saveSong: () => {
        const s = get();
        const existing = s.library.find((x) => x.title === s.title);
        const song: SavedSong = {
          id: existing?.id ?? uid('song'),
          title: s.title || 'Untitled',
          theme: s.theme,
          settings: s.settings,
          sections: s.sections,
          lyrics: s.lyrics,
          savedAt: Date.now(),
        };
        set({ library: [song, ...s.library.filter((x) => x.id !== song.id)] });
        return song;
      },
      loadSong: (id) => {
        const song = get().library.find((x) => x.id === id);
        if (song) set({ title: song.title, theme: song.theme, settings: song.settings, sections: song.sections, lyrics: song.lyrics });
      },
      deleteSong: (id) => set((s) => ({ library: s.library.filter((x) => x.id !== id) })),
      setAI: (cfg) => set((s) => ({ ai: { ...s.ai, ...cfg } })),

      setBandName: (bandName) => set({ bandName }),
      addRole: (role) => {
        const full: OpenRole = { ...role, id: uid('role'), createdAt: Date.now(), status: 'open' };
        set((s) => ({ roles: [full, ...s.roles] }));
        return full;
      },
      deleteRole: (id) =>
        set((s) => {
          const candidates = { ...s.candidates };
          delete candidates[id];
          return { roles: s.roles.filter((r) => r.id !== id), candidates };
        }),
      invite: (roleId, musicianId, score) =>
        set((s) => {
          const list = s.candidates[roleId] ?? [];
          if (list.some((c) => c.musicianId === musicianId)) return {};
          return { candidates: { ...s.candidates, [roleId]: [...list, { musicianId, score, status: 'invited', updatedAt: Date.now() }] } };
        }),
      respond: (roleId, musicianId, status) =>
        set((s) => {
          const list = (s.candidates[roleId] ?? []).map((c) => (c.musicianId === musicianId ? { ...c, status, updatedAt: Date.now() } : c));
          const patch: Partial<State> = { candidates: { ...s.candidates, [roleId]: list } };
          if (status === 'accepted') {
            const role = s.roles.find((r) => r.id === roleId);
            const m = MUSICIANS.find((x) => x.id === musicianId);
            if (role && m && !s.members.some((x) => x.musicianId === m.id)) {
              patch.members = addMemberWithShare(
                s.members,
                { id: uid('mem'), name: m.name, role: role.instrument, musicianId: m.id, joinedAt: Date.now() },
                role.split,
              );
              patch.roles = s.roles.map((r) => (r.id === roleId ? { ...r, status: 'filled' } : r));
              patch.agreementLockedAt = null;
            }
          }
          return patch;
        }),
      setShare: (memberId, share) =>
        set((s) => ({ members: s.members.map((m) => (m.id === memberId ? { ...m, share } : m)), agreementLockedAt: null })),
      setMembers: (members) => set({ members, agreementLockedAt: null }),
      removeMember: (memberId) =>
        set((s) => ({ members: s.members.filter((m) => m.id !== memberId || m.isYou), agreementLockedAt: null })),
      lockAgreement: () => set({ agreementLockedAt: Date.now() }),
      unlockAgreement: () => set({ agreementLockedAt: null }),
      resetDemo: () => set({ ...initialState(), ai: get().ai }),
    }),
    { name: 'encore-os-v1', version: 1 },
  ),
);
