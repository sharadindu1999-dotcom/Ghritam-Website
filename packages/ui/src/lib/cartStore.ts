/**
 * Cart store — a Svelte store over the framework-agnostic cart core.
 *
 * The cart lives in `localStorage`. Every Astro island (`CartButton`,
 * `CartDrawer`, `AddToCart`, `Checkout`) gets its own copy of this module, so
 * mutations broadcast a `window` event and each island re-reads — keeping all
 * islands, and other browser tabs, in sync.
 */
import { writable, get } from 'svelte/store';
import { addLine, removeLine, setQty } from '@ghritam/commerce';
import type { CartLine } from '@ghritam/commerce';

const STORAGE_KEY = 'ghritam:cart';
const SYNC_EVENT = 'ghritam:cart-sync';
const OPEN_EVENT = 'ghritam:cart-open';

function read(): CartLine[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

const store = writable<CartLine[]>(read());

/** Read-only cart store for components (`$cart`). */
export const cart = { subscribe: store.subscribe };

function commit(lines: CartLine[]): void {
  store.set(lines);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* private mode / quota — keep the in-memory cart */
  }
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

if (typeof window !== 'undefined') {
  const refresh = () => store.set(read());
  window.addEventListener(SYNC_EVENT, refresh);
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) refresh();
  });
}

export function addToCart(line: CartLine): void {
  commit(addLine(get(store), line));
  openCart();
}

export function updateQty(sku: string, qty: number): void {
  commit(setQty(get(store), sku, qty));
}

export function removeFromCart(sku: string): void {
  commit(removeLine(get(store), sku));
}

export function clearCart(): void {
  commit([]);
}

/** Ask the cart drawer to open. */
export function openCart(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/** Subscribe to drawer-open requests. Returns an unsubscribe function. */
export function onOpenCart(handler: () => void): () => void {
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}
