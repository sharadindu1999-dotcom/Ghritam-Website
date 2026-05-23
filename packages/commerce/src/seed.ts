/**
 * Phase 1 seed catalog.
 *
 * Hand-authored fixture data lifted verbatim from the design source
 * (Ghritam.html PRODUCTS + SHLOKAS). In Phase 2 this content moves into
 * Keystatic; the storefront imports `catalog`/`shlokas` through
 * `@ghritam/commerce` so swapping the data source is a one-file change.
 */
import type { Product, Shloka } from './types.ts';

export const shlokas = {
  annam: {
    dev: 'अन्नं ब्रह्मेति व्यजानात्',
    translit: 'Annaṁ Brahmeti Vyajānāt',
    trans: 'He knew food to be Brahman — the source of all that is.',
    source: 'Taittirīya Upaniṣad, III.2',
  },
  ayur: {
    dev: 'आयुर्घृतम्',
    translit: 'Āyur Ghṛtam',
    trans: 'Ghee is life itself — longevity, vigour, vitality.',
    source: 'Charaka Saṁhitā, Sūtrasthāna XXVII.231',
  },
  ahimsa: {
    dev: 'सर्वे भवन्तु सुखिनः',
    translit: 'Sarve Bhavantu Sukhinaḥ',
    trans: 'May all beings be happy, may all be free from illness.',
    source: 'Bṛhadāraṇyaka Upaniṣad',
  },
} as const satisfies Record<string, Shloka>;

export const catalog: Product[] = [
  {
    id: 'ghee',
    slug: 'a2-bilona-ghee',
    dev: 'घृत',
    name: 'A2 Bilona Ghee',
    category: 'dairy',
    origin: 'From Gir cows, hand-churned in Gujarat',
    story:
      'Made the bilona way — curd set overnight, churned by hand until butter rises, then simmered until the room smells of temple. What you receive is granular, golden, and deeply scented of the barn it came from.',
    note: 'No two jars will smell the same — that is how you know.',
    inSeason: true,
    maker: {
      name: 'The Patel family',
      place: 'Gir, Gujarat',
      blurb:
        'Three generations of gwalas who still churn before sunrise, by hand, in a clay-pot bilona. When Ghritam pays them, it is without a middleman — the full price reaches their home.',
    },
    shlokaKey: 'ayur',
    badges: ['A2 Gir cows', 'Hand-churned', 'Unpasteurised'],
    variants: [
      { sku: 'GHEE-500', label: '500 ml', price: 1480, batch: 'Batch no. 047 · Kārtika 2025', stock: 24 },
      { sku: 'GHEE-1000', label: '1 litre', price: 2760, batch: 'Batch no. 047 · Kārtika 2025', stock: 11 },
    ],
  },
  {
    id: 'honey',
    slug: 'raw-forest-honey',
    dev: 'मधु',
    name: 'Raw Forest Honey',
    category: 'apiary',
    origin: 'Wild-harvested, Sundarban beekeepers',
    story:
      'Gathered from wild Apis dorsata combs in the mangrove forest, strained once and never heated. It carries the flower of its month — so a winter jar and a spring jar are not the same honey.',
    note: 'Crystallises in winter. This is a sign of life, not fault.',
    inSeason: true,
    maker: {
      name: 'The Sundarban mouli cooperative',
      place: 'Sundarban, West Bengal',
      blurb:
        'Honey-hunters who enter the forest by boat and read the bees the old way. Ghritam buys the whole season at a fair, fixed price so a thin month does not become a hungry one.',
    },
    shlokaKey: 'annam',
    badges: ['Wild-harvested', 'Single-strain', 'Never heated'],
    variants: [
      { sku: 'HONEY-350', label: '350 g', price: 640, batch: 'Batch no. 012 · Spring flow', stock: 40 },
      { sku: 'HONEY-700', label: '700 g', price: 1180, batch: 'Batch no. 012 · Spring flow', stock: 18 },
    ],
  },
  {
    id: 'kishmish',
    slug: 'kinnaur-kishmish',
    dev: 'द्राक्षा',
    name: 'Kinnaur Kishmish',
    category: 'mountain',
    origin: 'Sun-dried in the orchards of Kinnaur',
    story:
      'Grapes laid out on rooftops to dry under the high mountain sun, turned by hand. The black and the brown are different vines, different sugars — pick the one your kitchen prefers.',
    note: 'Pips in. Seeds removed by hand, where nature allowed.',
    inSeason: false,
    maker: {
      name: 'The Negi family orchard',
      place: 'Kalpa, Kinnaur, Himachal Pradesh',
      blurb:
        'A Pahadi family whose terraced vines sit above the Sutlej. The whole year’s drying is done on their own roof, and the whole year’s crop comes to Ghritam.',
    },
    shlokaKey: 'ahimsa',
    badges: ['Sun-dried', 'No added sugar', 'Unsulphured'],
    variants: [
      { sku: 'KISH-BLACK-400', label: 'Black · 400 g', price: 520, batch: 'Batch no. 003 · Autumn harvest', stock: 33 },
      { sku: 'KISH-BROWN-400', label: 'Brown · 400 g', price: 480, batch: 'Batch no. 004 · Autumn harvest', stock: 29 },
    ],
  },
  {
    id: 'akhrot',
    slug: 'kashmiri-walnuts',
    dev: 'अक्षोट',
    name: 'Kashmiri Walnuts',
    category: 'mountain',
    origin: 'Shelled in the valleys of Shopian',
    story:
      'Thin-shelled walnuts from old, rain-fed trees — never irrigated, never forced. Shelled by hand in winter, so a few halves come whole and a few come broken.',
    note: 'Bitter-sweet and oily — the way the mountain makes them.',
    inSeason: false,
    maker: {
      name: 'The Bhat family',
      place: 'Shopian, Kashmir',
      blurb:
        'Custodians of walnut trees older than anyone living. Ghritam pays per tree, not per kilo, so a lean year still pays for the family’s winter.',
    },
    shlokaKey: 'annam',
    badges: ['Rain-fed trees', 'Hand-shelled', 'Cold-stored'],
    variants: [
      { sku: 'WALNUT-500', label: '500 g halves', price: 880, batch: 'Batch no. 019 · Autumn harvest', stock: 21 },
    ],
  },
];

export function findProduct(slug: string): Product | undefined {
  return catalog.find((p) => p.slug === slug);
}
