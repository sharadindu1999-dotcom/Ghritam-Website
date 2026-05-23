/**
 * Access the Cloudflare D1 binding and environment from an Astro request.
 *
 * Bindings come from `Astro.locals.runtime.env` (populated from wrangler.jsonc
 * in dev via platformProxy, and by the real runtime in production).
 *
 * `getDB()` returns `undefined` when no binding is present, so the
 * `@ghritam/commerce` readers can fall back to the seed catalog.
 */
import type { D1Database } from '@ghritam/commerce';

export function getDB(locals: App.Locals): D1Database | undefined {
  return locals.runtime?.env?.DB as unknown as D1Database | undefined;
}

export function getEnv(locals: App.Locals): Partial<CloudflareEnv> {
  return (locals.runtime?.env ?? {}) as Partial<CloudflareEnv>;
}
