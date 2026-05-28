/**
 * Order confirmation email via AWS SES (SESv2 SendEmail).
 *
 * Best-effort: returns `false` (never throws) when SES is not configured or
 * the call fails, so a flaky email never blocks a paid order from completing.
 *
 * SES requires the From address to be a verified identity (single address or
 * a domain). Set `ORDER_EMAIL_FROM` to a verified sender; without it (or the
 * AWS keys / region) this function no-ops.
 */
import { formatINR } from '@ghritam/commerce';
import type { OrderRow } from '@ghritam/commerce';
import { signAwsRequest } from './aws-sigv4';

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
  if (
    !env.AWS_ACCESS_KEY_ID ||
    !env.AWS_SECRET_ACCESS_KEY ||
    !env.AWS_REGION ||
    !env.ORDER_EMAIL_FROM ||
    !order.email
  ) {
    return false;
  }

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

  const body = JSON.stringify({
    FromEmailAddress: env.ORDER_EMAIL_FROM,
    Destination: { ToAddresses: [order.email] },
    Content: {
      Simple: {
        Subject: { Data: `Ghritam · order ${order.id} confirmed`, Charset: 'UTF-8' },
        Body: { Text: { Data: text, Charset: 'UTF-8' } },
      },
    },
  });

  try {
    const signed = await signAwsRequest({
      method: 'POST',
      url: `https://email.${env.AWS_REGION}.amazonaws.com/v2/email/outbound-emails`,
      region: env.AWS_REGION,
      service: 'ses',
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      body,
      contentType: 'application/json',
    });
    const res = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
      body: signed.body,
    });
    return res.ok;
  } catch {
    return false;
  }
}
