/**
 * POST /api/sync/catalog
 *
 * Refreshes the D1 catalog read-replica from the canonical Keystatic content.
 * Triggered by a GitHub webhook on every push (the sync is idempotent), or
 * manually with `Authorization: Bearer <SYNC_SECRET>`.
 */
import type { APIRoute } from 'astro';
import { syncCatalogToD1 } from '@ghritam/commerce';
import { loadCatalogSnapshot } from '../../../lib/content';
import { getDB, getEnv } from '../../../lib/db';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function isAuthorized(
  request: Request,
  rawBody: string,
  env: Partial<CloudflareEnv>,
): Promise<boolean> {
  // Dev: open, so the sync can be exercised with a plain curl.
  if (import.meta.env.DEV) return true;

  // Manual trigger via shared secret.
  const auth = request.headers.get('authorization');
  if (env.SYNC_SECRET && auth === `Bearer ${env.SYNC_SECRET}`) return true;

  // GitHub webhook signature.
  const signature = request.headers.get('x-hub-signature-256');
  if (env.GITHUB_WEBHOOK_SECRET && signature?.startsWith('sha256=')) {
    const expected = `sha256=${await hmacSha256Hex(env.GITHUB_WEBHOOK_SECRET, rawBody)}`;
    return timingSafeEqual(signature, expected);
  }
  return false;
}

/** Best-effort Cloudflare cache purge for the catalog URLs. No-op without creds. */
async function purgeCache(env: Partial<CloudflareEnv>, origin: string): Promise<boolean> {
  if (!env.CF_API_TOKEN || !env.CF_ZONE_ID) return false;
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ files: [`${origin}/foods`, `${origin}/`] }),
    },
  );
  return res.ok;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getEnv(locals);
  const db = getDB(locals);
  if (!db) return json({ error: 'no D1 binding' }, 500);

  const rawBody = await request.text();
  if (!(await isAuthorized(request, rawBody, env))) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    const snapshot = await loadCatalogSnapshot(
      env.KEYSTATIC_REPO
        ? { repo: env.KEYSTATIC_REPO, token: env.GITHUB_TOKEN, ref: env.CONTENT_REF }
        : undefined,
    );
    const result = await syncCatalogToD1(db, snapshot);
    const purged = await purgeCache(env, new URL(request.url).origin);
    return json({ ok: true, synced: result, cachePurged: purged });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
};
