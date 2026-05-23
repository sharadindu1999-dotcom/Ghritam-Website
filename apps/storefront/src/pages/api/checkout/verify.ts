/**
 * POST /api/checkout/verify
 *
 * Called by the browser after the Razorpay widget reports success. Verifies the
 * payment signature, finalizes the order (idempotent — stock decremented and
 * discount redemption recorded once), and emails the confirmation.
 */
import type { APIRoute } from 'astro';
import { verifyPaymentSignature, finalizeOrder, getOrder } from '@ghritam/commerce';
import { getDB, getEnv } from '../../../lib/db';
import { json } from '../../../lib/http';
import { sendOrderEmail } from '../../../lib/email';

export const prerender = false;

interface Body {
  orderId?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const db = getDB(locals);
  const env = getEnv(locals);
  if (!db || !env.RAZORPAY_KEY_SECRET) {
    return json({ ok: false, message: 'The store is temporarily unavailable.' }, 503);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ ok: false, message: 'Bad request.' }, 400);
  }

  if (
    !body.orderId ||
    !body.razorpay_order_id ||
    !body.razorpay_payment_id ||
    !body.razorpay_signature
  ) {
    return json({ ok: false, message: 'Incomplete payment confirmation.' }, 400);
  }

  const valid = await verifyPaymentSignature({
    razorpayOrderId: body.razorpay_order_id,
    razorpayPaymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
    keySecret: env.RAZORPAY_KEY_SECRET,
  });
  if (!valid) {
    return json({ ok: false, message: 'Payment signature could not be verified.' }, 400);
  }

  const result = await finalizeOrder(db, {
    orderId: body.orderId,
    paymentId: body.razorpay_payment_id,
  });
  if (result.notFound) return json({ ok: false, message: 'Order not found.' }, 404);

  if (result.finalized) {
    const order = await getOrder(db, body.orderId);
    if (order) await sendOrderEmail(env, order);
  }
  return json({ ok: true, orderId: body.orderId });
};
