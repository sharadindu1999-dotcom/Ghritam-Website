/**
 * Sitewide SEO + AEO metadata + JSON-LD builders.
 *
 * Pages compose a small array of schema.org objects and pass them to Layout
 * via the `jsonLd` prop; Layout always emits Organization + WebSite alongside.
 * Answer engines (ChatGPT, Perplexity, Google AI Overviews) and traditional
 * search engines both consume these.
 */

export const BRAND = {
  name: 'Ghritam',
  alternateName: 'घृतम्',
  tagline: 'पुरातन · शुद्ध · सात्त्विक',
  defaultDescription:
    'A natural-food brand rooted in Indic culture. Whole foods as nature intended — A2 bilona ghee from Gir cows, raw forest honey from Sundarban beekeepers, kishmish from Kinnaur, walnuts from Shopian.',
} as const;

type JsonLd = Record<string, unknown>;

/** Sitewide Organization schema. */
export function organizationJsonLd(siteOrigin: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND.name,
    alternateName: BRAND.alternateName,
    url: siteOrigin,
    logo: `${siteOrigin}/favicon.svg`,
    description: BRAND.defaultDescription,
  };
}

/** Sitewide WebSite schema (search-action could be added here later). */
export function websiteJsonLd(siteOrigin: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND.name,
    url: siteOrigin,
    inLanguage: 'en',
    description: BRAND.defaultDescription,
  };
}

/** Map a Product entity to schema.org/Product with aggregated offers. */
export function productJsonLd(
  product: {
    name: string;
    slug: string;
    origin: string;
    story: string;
    category: string;
    imagePath?: string;
    variants: { sku: string; label: string; price: number; stock: number }[];
  },
  siteOrigin: string,
): JsonLd {
  const url = `${siteOrigin}/foods/${product.slug}`;
  const prices = product.variants.map((v) => v.price);
  const inStock = product.variants.some((v) => v.stock > 0);
  const offers =
    product.variants.length > 1
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'INR',
          lowPrice: Math.min(...prices),
          highPrice: Math.max(...prices),
          offerCount: product.variants.length,
          availability: `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}`,
          url,
        }
      : {
          '@type': 'Offer',
          priceCurrency: 'INR',
          price: prices[0] ?? 0,
          availability: `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}`,
          url,
        };
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: `${product.origin}. ${product.story}`.slice(0, 5000),
    sku: product.variants[0]?.sku,
    brand: { '@type': 'Brand', name: BRAND.name },
    category: product.category,
    image: product.imagePath ? [`${siteOrigin}${product.imagePath}`] : undefined,
    offers,
  };
}

/** schema.org/BlogPosting for a journal essay (plus Speakable for AEO). */
export function articleJsonLd(
  essay: {
    title: string;
    slug: string;
    excerpt: string;
    publishedDate: string | null;
  },
  siteOrigin: string,
): JsonLd {
  const url = `${siteOrigin}/journal/${essay.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: essay.title,
    description: essay.excerpt,
    datePublished: essay.publishedDate ?? undefined,
    dateModified: essay.publishedDate ?? undefined,
    author: { '@type': 'Organization', name: BRAND.name, url: siteOrigin },
    publisher: {
      '@type': 'Organization',
      name: BRAND.name,
      logo: { '@type': 'ImageObject', url: `${siteOrigin}/favicon.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    inLanguage: 'en',
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.prose-journal p', '.prose-journal h2'],
    },
  };
}

/** schema.org/BreadcrumbList for a 2- or 3-segment crumb trail. */
export function breadcrumbJsonLd(
  trail: { name: string; url?: string }[],
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.url ? { item: c.url } : {}),
    })),
  };
}

/** schema.org/CollectionPage with an embedded ItemList. */
export function collectionPageJsonLd(args: {
  name: string;
  description: string;
  url: string;
  items: { name: string; url: string }[];
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: args.name,
    description: args.description,
    url: args.url,
    inLanguage: 'en',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: args.items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        url: it.url,
      })),
    },
  };
}
