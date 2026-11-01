export function ScoreRing({ score, size = 54 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? 'var(--berry)' : score >= 60 ? 'var(--glacier-deep)' : 'var(--glacier)';
  return (
    <div className="ring" style={{ width: size, height: size }} aria-label={`Match score ${score} out of 100`}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--frost)" strokeWidth="5" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="5" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <b>{score}</b>
    </div>
  );
}

export function Avatar({ name, hue }: { name: string; hue: number }) {
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return <span className="avatar" style={{ background: `hsl(${hue} 32% 42%)` }} aria-hidden>{initials}</span>;
}
