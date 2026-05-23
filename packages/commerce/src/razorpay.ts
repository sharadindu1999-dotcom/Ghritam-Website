/**
 * Razorpay client — Orders API + signature verification.
 *
 * Uses the REST API over `fetch` (no SDK) so it runs unchanged on the
 * Cloudflare Workers runtime. Card/UPI data never touches our servers — that
 * stays inside Razorpay's hosted Checkout widget.
 */

const RAZORPAY_API = 'https://api.razorpay.com/v1';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** Create a Razorpay order. `amountPaise` is the total in paise (rupees × 100). */
export async function createRazorpayOrder(opts: {
  keyId: string;
  keySecret: string;
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const auth = btoa(`${opts.keyId}:${opts.keySecret}`);
  const res = await fetch(`${RAZORPAY_API}/orders`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      amount: opts.amountPaise,
      currency: 'INR',
      receipt: opts.receipt,
      notes: opts.notes,
    }),
  });
  if (!res.ok) {
    throw new Error(`Razorpay order creation failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/**
 * Verify the signature returned by Razorpay Checkout on a successful payment.
 * Razorpay signs `${razorpayOrderId}|${razorpayPaymentId}` with the key secret.
 */
export async function verifyPaymentSignature(opts: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
  keySecret: string;
}): Promise<boolean> {
  const expected = await hmacSha256Hex(
    opts.keySecret,
    `${opts.razorpayOrderId}|${opts.razorpayPaymentId}`,
  );
  return timingSafeEqual(expected, opts.signature);
}

/** Verify an inbound Razorpay webhook against the raw request body. */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): Promise<boolean> {
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  return timingSafeEqual(expected, signature);
}
