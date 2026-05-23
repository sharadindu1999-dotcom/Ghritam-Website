/**
 * POST /api/webhooks/razorpay
 *
 * Server-to-server reconciliation. Razorpay calls this independently of the
 * browser, so an order still finalizes even if the buyer closed the tab before
 * /api/checkout/verify ran. `finalizeOrder` is idempotent, so a double-finalize
 * (verify + webhook) is harmless.
 */
import type { APIRoute } from 'astro';
import { verifyWebhookSignature, finalizeOrder, getOrderByRazorpayId } from '@ghritam/commerce';
import { getDB, getEnv } from '../../../lib/db';
import { json } from '../../../lib/http';
import { sendOrderEmail } from '../../../lib/email';

export const prerender = false;

interface RazorpayEvent {
  event?: string;
  payload?: { payment?: { entity?: { order_id?: string; id?: string } } };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const db = getDB(locals);
  const env = getEnv(locals);
  if (!db || !env.RAZORPAY_WEBHOOK_SECRET) return json({ ok: false }, 503);

  const raw = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  if (!signature || !(await verifyWebhookSignature(raw, signature, env.RAZORPAY_WEBHOOK_SECRET))) {
    return json({ ok: false }, 400);
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(raw) as RazorpayEvent;
  } catch {
    return json({ ok: false }, 400);
  }

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    const entity = event.payload?.payment?.entity;
    if (entity?.order_id && entity.id) {
      const result = await finalizeOrder(db, {
        razorpayOrderId: entity.order_id,
        paymentId: entity.id,
      });
      if (result.finalized) {
        const order = await getOrderByRazorpayId(db, entity.order_id);
        if (order) await sendOrderEmail(env, order);
      }
    }
  }

  // Always 200 — a non-2xx makes Razorpay retry the webhook indefinitely.
  return json({ ok: true });
};
