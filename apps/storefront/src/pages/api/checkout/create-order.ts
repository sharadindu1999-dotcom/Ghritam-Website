/**
 * POST /api/checkout/create-order
 *
 * Re-prices the cart from D1 (client prices are never trusted), validates
 * stock and any discount code, creates a Razorpay order, and writes a
 * `pending` order row. Returns what the browser needs to open the widget.
 */
import type { APIRoute } from 'astro';
import {
  getCatalog,
  getDiscounts,
  priceCart,
  countRedemptions,
  createRazorpayOrder,
  insertPendingOrder,
} from '@ghritam/commerce';
import type { CartItem } from '@ghritam/commerce';
import { getDB, getEnv } from '../../../lib/db';
import { json } from '../../../lib/http';

export const prerender = false;

interface Body {
  items?: CartItem[];
  code?: string | null;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: Record<string, unknown>;
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const db = getDB(locals);
  const env = getEnv(locals);
  if (!db) return json({ ok: false, message: 'The store is temporarily unavailable.' }, 503);
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return json({ ok: false, message: 'Payments are not configured yet.' }, 503);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ ok: false, message: 'Bad request.' }, 400);
  }

  const items = (body.items ?? []).filter((i) => i && i.sku && i.qty > 0);
  if (items.length === 0) return json({ ok: false, message: 'Your basket is empty.' }, 400);

  const customer = body.customer ?? {};
  if (!customer.name || !customer.email || !customer.phone) {
    return json(
      { ok: false, field: 'customer', message: 'Please complete your contact details.' },
      400,
    );
  }

  const code = body.code?.trim().toUpperCase() || null;
  const [catalog, discounts] = await Promise.all([getCatalog(db), getDiscounts(db)]);
  const redemptions = code ? await countRedemptions(db, code) : 0;
  const pricing = priceCart({ catalog, discounts, items, code, redemptions });

  if (pricing.errors.length > 0) {
    return json({ ok: false, field: 'items', message: pricing.errors[0] }, 400);
  }
  if (pricing.lines.length === 0) {
    return json({ ok: false, message: 'Your basket is empty.' }, 400);
  }
  if (code && pricing.discount.reason) {
    return json({ ok: false, field: 'discount', message: pricing.discount.reason }, 400);
  }
  if (pricing.total <= 0) {
    return json({ ok: false, message: 'Order total must be greater than zero.' }, 400);
  }

  const orderId = `GHR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const amountPaise = pricing.total * 100;

  let rzpOrder;
  try {
    rzpOrder = await createRazorpayOrder({
      keyId: env.RAZORPAY_KEY_ID,
      keySecret: env.RAZORPAY_KEY_SECRET,
      amountPaise,
      receipt: orderId,
      notes: { orderId },
    });
  } catch {
    return json({ ok: false, message: 'Could not reach the payment provider.' }, 502);
  }

  await insertPendingOrder(db, {
    id: orderId,
    email: customer.email,
    phone: customer.phone,
    address: { name: customer.name, ...(customer.address ?? {}) },
    lines: pricing.lines,
    subtotal: pricing.subtotal,
    discountCode: pricing.discount.code,
    discountAmount: pricing.discount.amount,
    total: pricing.total,
    razorpayOrderId: rzpOrder.id,
  });

  return json({
    ok: true,
    orderId,
    razorpayOrderId: rzpOrder.id,
    amountPaise,
    keyId: env.RAZORPAY_KEY_ID,
    total: pricing.total,
    discountAmount: pricing.discount.amount,
  });
};
