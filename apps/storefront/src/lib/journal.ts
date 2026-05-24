/**
 * Journal reader.
 *
 * Entries are bundled at build time via Vite's `import.meta.glob` — no Node
 * `fs` calls, so this works unchanged on the Cloudflare Workers runtime. The
 * markdoc body of every entry is parsed and rendered to HTML once at build,
 * then served as plain HTML at request time.
 *
 * Tradeoff: journal updates require a Pages rebuild (catalog updates don't —
 * they go through the D1 sync). That matches the plan: journal is build-time.
 */
import Markdoc from '@markdoc/markdoc';

interface JournalFrontmatter {
  title: string;
  devSeed: string;
  excerpt: string;
  readingTime: number;
  publishedDate: string | null;
}

export interface JournalEntry {
  slug: string;
  title: string;
  devSeed: string;
  excerpt: string;
  readingTime: number;
  publishedDate: string | null;
}

export interface JournalEntryFull extends JournalEntry {
  /** Markdoc body, rendered to HTML at build. */
  html: string;
}

const metaModules = import.meta.glob<JournalFrontmatter>(
  '../../content/journal/*/index.json',
  { eager: true, import: 'default' },
);

const bodyModules = import.meta.glob<string>(
  '../../content/journal/*/content.md',
  { eager: true, import: 'default', query: '?raw' },
);

function slugFromPath(path: string): string {
  // .../content/journal/<slug>/index.json → <slug>
  const parts = path.split('/');
  return parts[parts.length - 2] ?? '';
}

function renderMarkdoc(body: string): string {
  const ast = Markdoc.parse(body);
  const tree = Markdoc.transform(ast);
  return Markdoc.renderers.html(tree);
}

const entries: JournalEntryFull[] = Object.entries(metaModules)
  .map(([path, meta]) => {
    const slug = slugFromPath(path);
    const bodyPath = path.replace('index.json', 'content.md');
    const body = bodyModules[bodyPath] ?? '';
    return {
      slug,
      title: meta.title,
      devSeed: meta.devSeed,
      excerpt: meta.excerpt,
      readingTime: meta.readingTime ?? 5,
      publishedDate: meta.publishedDate ?? null,
      html: renderMarkdoc(body),
    };
  })
  .sort((a, b) => (b.publishedDate ?? '').localeCompare(a.publishedDate ?? ''));

const bySlug = new Map(entries.map((e) => [e.slug, e]));

function toMeta(e: JournalEntryFull): JournalEntry {
  const { html: _html, ...meta } = e;
  return meta;
}

export function listJournal(): JournalEntry[] {
  return entries.map(toMeta);
}

export function latestJournal(): JournalEntry | undefined {
  const first = entries[0];
  return first ? toMeta(first) : undefined;
}

export function getJournal(slug: string): JournalEntryFull | undefined {
  return bySlug.get(slug);
}
