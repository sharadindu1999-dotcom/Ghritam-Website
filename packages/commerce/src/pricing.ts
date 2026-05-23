/**
 * Pricing & discount engine.
 *
 * This is the authoritative money math. `priceCart` is fed the catalog (from
 * D1) and the client's `{ sku, qty }` items — never the client's prices — so
 * the amount charged is always derived server-side.
 */
import type { CartItem } from './cart.ts';
import type { Category, DiscountRecord, Product } from './types.ts';

export interface PricedLine {
  sku: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  category: Category;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface DiscountResult {
  code: string | null;
  amount: number;
  /** Present when a supplied code was rejected. */
  reason?: string;
}

export interface CartPricing {
  lines: PricedLine[];
  subtotal: number;
  discount: DiscountResult;
  total: number;
  /** SKU-level problems: unknown SKU, sold out, insufficient stock. */
  errors: string[];
}

/** Price the client's items against the catalog. Ignores client-sent prices. */
export function priceItems(
  catalog: Product[],
  items: CartItem[],
): { lines: PricedLine[]; subtotal: number; errors: string[] } {
  const variantIndex = new Map<
    string,
    { product: Product; price: number; label: string; stock: number }
  >();
  for (const product of catalog) {
    for (const v of product.variants) {
      variantIndex.set(v.sku, {
        product,
        price: v.price,
        label: v.label,
        stock: v.stock,
      });
    }
  }

  const lines: PricedLine[] = [];
  const errors: string[] = [];
  for (const item of items) {
    const qty = Math.floor(item.qty);
    if (qty <= 0) continue;
    const match = variantIndex.get(item.sku);
    if (!match) {
      errors.push(`Unknown item: ${item.sku}`);
      continue;
    }
    if (match.stock <= 0) {
      errors.push(`${match.product.name} (${match.label}) is sold out.`);
      continue;
    }
    if (qty > match.stock) {
      errors.push(`Only ${match.stock} of ${match.product.name} (${match.label}) left.`);
      continue;
    }
    lines.push({
      sku: item.sku,
      productSlug: match.product.slug,
      productName: match.product.name,
      variantLabel: match.label,
      category: match.product.category,
      unitPrice: match.price,
      qty,
      lineTotal: match.price * qty,
    });
  }
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  return { lines, subtotal, errors };
}

function withinDateWindow(discount: DiscountRecord, now: Date): boolean {
  const today = now.toISOString().slice(0, 10);
  if (discount.validFrom && today < discount.validFrom) return false;
  if (discount.validTo && today > discount.validTo) return false;
  return true;
}

/**
 * Evaluate a discount against priced lines.
 * `redemptions` is the count already used, for the usage cap.
 */
export function evaluateDiscount(
  discount: DiscountRecord | undefined,
  lines: PricedLine[],
  subtotal: number,
  redemptions: number,
  now: Date,
): DiscountResult {
  if (!discount) return { code: null, amount: 0 };
  const reject = (reason: string): DiscountResult => ({ code: null, amount: 0, reason });

  if (!discount.active) return reject('This code is not active.');
  if (!withinDateWindow(discount, now)) return reject('This code has expired.');
  if (discount.usageCap > 0 && redemptions >= discount.usageCap) {
    return reject('This code has reached its usage limit.');
  }
  if (subtotal < discount.minOrder) {
    return reject(`Spend at least ₹${discount.minOrder} to use this code.`);
  }

  // Base the discount on the whole order, or only the eligible category.
  const base =
    discount.appliesTo === 'all'
      ? subtotal
      : lines
          .filter((l) => l.category === discount.appliesTo)
          .reduce((sum, l) => sum + l.lineTotal, 0);
  if (base <= 0) return reject('No items in your cart qualify for this code.');

  const raw =
    discount.type === 'percent'
      ? Math.round((base * discount.value) / 100)
      : Math.min(discount.value, base);
  const amount = Math.max(0, Math.min(raw, base));
  return { code: discount.code, amount };
}

/**
 * Full server-side pricing of a cart: re-price items, apply an optional
 * discount code, return the authoritative total.
 */
export function priceCart(args: {
  catalog: Product[];
  discounts: DiscountRecord[];
  items: CartItem[];
  code?: string | null;
  redemptions?: number;
  now?: Date;
}): CartPricing {
  const { catalog, discounts, items, code, redemptions = 0, now = new Date() } = args;
  const { lines, subtotal, errors } = priceItems(catalog, items);

  let discount: DiscountResult = { code: null, amount: 0 };
  if (code) {
    const normalized = code.trim().toUpperCase();
    const record = discounts.find((d) => d.code.toUpperCase() === normalized);
    discount = record
      ? evaluateDiscount(record, lines, subtotal, redemptions, now)
      : { code: null, amount: 0, reason: 'That code was not recognised.' };
  }

  const total = Math.max(0, subtotal - discount.amount);
  return { lines, subtotal, discount, total, errors };
}
