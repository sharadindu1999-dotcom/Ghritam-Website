/**
 * D1-backed catalog reads.
 *
 * The storefront's catalog pages call these at the edge. If no database is
 * bound, or the replica has not been synced yet, they fall back to the seed
 * fixture so the site is never empty.
 */
import type { Category, D1Database, DiscountRecord, Product, Variant } from './types.ts';
import { catalog as seedCatalog } from './seed.ts';

interface ProductRow {
  slug: string;
  handle: string;
  name: string;
  dev: string;
  category: string;
  origin: string;
  story: string;
  note: string;
  in_season: number;
  shloka_key: string;
  maker_name: string;
  maker_place: string;
  maker_blurb: string;
  badges: string;
  sort_order: number;
}

interface VariantRow {
  sku: string;
  product_slug: string;
  label: string;
  price: number;
  batch: string;
  stock: number;
  sort_order: number;
}

function rowToProduct(p: ProductRow, variantsBySlug: Map<string, Variant[]>): Product {
  return {
    id: p.handle,
    slug: p.slug,
    dev: p.dev,
    name: p.name,
    category: p.category as Category,
    origin: p.origin,
    story: p.story,
    note: p.note,
    inSeason: p.in_season === 1,
    maker: { name: p.maker_name, place: p.maker_place, blurb: p.maker_blurb },
    shlokaKey: p.shloka_key,
    variants: variantsBySlug.get(p.slug) ?? [],
    badges: safeJsonArray(p.badges),
  };
}

function safeJsonArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Full catalog. Reads D1 when available; falls back to the seed fixture when
 * there is no DB binding or the replica is still empty.
 */
export async function getCatalog(db?: D1Database): Promise<Product[]> {
  if (!db) return seedCatalog;

  const [products, variants] = await Promise.all([
    db.prepare('SELECT * FROM products ORDER BY sort_order, name').all<ProductRow>(),
    db.prepare('SELECT * FROM variants ORDER BY product_slug, sort_order').all<VariantRow>(),
  ]);

  if (products.results.length === 0) return seedCatalog;

  const variantsBySlug = new Map<string, Variant[]>();
  for (const v of variants.results) {
    const list = variantsBySlug.get(v.product_slug) ?? [];
    list.push({ sku: v.sku, label: v.label, price: v.price, batch: v.batch, stock: v.stock });
    variantsBySlug.set(v.product_slug, list);
  }

  return products.results.map((p) => rowToProduct(p, variantsBySlug));
}

/** A single product by slug, or undefined if not found. */
export async function getProductBySlug(
  slug: string,
  db?: D1Database,
): Promise<Product | undefined> {
  if (!db) return seedCatalog.find((p) => p.slug === slug);

  const product = await db
    .prepare('SELECT * FROM products WHERE slug = ?')
    .bind(slug)
    .first<ProductRow>();
  if (!product) return seedCatalog.find((p) => p.slug === slug);

  const variants = await db
    .prepare('SELECT * FROM variants WHERE product_slug = ? ORDER BY sort_order')
    .bind(slug)
    .all<VariantRow>();

  const variantsBySlug = new Map<string, Variant[]>([
    [
      slug,
      variants.results.map((v) => ({
        sku: v.sku,
        label: v.label,
        price: v.price,
        batch: v.batch,
        stock: v.stock,
      })),
    ],
  ]);
  return rowToProduct(product, variantsBySlug);
}

interface DiscountRow {
  code: string;
  type: string;
  value: number;
  min_order: number;
  applies_to: string;
  valid_from: string | null;
  valid_to: string | null;
  usage_cap: number;
  active: number;
}

/** Active discount codes from D1. Empty when there is no DB binding. */
export async function getDiscounts(db?: D1Database): Promise<DiscountRecord[]> {
  if (!db) return [];
  const rows = await db
    .prepare('SELECT * FROM discounts WHERE active = 1')
    .all<DiscountRow>();
  return rows.results.map((d) => ({
    code: d.code,
    type: d.type === 'flat' ? 'flat' : 'percent',
    value: d.value,
    minOrder: d.min_order,
    appliesTo: d.applies_to as DiscountRecord['appliesTo'],
    validFrom: d.valid_from,
    validTo: d.valid_to,
    usageCap: d.usage_cap,
    active: d.active === 1,
  }));
}
