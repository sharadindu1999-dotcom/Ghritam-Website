/**
 * Catalog → D1 sync.
 *
 * Rewrites the D1 catalog read-replica from a content snapshot (the canonical
 * git/Keystatic catalog). products/variants/discounts are derived data, so a
 * full wipe-and-insert is the simplest correct strategy for this catalog size.
 * orders / discount_redemptions are never touched.
 */
import type { D1Database, DiscountRecord, Product } from './types.ts';

export interface CatalogSnapshot {
  products: Product[];
  discounts: DiscountRecord[];
}

export interface SyncResult {
  products: number;
  variants: number;
  discounts: number;
}

const INSERT_PRODUCT = `INSERT INTO products
  (slug, handle, name, dev, category, origin, story, note, in_season,
   shloka_key, maker_name, maker_place, maker_blurb, badges, sort_order)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

const INSERT_VARIANT = `INSERT INTO variants
  (sku, product_slug, label, price, batch, stock, sort_order)
  VALUES (?,?,?,?,?,?,?)`;

const INSERT_DISCOUNT = `INSERT INTO discounts
  (code, type, value, min_order, applies_to, valid_from, valid_to, usage_cap, active)
  VALUES (?,?,?,?,?,?,?,?,?)`;

/**
 * Replace the D1 catalog with `snapshot`. Runs as a single atomic D1 batch.
 */
export async function syncCatalogToD1(
  db: D1Database,
  snapshot: CatalogSnapshot,
): Promise<SyncResult> {
  const statements = [
    db.prepare('DELETE FROM variants'),
    db.prepare('DELETE FROM products'),
    db.prepare('DELETE FROM discounts'),
  ];

  let variantCount = 0;
  snapshot.products.forEach((p, pi) => {
    statements.push(
      db
        .prepare(INSERT_PRODUCT)
        .bind(
          p.slug,
          p.id,
          p.name,
          p.dev,
          p.category,
          p.origin,
          p.story,
          p.note,
          p.inSeason ? 1 : 0,
          p.shlokaKey,
          p.maker.name,
          p.maker.place,
          p.maker.blurb,
          JSON.stringify(p.badges),
          pi,
        ),
    );
    p.variants.forEach((v, vi) => {
      statements.push(
        db
          .prepare(INSERT_VARIANT)
          .bind(v.sku, p.slug, v.label, v.price, v.batch, v.stock, vi),
      );
      variantCount += 1;
    });
  });

  snapshot.discounts.forEach((d) => {
    statements.push(
      db
        .prepare(INSERT_DISCOUNT)
        .bind(
          d.code,
          d.type,
          d.value,
          d.minOrder,
          d.appliesTo,
          d.validFrom,
          d.validTo,
          d.usageCap,
          d.active ? 1 : 0,
        ),
    );
  });

  await db.batch(statements);
  return {
    products: snapshot.products.length,
    variants: variantCount,
    discounts: snapshot.discounts.length,
  };
}
