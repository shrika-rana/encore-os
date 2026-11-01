// Explainable bandmate matching. Every score is the sum of six weighted
// factors so the writer can see exactly why someone was suggested.

import {
  Availability, BandGenre, COMMITMENTS, Commitment, Instrument, Musician, regionOf,
} from './data';

export interface OpenRole {
  id: string;
  title: string;
  instrument: Instrument;
  genres: BandGenre[];
  city: string;
  remoteOk: boolean;
  availability: Availability[];
  commitment: Commitment;
  minYears: number;
  split: number; // % revenue share offered
  notes: string;
  createdAt: number;
  status: 'open' | 'filled';
}

export interface FactorScore {
  factor: 'Instrument' | 'Genre' | 'Location' | 'Availability' | 'Commitment' | 'Experience';
  points: number;
  max: number;
  note: string;
}

export interface MatchResult {
  musician: Musician;
  score: number; // 0..100
  factors: FactorScore[];
  eligible: boolean; // plays the instrument at all
}

export const WEIGHTS = {
  Instrument: 35,
  Genre: 25,
  Location: 15,
  Availability: 10,
  Commitment: 10,
  Experience: 5,
} as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreMusician(role: OpenRole, m: Musician): MatchResult {
  const factors: FactorScore[] = [];

  // Instrument — primary instrument counts fully, a secondary one counts 60%
  const insIdx = m.instruments.indexOf(role.instrument);
  const insPts = insIdx === 0 ? WEIGHTS.Instrument : insIdx > 0 ? WEIGHTS.Instrument * 0.6 : 0;
  factors.push({
    factor: 'Instrument',
    points: insPts,
    max: WEIGHTS.Instrument,
    note: insIdx === 0 ? `Main instrument: ${role.instrument}` : insIdx > 0 ? `Also plays ${role.instrument}` : `Doesn't play ${role.instrument}`,
  });

  // Genre — share of the role's genres the musician also plays
  const shared = role.genres.filter((g) => m.genres.includes(g));
  const genrePts = role.genres.length ? (shared.length / role.genres.length) * WEIGHTS.Genre : WEIGHTS.Genre;
  factors.push({
    factor: 'Genre',
    points: round1(genrePts),
    max: WEIGHTS.Genre,
    note: shared.length ? `Shares ${shared.join(', ')}` : 'No shared genres',
  });

  // Location — same city > same region > remote-friendly
  let locPts = 0;
  let locNote = `Based in ${m.city}`;
  if (m.city === role.city) {
    locPts = WEIGHTS.Location;
    locNote = `Also in ${m.city}`;
  } else if (regionOf(m.city) && regionOf(m.city) === regionOf(role.city)) {
    locPts = WEIGHTS.Location * 0.6;
    locNote = `${m.city}, same region`;
  } else if (role.remoteOk && m.remote) {
    locPts = WEIGHTS.Location * 0.45;
    locNote = `${m.city}, open to remote`;
  }
  factors.push({ factor: 'Location', points: round1(locPts), max: WEIGHTS.Location, note: locNote });

  // Availability — overlap between schedules
  const overlap = role.availability.filter((a) => m.availability.includes(a));
  const availPts = role.availability.length ? (overlap.length / role.availability.length) * WEIGHTS.Availability : WEIGHTS.Availability;
  factors.push({
    factor: 'Availability',
    points: round1(availPts),
    max: WEIGHTS.Availability,
    note: overlap.length ? `Free ${overlap.join(' & ').toLowerCase()}` : `Free ${m.availability.join(' & ').toLowerCase()}`,
  });

  // Commitment — exact level, or one step away
  const gap = Math.abs(COMMITMENTS.indexOf(role.commitment) - COMMITMENTS.indexOf(m.commitment));
  const comPts = gap === 0 ? WEIGHTS.Commitment : gap === 1 ? WEIGHTS.Commitment * 0.5 : 0;
  factors.push({ factor: 'Commitment', points: comPts, max: WEIGHTS.Commitment, note: `${m.commitment}` });

  // Experience — full points at or above the minimum, pro-rated below it
  const expPts = role.minYears <= 0 || m.years >= role.minYears ? WEIGHTS.Experience : (m.years / role.minYears) * WEIGHTS.Experience;
  factors.push({ factor: 'Experience', points: round1(expPts), max: WEIGHTS.Experience, note: `${m.years} yr${m.years === 1 ? '' : 's'} playing` });

  const score = Math.round(factors.reduce((a, f) => a + f.points, 0));
  return { musician: m, score, factors, eligible: insIdx >= 0 };
}

/** Rank the talent pool for a role. Musicians who don't play the instrument are excluded. */
export function rankCandidates(role: OpenRole, pool: Musician[], minScore = 0): MatchResult[] {
  return pool
    .map((m) => scoreMusician(role, m))
    .filter((r) => r.eligible && r.score >= minScore)
    .sort((a, b) => b.score - a.score || b.musician.responseRate - a.musician.responseRate || b.musician.gigs - a.musician.gigs);
}

export function matchLabel(score: number): 'Strong match' | 'Good match' | 'Possible match' {
  if (score >= 80) return 'Strong match';
  if (score >= 60) return 'Good match';
  return 'Possible match';
}
