/**
 * Framework-agnostic cart core.
 *
 * The cart is a list of `CartLine`s keyed by SKU. Display fields (name, price,
 * label) are carried for rendering only — the server always re-prices from D1
 * at checkout, so a tampered `unitPrice` here can never affect what is charged.
 */

export interface CartItem {
  sku: string;
  qty: number;
}

export interface CartLine extends CartItem {
  productSlug: string;
  productName: string;
  variantLabel: string;
  /** Devanagari seed-word, for the manuscript styling. */
  dev: string;
  /** Display unit price in whole rupees. Not trusted server-side. */
  unitPrice: number;
}

export const MAX_QTY_PER_LINE = 20;

function clampQty(qty: number): number {
  return Math.max(0, Math.min(MAX_QTY_PER_LINE, Math.floor(qty)));
}

/** Total number of units across the cart. */
export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

/** Display subtotal in rupees (indicative — server re-prices at checkout). */
export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
}

/** Add a line, merging quantity if the SKU is already in the cart. */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const existing = lines.find((l) => l.sku === line.sku);
  if (existing) {
    return setQty(lines, line.sku, existing.qty + line.qty);
  }
  const qty = clampQty(line.qty);
  return qty > 0 ? [...lines, { ...line, qty }] : lines;
}

/** Set an exact quantity for a SKU; quantity 0 removes the line. */
export function setQty(lines: CartLine[], sku: string, qty: number): CartLine[] {
  const next = clampQty(qty);
  if (next === 0) return removeLine(lines, sku);
  return lines.map((l) => (l.sku === sku ? { ...l, qty: next } : l));
}

/** Remove a SKU from the cart. */
export function removeLine(lines: CartLine[], sku: string): CartLine[] {
  return lines.filter((l) => l.sku !== sku);
}

/** Reduce the cart to the minimal `{ sku, qty }` payload sent to the server. */
export function toCartItems(lines: CartLine[]): CartItem[] {
  return lines.map((l) => ({ sku: l.sku, qty: l.qty }));
}
