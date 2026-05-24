/**
 * GET /llms.txt
 *
 * Curated, machine-friendly site summary in the emerging llms.txt format
 * (answer engines like ChatGPT / Perplexity / Google AI Overviews fetch this
 * as a clean, citable index of the brand's surfaces).
 */
import type { APIRoute } from 'astro';
import { getCatalog } from '@ghritam/commerce';
import { getDB } from '../lib/db';
import { listJournal } from '../lib/journal';

export const prerender = false;

export const GET: APIRoute = async ({ locals, site }) => {
  const origin = (site ?? new URL('https://ghritam.pages.dev')).origin;
  const products = await getCatalog(getDB(locals));
  const essays = listJournal();

  const oneLine = (s: string) => s.trim().replace(/\s+/g, ' ');

  const body = [
    '# Ghritam',
    '',
    '> A natural-food brand rooted in Indic culture. Whole foods as nature intended — A2 ghee from Gir cows, raw forest honey from Sundarban beekeepers, kishmish from Kinnaur, walnuts from Shopian. Sourced directly from village makers; no fortification, no preservatives. Batch-by-batch variation is a feature, not a defect.',
    '',
    '## Catalog',
    '',
    ...products.map(
      (p) => `- [${p.name}](${origin}/foods/${p.slug}): ${p.origin}. ${oneLine(p.note)}`,
    ),
    '',
    '## Philosophy',
    '',
    `- [Why we started Ghritam](${origin}/philosophy): A letter from the founder on natural food, terroir and the body.`,
    '',
    '## Journal',
    '',
    ...essays.map(
      (e) => `- [${e.title}](${origin}/journal/${e.slug}): ${oneLine(e.excerpt)}`,
    ),
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
