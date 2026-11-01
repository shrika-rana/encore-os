// A curated bank of common, singable words used for offline rhyme suggestions
// and template-based spark lines. Tagged by part of speech.

const NOUNS = `
air arms art ash autumn baby band bed bells blade blood blue body bone bones border bottle boy brain bread breath
bridge bus cage call candle car card care chain chair chance change chest child chorus city cloud coast coat cold
colour corner crowd crown cup dance dark dawn day days dream dreams dress drum dust earth edge end eyes face fade
faith fall fame fear feet fever field fight fire flame flight floor flower fog friend friends game ghost gift girl
glass glow gold grace grave ground guitar hand hands head heart heat heaven hill home hope hour hours house ice key
kiss lake land lane life light line lines lips love lover maze melody memory mile mind mirror money moon morning
mountain mouth name night noise note ocean page pain paper party past peace phone piano picture place plane rain
river road rock roof room rose sand scene sea season shadow shore side sign silence sky sleep smile smoke snow song
soul sound space spark spring star stars stone storm story street summer sun sunrise sunset taste tears thunder
tide time touch town train tree truth tune veins voice wall war water wave waves way weather wind window wine wings
winter wire wish word words world year years youth stage crowd encore echo frost glacier lantern harbour monsoon
chai rooftop highway headlights skyline daydream heartbeat rhythm silhouette
`;

const VERBS = `
break breathe bring burn call carry catch change chase climb come cry dance dream drift drive drown fade fall feel
fight find fly follow forget freeze give glow go grow hide hold hope know laugh leave let lie light live lose love
meet move need pray pretend reach remember rise run say see shine sing sink sleep slip speak spin stand start stay
steal stop swim take talk taste tell throw touch try turn wait wake walk want wonder write
`;

const ADJECTIVES = `
alive alone bright broken calm cold dark deep empty endless free gold golden gone gentle heavy high hollow kind
late little lonely lost loud low new numb old open pale quiet real restless right silent slow small soft still
strange strong sweet true warm wild young wide blue grey white frozen burning shining fading falling waiting
`;

const split = (s: string) => Array.from(new Set(s.split(/\s+/).filter(Boolean)));

export const BANK = {
  noun: split(NOUNS),
  verb: split(VERBS),
  adj: split(ADJECTIVES),
};

export type Pos = keyof typeof BANK;

export const ALL_BANK_WORDS: { word: string; pos: Pos }[] = (Object.keys(BANK) as Pos[]).flatMap((pos) =>
  BANK[pos].map((word) => ({ word, pos })),
);

/** Imagery used to seed offline lines when no theme words are available */
export const MOOD_IMAGERY: Record<string, string[]> = {
  bright: ['sunrise', 'summer', 'skyline', 'light', 'morning', 'rooftop', 'flower', 'spark'],
  anthemic: ['crowd', 'fire', 'thunder', 'highway', 'stars', 'stage', 'heartbeat', 'mountain'],
  dreamy: ['moon', 'cloud', 'ocean', 'daydream', 'glow', 'tide', 'silk', 'lantern'],
  melancholic: ['rain', 'winter', 'ghost', 'shadow', 'letters', 'monsoon', 'window', 'echo'],
  tense: ['storm', 'wire', 'smoke', 'headlights', 'fever', 'mirror', 'blade', 'silence'],
};
