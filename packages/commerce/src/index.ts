/**
 * @ghritam/commerce — public surface.
 *
 * Framework-agnostic catalog + commerce logic. All money math and the Razorpay
 * client are pure TypeScript so they run unchanged on the edge and are
 * unit-tested without a browser or a server.
 */
export * from './types.ts';
export { catalog, shlokas, findProduct } from './seed.ts';
export { getCatalog, getProductBySlug, getDiscounts } from './catalog-d1.ts';
export { syncCatalogToD1 } from './sync.ts';
export type { CatalogSnapshot, SyncResult } from './sync.ts';

export {
  cartCount,
  cartSubtotal,
  addLine,
  setQty,
  removeLine,
  toCartItems,
  MAX_QTY_PER_LINE,
} from './cart.ts';
export type { CartItem, CartLine } from './cart.ts';

export { priceItems, evaluateDiscount, priceCart } from './pricing.ts';
export type { PricedLine, DiscountResult, CartPricing } from './pricing.ts';

export { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } from './razorpay.ts';
export type { RazorpayOrder } from './razorpay.ts';

export {
  insertPendingOrder,
  getOrder,
  getOrderByRazorpayId,
  finalizeOrder,
  countRedemptions,
} from './orders.ts';
export type { OrderInput, OrderRow, FinalizeResult } from './orders.ts';

import type { Product, PriceRange } from './types.ts';

/** Format a whole-rupee amount as `₹1,480` using the Indian digit grouping. */
export function formatINR(rupees: number): string {
  return '₹' + rupees.toLocaleString('en-IN');
}

/** Cheapest / dearest variant price for a product. */
export function priceRange(product: Product): PriceRange {
  const prices = product.variants.map((v) => v.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max, single: min === max };
}

/** Display string for a product's price: `₹520` or `₹480 – ₹520`. */
export function formatPriceRange(product: Product): string {
  const range = priceRange(product);
  return range.single
    ? formatINR(range.min)
    : `${formatINR(range.min)} – ${formatINR(range.max)}`;
}

/** True when at least one variant has stock. */
export function inStock(product: Product): boolean {
  return product.variants.some((v) => v.stock > 0);
}

/** Total units in stock across all of a product's variants. */
export function totalStock(product: Product): number {
  return product.variants.reduce((sum, v) => sum + v.stock, 0);
}
