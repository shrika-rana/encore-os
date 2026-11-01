import { describe, expect, it } from 'vitest';
import { generateMusicians, MUSICIANS } from '../src/lib/band/data';
import { OpenRole, rankCandidates, scoreMusician, WEIGHTS } from '../src/lib/band/matching';
import { addMemberWithShare, checkSplits, evenSplit, Member } from '../src/lib/band/splits';
import { willAccept } from '../src/lib/band/responses';

const role: OpenRole = {
  id: 'r1', title: 'Bassist', instrument: 'Bass', genres: ['Indie rock', 'Indie pop'], city: 'Mumbai', remoteOk: false,
  availability: ['Weekends'], commitment: 'Semi-pro', minYears: 3, split: 20, notes: '', createdAt: 0, status: 'open',
};

describe('talent pool', () => {
  it('is generated deterministically', () => {
    expect(generateMusicians(2026)).toEqual(generateMusicians(2026));
    expect(MUSICIANS).toHaveLength(60);
  });
});

describe('matching', () => {
  it('weights add up to 100', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('gives a perfect profile 100', () => {
    const perfect = { ...MUSICIANS[0], instruments: ['Bass' as const], genres: ['Indie rock' as const, 'Indie pop' as const], city: 'Mumbai', availability: ['Weekends' as const], commitment: 'Semi-pro' as const, years: 5 };
    expect(scoreMusician(role, perfect).score).toBe(100);
  });

  it('only returns musicians who play the instrument, best first', () => {
    const ranked = rankCandidates(role, MUSICIANS);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((r) => r.musician.instruments.includes('Bass'))).toBe(true);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
  });

  it('explains every score with factors that sum to the total', () => {
    for (const r of rankCandidates(role, MUSICIANS)) {
      const sum = r.factors.reduce((a, f) => a + f.points, 0);
      expect(Math.abs(Math.round(sum) - r.score)).toBeLessThanOrEqual(1);
      expect(r.factors).toHaveLength(6);
    }
  });

  it('ranks a same-city musician above an identical one elsewhere', () => {
    const base = { ...MUSICIANS[0], instruments: ['Bass' as const] };
    const local = scoreMusician(role, { ...base, city: 'Mumbai' }).score;
    const region = scoreMusician(role, { ...base, city: 'Pune' }).score;
    const far = scoreMusician(role, { ...base, city: 'Kolkata' }).score;
    expect(local).toBeGreaterThan(region);
    expect(region).toBeGreaterThan(far);
  });

  it('ranks 60 musicians for 10 instruments in under 5 ms on average', () => {
    const instruments = ['Vocals', 'Guitar', 'Bass', 'Drums', 'Keys', 'Violin', 'Tabla', 'Flute', 'Saxophone', 'Producer'] as const;
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) for (const ins of instruments) rankCandidates({ ...role, instrument: ins }, MUSICIANS);
    const avg = (performance.now() - t0) / 1000;
    expect(avg).toBeLessThan(5);
  });
});

describe('split agreements', () => {
  const me: Member = { id: 'me', name: 'You', role: 'Vocals', share: 100, isYou: true, joinedAt: 0 };

  it('adds a member with the offered share and keeps the total at 100', () => {
    let band = addMemberWithShare([me], { id: 'a', name: 'A', role: 'Bass', joinedAt: 1 }, 20);
    expect(band.map((m) => m.share)).toEqual([80, 20]);
    band = addMemberWithShare(band, { id: 'b', name: 'B', role: 'Drums', joinedAt: 2 }, 25);
    expect(checkSplits(band).total).toBe(100);
    expect(band[2].share).toBe(25);
  });

  it('splits evenly with exact totals', () => {
    const band = evenSplit([me, { ...me, id: 'x', isYou: false }, { ...me, id: 'y', isYou: false }]);
    expect(checkSplits(band).valid).toBe(true);
  });

  it('rejects splits that do not add up to 100', () => {
    const r = checkSplits([{ ...me, share: 70 }, { ...me, id: 'z', share: 20 }]);
    expect(r.valid).toBe(false);
    expect(r.message).toBe('10% is still unassigned.');
  });

  it('simulated replies are repeatable and favour strong matches', () => {
    expect(willAccept('r', 'm1', 90, 1)).toBe(willAccept('r', 'm1', 90, 1));
    let strong = 0;
    let weak = 0;
    for (let i = 0; i < 500; i++) {
      if (willAccept(`role${i}`, 'm', 90, 1)) strong++;
      if (willAccept(`role${i}`, 'm', 40, 1)) weak++;
    }
    expect(strong).toBeGreaterThan(weak * 3);
  });
});
