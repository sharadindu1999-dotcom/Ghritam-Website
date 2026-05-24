/**
 * Content loader — reads the canonical Keystatic catalog (JSON files) into a
 * `CatalogSnapshot` for the D1 sync.
 *
 *  - dev: reads the working-tree files directly (latest, no rebuild needed)
 *  - prod: fetches the latest committed files from the GitHub contents API
 *
 * Both paths return identical data, so a CMS edit is reflected the moment the
 * sync runs — no site rebuild involved.
 */
import type { Category, CatalogSnapshot, DiscountRecord, Product } from '@ghritam/commerce';

interface ProductJson {
  name: string;
  handle: string;
  dev: string;
  category: string;
  origin: string;
  story: string;
  note: string;
  inSeason: boolean;
  shlokaKey: string;
  /** Filename only — Keystatic stores the file under public/uploads/products. */
  image?: string | null;
  maker: { name: string; place: string; blurb: string };
  badges: string[];
  variants: { sku: string; label: string; price: number; batch: string; stock: number }[];
}

const PRODUCT_IMAGE_PREFIX = '/uploads/products/';

interface DiscountJson {
  type: 'percent' | 'flat';
  value: number;
  minOrder: number;
  appliesTo: string;
  validFrom: string | null;
  validTo: string | null;
  usageCap: number;
  active: boolean;
}

function productFromJson(slug: string, j: ProductJson): Product {
  return {
    id: j.handle,
    slug,
    dev: j.dev,
    name: j.name,
    category: j.category as Category,
    origin: j.origin,
    story: j.story,
    note: j.note,
    inSeason: j.inSeason,
    maker: j.maker,
    shlokaKey: j.shlokaKey,
    badges: j.badges ?? [],
    variants: j.variants ?? [],
    imagePath: j.image ? `${PRODUCT_IMAGE_PREFIX}${j.image}` : undefined,
  };
}

function discountFromJson(code: string, j: DiscountJson): DiscountRecord {
  return {
    code: code.toUpperCase(),
    type: j.type,
    value: j.value,
    minOrder: j.minOrder ?? 0,
    appliesTo: (j.appliesTo ?? 'all') as DiscountRecord['appliesTo'],
    validFrom: j.validFrom ?? null,
    validTo: j.validTo ?? null,
    usageCap: j.usageCap ?? 0,
    active: j.active ?? false,
  };
}

/* ── dev: working-tree filesystem ───────────────────────────────────────── */

async function loadFromFs(): Promise<CatalogSnapshot> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const root = path.join(process.cwd(), 'content');

  async function readCollection<T>(dir: string): Promise<{ slug: string; data: T }[]> {
    const base = path.join(root, dir);
    let entries: string[] = [];
    try {
      entries = (await fs.readdir(base, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      return [];
    }
    const out: { slug: string; data: T }[] = [];
    for (const slug of entries) {
      const raw = await fs.readFile(path.join(base, slug, 'index.json'), 'utf8');
      out.push({ slug, data: JSON.parse(raw) as T });
    }
    return out;
  }

  const [products, discounts] = await Promise.all([
    readCollection<ProductJson>('products'),
    readCollection<DiscountJson>('discounts'),
  ]);
  return {
    products: products.map((p) => productFromJson(p.slug, p.data)),
    discounts: discounts.map((d) => discountFromJson(d.slug, d.data)),
  };
}

/* ── prod: GitHub contents API ──────────────────────────────────────────── */

interface GitHubEnv {
  repo: string; // "owner/name"
  token?: string;
  ref?: string;
}

async function loadFromGitHub(env: GitHubEnv): Promise<CatalogSnapshot> {
  const ref = env.ref ?? 'main';
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ghritam-sync',
  };
  if (env.token) headers.Authorization = `Bearer ${env.token}`;

  async function readCollection<T>(dir: string): Promise<{ slug: string; data: T }[]> {
    const listUrl = `https://api.github.com/repos/${env.repo}/contents/content/${dir}?ref=${ref}`;
    const listRes = await fetch(listUrl, { headers });
    if (!listRes.ok) {
      if (listRes.status === 404) return [];
      throw new Error(`GitHub list ${dir} failed: ${listRes.status}`);
    }
    const items = (await listRes.json()) as { name: string; type: string }[];
    const dirs = items.filter((i) => i.type === 'dir').map((i) => i.name);
    const out: { slug: string; data: T }[] = [];
    for (const slug of dirs) {
      const fileUrl = `https://api.github.com/repos/${env.repo}/contents/content/${dir}/${slug}/index.json?ref=${ref}`;
      const fileRes = await fetch(fileUrl, {
        headers: { ...headers, Accept: 'application/vnd.github.raw+json' },
      });
      if (!fileRes.ok) continue;
      out.push({ slug, data: (await fileRes.json()) as T });
    }
    return out;
  }

  const [products, discounts] = await Promise.all([
    readCollection<ProductJson>('products'),
    readCollection<DiscountJson>('discounts'),
  ]);
  return {
    products: products.map((p) => productFromJson(p.slug, p.data)),
    discounts: discounts.map((d) => discountFromJson(d.slug, d.data)),
  };
}

/**
 * Load the catalog snapshot from whichever source fits the runtime.
 * In production a GitHub repo (`KEYSTATIC_REPO`) must be configured.
 */
export async function loadCatalogSnapshot(github?: GitHubEnv): Promise<CatalogSnapshot> {
  if (import.meta.env.DEV) return loadFromFs();
  if (!github?.repo) throw new Error('KEYSTATIC_REPO is required to sync in production');
  return loadFromGitHub(github);
}
