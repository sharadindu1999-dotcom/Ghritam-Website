// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import keystatic from '@keystatic/astro';

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
  integrations: [svelte(), react(), keystatic()],
  vite: {
    plugins: [tailwindcss()],
  },
});
