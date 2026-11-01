// Demo talent pool. Profiles are generated deterministically from a seed so the
// prototype always shows the same 60 fictional musicians.

import { mulberry32 } from '../music/generator';

export const INSTRUMENTS = [
  'Vocals', 'Guitar', 'Bass', 'Drums', 'Keys', 'Violin', 'Tabla', 'Flute', 'Saxophone', 'Producer',
] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

export const BAND_GENRES = [
  'Indie pop', 'Indie rock', 'Rock', 'Lo-fi', 'Folk', 'R&B / Soul', 'Bollywood', 'Jazz', 'Metal', 'Electronic', 'Hip-hop', 'Fusion',
] as const;
export type BandGenre = (typeof BAND_GENRES)[number];

export const CITIES: { name: string; region: string }[] = [
  { name: 'Mumbai', region: 'West' },
  { name: 'Pune', region: 'West' },
  { name: 'Goa', region: 'West' },
  { name: 'Hyderabad', region: 'South' },
  { name: 'Bengaluru', region: 'South' },
  { name: 'Chennai', region: 'South' },
  { name: 'Delhi', region: 'North' },
  { name: 'Chandigarh', region: 'North' },
  { name: 'Kolkata', region: 'East' },
  { name: 'Shillong', region: 'Northeast' },
];

export const AVAILABILITY = ['Weekday evenings', 'Weekends', 'Daytime'] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const COMMITMENTS = ['Hobby', 'Semi-pro', 'Professional'] as const;
export type Commitment = (typeof COMMITMENTS)[number];

export interface Musician {
  id: string;
  name: string;
  hue: number;
  instruments: Instrument[];
  genres: BandGenre[];
  city: string;
  years: number;
  availability: Availability[];
  commitment: Commitment;
  remote: boolean;
  gigs: number;
  endorsements: number;
  responseRate: number; // 0..1
  influences: string[];
  bio: string;
}

export function regionOf(city: string): string | undefined {
  return CITIES.find((c) => c.name === city)?.region;
}

const FIRST = [
  'Aarav', 'Riya', 'Kabir', 'Meera', 'Ishaan', 'Ananya', 'Vihaan', 'Tara', 'Arjun', 'Zoya', 'Neil', 'Sana', 'Dev', 'Kiara',
  'Rohan', 'Aditi', 'Kunal', 'Naina', 'Aryan', 'Ira', 'Siddharth', 'Myra', 'Yash', 'Diya', 'Reuben', 'Leah', 'Farhan', 'Pooja',
  'Karan', 'Nisha', 'Samuel', 'Ritika', 'Varun', 'Anika', 'Ibrahim', 'Shreya', 'Tenzin', 'Mira', 'Aditya', 'Elsa', 'Joel',
  'Rhea', 'Omkar', 'Noor', 'Pranav', 'Lavanya', 'Daniel', 'Tanvi', 'Manav', 'Kavya', 'Harsh', 'Sneha', 'Nikhil', 'Ayesha',
  'Rahul', 'Jia', 'Veer', 'Esha', 'Abhay', 'Sara',
];
const LAST = ['M.', 'S.', 'D.', 'K.', 'R.', 'P.', 'J.', 'N.', 'T.', 'B.', 'G.', 'L.', 'V.', 'C.', 'F.'];

