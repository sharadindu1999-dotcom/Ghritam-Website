/**
 * Edge middleware — Basic Auth gate for the Keystatic admin.
 *
 * Keystatic's GitHub storage gates *writes* (only people the GitHub App
 * is installed on can commit), but the admin UI itself is publicly viewable.
 * This middleware fronts /keystatic and /api/keystatic with HTTP Basic Auth
 * so the route is private end-to-end.
 *
 *   - If BOTH `KEYSTATIC_BASIC_USER` and `KEYSTATIC_BASIC_PASSWORD` are set,
 *     the gate is on — the browser prompts for credentials.
 *   - If either is missing, the gate is off (useful in dev / first deploy).
 *
 * For multiple editors with SSO, Cloudflare Access on /keystatic* is a
 * cleaner upgrade and replaces this gate.
 */
import { defineMiddleware } from 'astro:middleware';

const PROTECTED_PREFIXES = ['/keystatic', '/api/keystatic'];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);
  if (!isProtected(pathname)) return next();

  const env = (context.locals.runtime?.env ?? {}) as Partial<CloudflareEnv>;
  const user = env.KEYSTATIC_BASIC_USER;
  const pass = env.KEYSTATIC_BASIC_PASSWORD;

  // Gate disabled when credentials are not configured.
  if (!user || !pass) return next();

  const header = context.request.headers.get('authorization');
  const expected = 'Basic ' + btoa(`${user}:${pass}`);
  if (header && timingSafeEqual(header, expected)) return next();

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Ghritam CMS", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
});
