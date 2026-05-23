/**
 * Order confirmation email via Resend.
 *
 * Best-effort: returns `false` (never throws) when Resend is not configured or
 * the call fails, so a flaky email never blocks a paid order from completing.
 */
import { formatINR } from '@ghritam/commerce';
import type { OrderRow } from '@ghritam/commerce';

interface StoredItem {
  name: string;
  variant: string;
  qty: number;
  unitPrice: number;
}

export async function sendOrderEmail(
  env: Partial<CloudflareEnv>,
  order: OrderRow,
): Promise<boolean> {
  if (!env.RESEND_API_KEY || !order.email) return false;

  const from = env.ORDER_EMAIL_FROM ?? 'Ghritam <onboarding@resend.dev>';
  let items: StoredItem[] = [];
  try {
    items = JSON.parse(order.items) as StoredItem[];
  } catch {
    /* leave empty */
  }

  const lines = items
    .map((i) => `  ${i.qty} × ${i.name} (${i.variant}) — ${formatINR(i.unitPrice * i.qty)}`)
    .join('\n');
  const text = [
    'Namaste,',
    '',
    `Your Ghritam order ${order.id} is confirmed.`,
    '',
    lines,
    '',
    `Subtotal:    ${formatINR(order.subtotal)}`,
    order.discount_amount > 0 ? `Discount:    −${formatINR(order.discount_amount)}` : '',
    `Total paid:  ${formatINR(order.total)}`,
    '',
    'A villager somewhere is already setting aside your jar.',
    '',
    '— Ghritam · घृतम्',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: order.email,
        subject: `Ghritam · order ${order.id} confirmed`,
        text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
