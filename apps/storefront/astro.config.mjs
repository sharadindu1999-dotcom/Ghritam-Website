// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import keystatic from '@keystatic/astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import { catalog } from '@ghritam/commerce';

// Build sitemap entries at config time so SSR routes (catalog pages, journal
// essays — which @astrojs/sitemap can't auto-enumerate) are included.
const siteUrl = process.env.PUBLIC_SITE_URL ?? 'https://ghritam.pages.dev';

async function listJournalSlugs() {
  try {
    const dirents = await fs.readdir(path.join(process.cwd(), 'content/journal'), {
      withFileTypes: true,
    });
    return dirents.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

const journalSlugs = await listJournalSlugs();
const customPages = [
  `${siteUrl}/`,
  `${siteUrl}/philosophy`,
  `${siteUrl}/foods`,
  `${siteUrl}/journal`,
  ...catalog.map((p) => `${siteUrl}/foods/${p.slug}`),
  ...journalSlugs.map((s) => `${siteUrl}/journal/${s}`),
];

// https://astro.build/config
//
// The static shell stays prerendered; catalog pages and API routes opt into
// edge SSR with `export const prerender = false`. `platformProxy` exposes the
// local D1 binding (see wrangler.jsonc) to `Astro.locals.runtime.env` in dev.
export default defineConfig({
  site: 'https://ghritam.pages.dev',
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  integrations: [
    svelte(),
    react(),
    keystatic(),
    sitemap({
      // Crawlable surfaces only — exclude the CMS, internal APIs, and
      // transactional pages from sitemap + (via robots.txt) from indexing.
      customPages,
      filter: (page) =>
        !page.includes('/keystatic') &&
        !page.includes('/api/') &&
        !page.includes('/checkout'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
