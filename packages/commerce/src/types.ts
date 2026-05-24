/**
 * Ghritam catalog & commerce types.
 *
 * These are the single source of truth for the shape of a product across the
 * whole monorepo. In Phase 1 they are satisfied by the seed fixture; in Phase 2
 * the Keystatic schema and the D1 read-replica are modelled to produce exactly
 * this shape, so pages built against these types do not need rewriting.
 *
 * Money is stored as an integer number of rupees (₹). The brand prices in whole
 * rupees; conversion to paise (×100) for Razorpay happens only at checkout.
 */

export type Category = 'dairy' | 'apiary' | 'mountain';

export const CATEGORY_LABELS: Record<Category, string> = {
  dairy: 'Dairy',
  apiary: 'Apiary',
  mountain: 'Mountain',
};

/** A purchasable SKU — a size or sub-type of a product (e.g. "500 ml", "Black Kishmish"). */
export interface Variant {
  /** Stable stock-keeping unit, unique across the whole catalog. */
  sku: string;
  /** Human label shown in the variant selector. */
  label: string;
  /** Price in whole rupees (₹). */
  price: number;
  /** Batch line, e.g. "Batch no. 047 · Kārtika 2025". */
  batch: string;
  /** Units in stock. 0 = sold out. */
  stock: number;
}

/** A Sanskrit citation — Devanagari, transliteration, gloss and source. Never omit the source. */
export interface Shloka {
  dev: string;
  translit: string;
  trans: string;
  source: string;
}

/** The human behind the food — surfaced on the product detail page. */
export interface Maker {
  name: string;
  place: string;
  blurb: string;
}

/** A complete product as consumed by the storefront. */
export interface Product {
  id: string;
  /** URL slug under /foods/. */
  slug: string;
  /** Devanagari seed-word used as an iconographic accent (घृत, मधु, …). */
  dev: string;
  name: string;
  category: Category;
  /** Short provenance line, e.g. "From Gir cows, hand-churned in Gujarat". */
  origin: string;
  /** Long editorial paragraph for the detail page. */
  story: string;
  /** The italic marginal note, e.g. "No two jars will smell the same…". */
  note: string;
  /** Whether the product is currently in season — drives the listing filter. */
  inSeason: boolean;
  maker: Maker;
  /** Key of the shloka (in siteConfig) that anchors this product. */
  shlokaKey: string;
  /** Public URL to the product photo, e.g. /uploads/products/ghee.jpg. Undefined when no image has been uploaded — the storefront then renders the hatched placeholder. */
  imagePath?: string;
  /** At least one variant. The first is treated as the default. */
  variants: Variant[];
  /** Short trust marks, e.g. ["A2 Gir cows", "Hand-churned", "Unpasteurised"]. */
  badges: string[];
}

/** Resolved view of a product's price range, for listing/grid display. */
export interface PriceRange {
  min: number;
  max: number;
  /** True when every variant is the same price. */
  single: boolean;
}

/** A discount code as stored in the catalog (D1 `discounts` / Keystatic). */
export interface DiscountRecord {
  code: string;
  type: 'percent' | 'flat';
  /** Percent (e.g. 10) or flat rupees off. */
  value: number;
  /** Minimum order subtotal (₹) for the code to apply. */
  minOrder: number;
  /** 'all' or a single category the code is restricted to. */
  appliesTo: 'all' | Category;
  validFrom: string | null;
  validTo: string | null;
  /** Maximum redemptions; 0 = unlimited. */
  usageCap: number;
  active: boolean;
}

/* ── Minimal structural D1 types ──────────────────────────────────────────
   Mirrors the Cloudflare D1 client surface this package uses, so commerce
   stays free of a hard dependency on `@cloudflare/workers-types`. */

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
}

export interface D1RunResult {
  success: boolean;
  meta: { changes: number; last_row_id: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1RunResult>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<unknown>;
}
