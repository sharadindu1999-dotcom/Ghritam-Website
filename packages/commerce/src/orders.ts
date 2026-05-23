/**
 * D1 order persistence.
 *
 * Orders are owned by D1 (unlike the catalog, which is a replica). `finalizeOrder`
 * is idempotent — the verify endpoint and the Razorpay webhook both call it, and
 * only the first wins the `status='pending'` claim, so stock is decremented and
 * the discount redemption recorded exactly once.
 */
import type { D1Database } from './types.ts';
import type { PricedLine } from './pricing.ts';

export interface OrderInput {
  id: string;
  email: string;
  phone: string;
  address: Record<string, unknown>;
  lines: PricedLine[];
  subtotal: number;
  discountCode: string | null;
  discountAmount: number;
  total: number;
  razorpayOrderId: string;
}

export interface OrderRow {
  id: string;
  status: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  items: string;
  subtotal: number;
  discount_code: string | null;
  discount_amount: number;
  total: number;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Compact line items as persisted in the order row. */
interface StoredItem {
  sku: string;
  qty: number;
  name: string;
  variant: string;
  unitPrice: number;
}

const INSERT_ORDER = `INSERT INTO orders
  (id, status, email, phone, address, items, subtotal,
   discount_code, discount_amount, total, razorpay_order_id)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`;

/** Write a `pending` order ahead of redirecting the buyer to Razorpay. */
export async function insertPendingOrder(db: D1Database, o: OrderInput): Promise<void> {
  const items: StoredItem[] = o.lines.map((l) => ({
    sku: l.sku,
    qty: l.qty,
    name: l.productName,
    variant: l.variantLabel,
    unitPrice: l.unitPrice,
  }));
  await db
    .prepare(INSERT_ORDER)
    .bind(
      o.id,
      'pending',
      o.email,
      o.phone,
      JSON.stringify(o.address),
      JSON.stringify(items),
      o.subtotal,
      o.discountCode,
      o.discountAmount,
      o.total,
      o.razorpayOrderId,
    )
    .run();
}

export async function getOrder(db: D1Database, id: string): Promise<OrderRow | null> {
  return db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();
}

export async function getOrderByRazorpayId(
  db: D1Database,
  razorpayOrderId: string,
): Promise<OrderRow | null> {
  return db
    .prepare('SELECT * FROM orders WHERE razorpay_order_id = ?')
    .bind(razorpayOrderId)
    .first<OrderRow>();
}

export interface FinalizeResult {
  /** True when this call transitioned the order to paid. */
  finalized: boolean;
  /** True when the order was already paid (idempotent no-op). */
  alreadyDone: boolean;
  /** True when no matching order was found. */
  notFound: boolean;
}

/**
 * Mark an order paid, decrement stock and record any discount redemption.
 * Safe to call repeatedly and concurrently — only the first caller acts.
 */
export async function finalizeOrder(
  db: D1Database,
  opts: { orderId?: string; razorpayOrderId?: string; paymentId: string },
): Promise<FinalizeResult> {
  const order = opts.orderId
    ? await getOrder(db, opts.orderId)
    : opts.razorpayOrderId
      ? await getOrderByRazorpayId(db, opts.razorpayOrderId)
      : null;
  if (!order) return { finalized: false, alreadyDone: false, notFound: true };

  // Atomically claim the order; 0 rows changed means someone else got there first.
  const claim = await db
    .prepare(
      `UPDATE orders SET status = 'paid', razorpay_payment_id = ?,
       updated_at = datetime('now') WHERE id = ? AND status = 'pending'`,
    )
    .bind(opts.paymentId, order.id)
    .run();
  if (claim.meta.changes === 0) {
    return { finalized: false, alreadyDone: true, notFound: false };
  }

  const items = JSON.parse(order.items) as StoredItem[];
  const statements = items.map((it) =>
    db
      .prepare('UPDATE variants SET stock = MAX(0, stock - ?) WHERE sku = ?')
      .bind(it.qty, it.sku),
  );
  if (order.discount_code) {
    statements.push(
      db
        .prepare('INSERT INTO discount_redemptions (code, order_id) VALUES (?, ?)')
        .bind(order.discount_code, order.id),
    );
  }
  if (statements.length > 0) await db.batch(statements);

  return { finalized: true, alreadyDone: false, notFound: false };
}

/** How many times a discount code has been redeemed (for the usage cap). */
export async function countRedemptions(db: D1Database, code: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS c FROM discount_redemptions WHERE code = ?')
    .bind(code)
    .first<{ c: number }>();
  return row?.c ?? 0;
}
