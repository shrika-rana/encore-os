// Simulated replies for the demo talent pool (real musicians would reply in-app).

/**
 * Simulated reply from a demo musician. Higher scores are more likely to say
 * yes; the outcome is seeded by role + musician so a demo is repeatable.
 */
export function willAccept(roleId: string, musicianId: string, score: number, responseRate: number): boolean {
  let h = 2166136261;
  for (const ch of `${roleId}:${musicianId}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const roll = ((h >>> 0) % 1000) / 1000;
  const p = Math.min(0.95, Math.max(0.1, (score - 30) / 50)) * (0.6 + 0.4 * responseRate);
  return roll < p;
}