const INFLUENCES: Record<BandGenre, string[]> = {
  'Indie pop': ['Prateek Kuhad', 'Phoebe Bridgers', 'Lizzy McAlpine', 'When Chai Met Toast'],
  'Indie rock': ['The Local Train', 'Arctic Monkeys', 'The Strokes', 'Parvaaz'],
  Rock: ['Foo Fighters', 'Indian Ocean', 'Thermal and a Quarter', 'Queen'],
  'Lo-fi': ['Nujabes', 'Jinsang', 'Mac DeMarco', 'Sid Sriram'],
  Folk: ['Ankur Tewari', 'Bon Iver', 'Fleet Foxes', 'Swanand Kirkire'],
  'R&B / Soul': ['H.E.R.', 'Frank Ocean', 'Raveena', 'Anderson .Paak'],
  Bollywood: ['A.R. Rahman', 'Amit Trivedi', 'Shreya Ghoshal', 'Arijit Singh'],
  Jazz: ['Louiz Banks', 'Snarky Puppy', 'Robert Glasper', 'Esperanza Spalding'],
  Metal: ['Bloodywood', 'Gojira', 'Skyharbor', 'Periphery'],
  Electronic: ['Ritviz', 'Nucleya', 'Bonobo', 'Four Tet'],
  'Hip-hop': ['DIVINE', 'Seedhe Maut', 'Kendrick Lamar', 'Prabh Deep'],
  Fusion: ['Shakti', 'Agam', 'Thaikkudam Bridge', 'Karsh Kale'],
};

const BIO_OPENERS = [
  'Session player who loves a tight pocket.',
  'Bedroom producer turned live musician.',
  'Classically trained, now chasing indie sounds.',
  'Plays open mics most weekends.',
  'Self-taught, obsessed with tone.',
  'Former college-band lead, looking for the next project.',
  'Writes daily, records weekly.',
  'Toured college fests across the country.',
];

function weightedInstrument(rand: () => number): Instrument {
  // Bass and drums are scarcer than guitars and vocals — mirrors real scenes
  const w: [Instrument, number][] = [
    ['Vocals', 18], ['Guitar', 20], ['Bass', 9], ['Drums', 9], ['Keys', 11], ['Violin', 5], ['Tabla', 5],
    ['Flute', 4], ['Saxophone', 4], ['Producer', 15],
  ];
  const total = w.reduce((a, [, n]) => a + n, 0);
  let r = rand() * total;
  for (const [ins, n] of w) {
    r -= n;
    if (r <= 0) return ins;
  }
  return 'Guitar';
}

function sample<T>(arr: readonly T[], n: number, rand: () => number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
}

export function generateMusicians(seed = 2026, count = 60): Musician[] {
  const rand = mulberry32(seed);
  const list: Musician[] = [];
  for (let i = 0; i < count; i++) {
    const primary = weightedInstrument(rand);
    const secondaryPool = INSTRUMENTS.filter((x) => x !== primary);
    const instruments: Instrument[] = rand() < 0.45 ? [primary, sample(secondaryPool, 1, rand)[0]] : [primary];
    const genres = sample(BAND_GENRES, 2 + Math.floor(rand() * 2), rand);
    // Weight towards the launch cities (Mumbai, Hyderabad)
    const city = rand() < 0.45 ? (rand() < 0.55 ? 'Mumbai' : 'Hyderabad') : CITIES[Math.floor(rand() * CITIES.length)].name;
    const years = 1 + Math.floor(rand() * 12);
    const commitment: Commitment = years > 8 ? (rand() < 0.6 ? 'Professional' : 'Semi-pro') : years > 3 ? (rand() < 0.6 ? 'Semi-pro' : 'Hobby') : 'Hobby';
    const availability = sample(AVAILABILITY, 1 + Math.floor(rand() * 2), rand);
    list.push({
      id: `m${i + 1}`,
      name: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(rand() * LAST.length)]}`,
      hue: Math.floor(rand() * 360),
      instruments,
      genres,
      city,
      years,
      availability,
      commitment,
      remote: rand() < 0.4,
      gigs: Math.floor(years * (2 + rand() * 8)),
      endorsements: Math.floor(rand() * 24),
      responseRate: Math.round((0.55 + rand() * 0.45) * 100) / 100,
      influences: sample(INFLUENCES[genres[0]], 2, rand),
      bio: BIO_OPENERS[Math.floor(rand() * BIO_OPENERS.length)],
    });
  }
  return list;
}

export const MUSICIANS = generateMusicians();
