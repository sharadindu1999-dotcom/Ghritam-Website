/**
 * Journal reader.
 *
 * Entries match the Keystatic shape for `format: { contentField: 'content' }`:
 * one `index.md` per slug with YAML frontmatter + markdoc body. Files are
 * bundled at build time via `import.meta.glob` (no Node `fs` at runtime, so
 * this works on Cloudflare Workers), and the markdoc body is rendered to HTML
 * once per build.
 *
 * Journal updates require a Pages rebuild — catalog updates don't — matching
 * the plan: journal is build-time, catalog is instant-via-D1.
 */
import Markdoc from '@markdoc/markdoc';
import { parse as parseYAML } from 'yaml';

interface JournalFrontmatter {
  title: string;
  devSeed: string;
  excerpt: string;
  readingTime?: number;
  publishedDate?: string | null;
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

const rawModules = import.meta.glob<string>(
  '../../content/journal/*/index.md',
  { eager: true, import: 'default', query: '?raw' },
);

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function splitFrontmatter(raw: string): { data: JournalFrontmatter; body: string } {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { data: {} as JournalFrontmatter, body: raw };
  return {
    data: (parseYAML(match[1]!) ?? {}) as JournalFrontmatter,
    body: match[2] ?? '',
  };
}

function slugFromPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 2] ?? '';
}

function renderMarkdoc(body: string): string {
  const ast = Markdoc.parse(body);
  const tree = Markdoc.transform(ast);
  return Markdoc.renderers.html(tree);
}

const entries: JournalEntryFull[] = Object.entries(rawModules)
  .map(([path, raw]) => {
    const slug = slugFromPath(path);
    const { data, body } = splitFrontmatter(raw);
    return {
      slug,
      title: data.title,
      devSeed: data.devSeed,
      excerpt: data.excerpt,
      readingTime: data.readingTime ?? 5,
      publishedDate: data.publishedDate ?? null,
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
