// Measures the two core features. Run: npx vite-node scripts/benchmark.ts
import { generateSong, GENRES, MOODS } from '../src/lib/music/generator';
import { MUSICIANS, INSTRUMENTS } from '../src/lib/band/data';
import { rankCandidates, OpenRole } from '../src/lib/band/matching';
import { loadDictionary, rhymeStrength } from '../src/lib/lyrics/pron';

const time = (fn: () => void, n: number) => { const t = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t) / n; };

const songMs = time(() => {
  const mood = MOODS[Math.floor(Math.random() * MOODS.length)].id;
  const genre = GENRES[Math.floor(Math.random() * GENRES.length)].id;
  generateSong({ key: Math.floor(Math.random() * 12), mood, genre, bpm: 90 }, Math.floor(Math.random() * 1e9));
}, 5000);

const role: OpenRole = { id: 'b', title: '', instrument: 'Bass', genres: ['Indie rock'], city: 'Mumbai', remoteOk: true, availability: ['Weekends'], commitment: 'Semi-pro', minYears: 2, split: 20, notes: '', createdAt: 0, status: 'open' };
const rankMs = time(() => { for (const ins of INSTRUMENTS) rankCandidates({ ...role, instrument: ins }, MUSICIANS); }, 500) / INSTRUMENTS.length;
const candidates = INSTRUMENTS.map((ins) => rankCandidates({ ...role, instrument: ins }, MUSICIANS).length);

const dict = await loadDictionary();
// Hand-labelled rhyme pairs: [a, b, rhymes?]
const pairs: [string, string, boolean][] = [
  ['door', 'floor', true], ['night', 'light', true], ['heart', 'apart', true], ['remember', 'december', true], ['fire', 'desire', true],
  ['rain', 'again', true], ['love', 'above', true], ['you', 'through', true], ['away', 'stay', true], ['eyes', 'skies', true],
  ['snow', 'go', true], ['alone', 'home', true], ['time', 'mine', true], ['dream', 'seem', true], ['sky', 'goodbye', true],
  ['snow', 'rain', false], ['heart', 'door', false], ['night', 'day', false], ['love', 'home', false], ['fire', 'water', false],
  ['winter', 'summer', false], ['song', 'light', false], ['blue', 'red', false], ['dance', 'sing', false], ['road', 'sea', false],
];
let correct = 0;
for (const [a, b, want] of pairs) if ((rhymeStrength(a, b, dict) !== 'none') === want) correct++;

console.log(JSON.stringify({
  songGenerationMs: +songMs.toFixed(3),
  rankingMsPerRole: +rankMs.toFixed(3),
  eligibleCandidatesPerInstrument: Object.fromEntries(INSTRUMENTS.map((ins, i) => [ins, candidates[i]])),
  rhymeDetection: `${correct}/${pairs.length} (${Math.round((correct / pairs.length) * 100)}%)`,
}, null, 2));
