// Two-octave keyboard (C3–B4) that lights up the current voicing.
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK_OFFSET: Record<number, number> = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };

export function Keyboard({ notes, bass }: { notes: number[]; bass: number | null }) {
  const start = 48; // C3
  const octaves = 2;
  const whiteCount = octaves * 7;
  const w = 100 / whiteCount;
  const lit = new Set(notes.map((n) => fold(n, start, octaves)));
  const bassPc = bass === null ? null : fold(bass, start, octaves) % 12;
  const keys: JSX.Element[] = [];
  for (let o = 0; o < octaves; o++) {
    WHITE.forEach((pc, i) => {
      const midi = start + o * 12 + pc;
      const isBass = bassPc !== null && o === 0 && pc === bassPc;
      keys.push(
        <div key={`w${midi}`} className={`white${lit.has(midi) ? ' on' : ''}${isBass ? ' bass' : ''}`}
          style={{ left: `${(o * 7 + i) * w}%`, width: `${w}%` }} />,
      );
    });
    Object.entries(BLACK_OFFSET).forEach(([pcStr, after]) => {
      const pc = Number(pcStr);
      const midi = start + o * 12 + pc;
      const isBass = bassPc !== null && o === 0 && pc === bassPc;
      keys.push(
        <div key={`b${midi}`} className={`black${lit.has(midi) ? ' on' : ''}${isBass ? ' bass' : ''}`}
          style={{ left: `${(o * 7 + after + 1) * w - w * 0.3}%`, width: `${w * 0.6}%` }} />,
      );
    });
  }
  return <div className="keyboard" aria-hidden>{keys}</div>;
}

/** Fold a MIDI note into the visible two-octave range */
function fold(n: number, start: number, octaves: number) {
  let m = n;
  while (m < start) m += 12;
  while (m >= start + octaves * 12) m -= 12;
  return m;
}
