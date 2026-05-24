import { config, fields, collection, singleton } from '@keystatic/core';
import { BrandMark } from './src/keystatic/brand';

/**
 * Keystatic CMS — the canonical, git-versioned content store for Ghritam.
 *
 * Catalog content (products, discounts) is committed here as JSON files; a
 * GitHub webhook then syncs it into Cloudflare D1, which the storefront reads
 * at the edge. siteConfig and journal stay build-time.
 *
 * Storage: local filesystem in dev, GitHub in production. Set the repo via the
 * KEYSTATIC_REPO env var ("owner/name").
 */
const repo = (import.meta.env?.KEYSTATIC_REPO ?? 'your-org/ghritam') as `${string}/${string}`;

// Storefront origin used for "Preview" buttons. In production set
// PUBLIC_SITE_URL to your deployed origin; the localhost default works in dev.
const site = (import.meta.env?.PUBLIC_SITE_URL ?? 'http://localhost:4321').replace(/\/$/, '');

export default config({
  storage: import.meta.env?.PROD ? { kind: 'github', repo } : { kind: 'local' },
  ui: {
    brand: { name: 'Ghritam', mark: BrandMark },
    navigation: {
      Catalog: ['products', 'discounts'],
      Editorial: ['journal'],
      Settings: ['siteConfig'],
    },
  },

  collections: {
    /** ─────────── Products ─────────── */
    products: collection({
      label: 'Products',
      slugField: 'name',
      path: 'content/products/*/',
      format: { data: 'json' },
      columns: ['name', 'category', 'inSeason'],
      previewUrl: `${site}/foods/{slug}`,
      schema: {
        name: fields.slug({
          name: {
            label: 'Product name',
            description: 'Customer-facing name. The URL slug is derived from this.',
            validation: { length: { min: 2, max: 80 } },
          },
        }),
        handle: fields.text({
          label: 'Short handle',
          description: 'Lowercase one-word id used internally (e.g. "ghee", "honey").',
          validation: { length: { min: 1, max: 24 }, pattern: { regex: /^[a-z][a-z0-9-]*$/, message: 'Lowercase letters, digits and dashes only.' } },
        }),
        dev: fields.text({
          label: 'Devanagari seed-word',
          description: 'One Sanskrit word that anchors the product (घृत, मधु, द्राक्षा, अक्षोट).',
          validation: { length: { min: 1, max: 12 } },
        }),
        image: fields.image({
          label: 'Product photo',
          description:
            'JPEG/PNG. The hatched placeholder is shown on the site when this is empty.',
          directory: 'public/uploads/products',
          publicPath: '/uploads/products/',
        }),
        category: fields.select({
          label: 'Category',
          description: 'Drives the listing filter on /foods.',
          options: [
            { label: 'Dairy', value: 'dairy' },
            { label: 'Apiary', value: 'apiary' },
            { label: 'Mountain', value: 'mountain' },
          ],
          defaultValue: 'dairy',
        }),
        origin: fields.text({
          label: 'Origin line',
          description: 'One short line, e.g. "From Gir cows, hand-churned in Gujarat".',
          validation: { length: { min: 1, max: 120 } },
        }),
        story: fields.text({
          label: 'Story',
          description: 'Long-form paragraph for the detail page.',
          multiline: true,
          validation: { length: { min: 1 } },
        }),
        note: fields.text({
          label: 'Marginal note',
          description: 'The italic one-liner shown beside the product on the listing.',
          validation: { length: { min: 1, max: 160 } },
        }),
        inSeason: fields.checkbox({
          label: 'In season',
          description: 'Off-season products still show but are filtered out of "In season".',
          defaultValue: true,
        }),
        shlokaKey: fields.select({
          label: 'Shloka',
          description: 'Which Sanskrit citation (from Settings) anchors this product.',
          options: [
            { label: 'Annaṁ Brahman (annam)', value: 'annam' },
            { label: 'Āyur Ghṛtam (ayur)', value: 'ayur' },
            { label: 'Sarve Bhavantu Sukhinaḥ (ahimsa)', value: 'ahimsa' },
          ],
          defaultValue: 'annam',
        }),
        maker: fields.object(
          {
            name: fields.text({
              label: 'Maker name',
              description: 'e.g. "The Patel family".',
              validation: { length: { min: 1 } },
            }),
            place: fields.text({
              label: 'Place',
              description: 'e.g. "Gir, Gujarat".',
              validation: { length: { min: 1 } },
            }),
            blurb: fields.text({
              label: 'Blurb',
              description: 'A short paragraph about the maker, shown on the detail page.',
              multiline: true,
              validation: { length: { min: 1 } },
            }),
          },
          { label: 'Maker' },
        ),
        badges: fields.array(fields.text({ label: 'Badge' }), {
          label: 'Trust badges',
          description: 'Short labels like "A2 Gir cows", "Hand-churned", "Unpasteurised".',
          itemLabel: (props) => props.value || 'Badge',
        }),
        variants: fields.array(
          fields.object({
            sku: fields.text({
              label: 'SKU',
              description: 'Unique across the whole catalog. e.g. GHEE-500.',
              validation: { length: { min: 1 }, pattern: { regex: /^[A-Z0-9-]+$/, message: 'Uppercase letters, digits and dashes.' } },
            }),
            label: fields.text({
              label: 'Variant label',
              description: 'e.g. "500 ml" or "Black · 400 g".',
              validation: { length: { min: 1 } },
            }),
            price: fields.integer({
              label: 'Price (₹, whole rupees)',
              description: 'Integer rupees. Razorpay receives this × 100 as paise.',
              validation: { min: 1 },
            }),
            batch: fields.text({
              label: 'Batch line',
              description: 'e.g. "Batch no. 047 · Kārtika 2025".',
              validation: { length: { min: 1 } },
            }),
            stock: fields.integer({
              label: 'Stock',
              description: 'Units available. 0 = sold out.',
              defaultValue: 0,
              validation: { min: 0 },
            }),
          }),
          {
            label: 'Variants',
            description: 'At least one. Each row is a buyable SKU.',
            itemLabel: (props) =>
              props.fields.label.value
                ? `${props.fields.label.value} · ₹${props.fields.price.value ?? 0}`
                : 'Variant',
          },
        ),
      },
    }),

    /** ─────────── Discounts ─────────── */
    discounts: collection({
      label: 'Discounts',
      slugField: 'code',
      path: 'content/discounts/*/',
      format: { data: 'json' },
      columns: ['code', 'type', 'value', 'active'],
      schema: {
        code: fields.slug({
          name: {
            label: 'Discount code',
            description: 'The code customers type at checkout. Upper-cased automatically.',
            validation: { length: { min: 3, max: 24 } },
          },
        }),
        type: fields.select({
          label: 'Type',
          options: [
            { label: 'Percentage off', value: 'percent' },
            { label: 'Flat amount off (₹)', value: 'flat' },
          ],
          defaultValue: 'percent',
        }),
        value: fields.integer({
          label: 'Value',
          description: 'Percent (e.g. 10 = 10% off) or flat rupees off.',
          validation: { min: 1 },
        }),
        minOrder: fields.integer({
          label: 'Minimum order (₹)',
          description: 'Cart subtotal must be at least this for the code to apply.',
          defaultValue: 0,
          validation: { min: 0 },
        }),
        appliesTo: fields.select({
          label: 'Applies to',
          description: 'Whole catalog, or a single category.',
          options: [
            { label: 'Whole catalog', value: 'all' },
            { label: 'Dairy', value: 'dairy' },
            { label: 'Apiary', value: 'apiary' },
            { label: 'Mountain', value: 'mountain' },
          ],
          defaultValue: 'all',
        }),
        validFrom: fields.date({
          label: 'Valid from',
          description: 'Earliest date the code can be redeemed.',
        }),
        validTo: fields.date({
          label: 'Valid until',
          description: 'Last date the code can be redeemed (inclusive).',
        }),
        usageCap: fields.integer({
          label: 'Usage cap',
          description: 'Maximum total redemptions. 0 = unlimited.',
          defaultValue: 0,
          validation: { min: 0 },
        }),
        active: fields.checkbox({
          label: 'Active',
          description: 'Turn off to disable a code without deleting it.',
          defaultValue: true,
        }),
      },
    }),

    /** ─────────── Journal ─────────── */
    journal: collection({
      label: 'Journal',
      slugField: 'title',
      path: 'content/journal/*/',
      format: { contentField: 'content' },
      columns: ['title', 'publishedDate'],
      previewUrl: `${site}/journal/{slug}`,
      schema: {
        title: fields.slug({
          name: {
            label: 'Title',
            description: 'The essay title. The URL slug is derived from this.',
            validation: { length: { min: 4, max: 140 } },
          },
        }),
        devSeed: fields.text({
          label: 'Devanagari seed-word',
          description: 'One Sanskrit word displayed above the title.',
          validation: { length: { min: 1, max: 12 } },
        }),
        excerpt: fields.text({
          label: 'Excerpt',
          description: 'One paragraph shown on the journal listing and home teaser.',
          multiline: true,
          validation: { length: { min: 1, max: 480 } },
        }),
        readingTime: fields.integer({
          label: 'Reading time (min)',
          description: 'Rough estimate. Whole minutes.',
          defaultValue: 5,
          validation: { min: 1, max: 60 },
        }),
        publishedDate: fields.date({
          label: 'Published date',
          description: 'Sorts the listing newest-first. Future dates appear immediately on rebuild.',
        }),
        content: fields.markdoc({
          label: 'Body',
          extension: 'md',
          description:
            'Write in markdown. Custom tags: `{% shloka key="annam" /%}`, `{% shloka key="ayur" /%}`, `{% shloka key="ahimsa" /%}`, `{% ornament /%}`.',
        }),
      },
    }),
  },

  /** ─────────── Site configuration (singleton) ─────────── */
  singletons: {
    siteConfig: singleton({
      label: 'Site configuration',
      path: 'content/site-config/',
      format: { data: 'json' },
      schema: {
        brandDev: fields.text({
          label: 'Wordmark (Devanagari)',
          description: 'Shown in the header and footer.',
          defaultValue: 'घृतम्',
        }),
        brandLatin: fields.text({
          label: 'Wordmark (Latin)',
          description: 'The English wordmark beside the Devanagari.',
          defaultValue: 'Ghritam',
        }),
        tagline: fields.text({
          label: 'Tagline',
          description: 'The three-word descriptor under the wordmark.',
          defaultValue: 'पुरातन · शुद्ध · सात्त्विक',
        }),
        currency: fields.text({
          label: 'Currency symbol',
          defaultValue: '₹',
          validation: { length: { min: 1, max: 4 } },
        }),
        accent: fields.select({
          label: 'Accent colour',
          description: 'One of the four design presets. Changes the saffron highlight site-wide.',
          options: [
            { label: 'Saffron', value: 'saffron' },
            { label: 'Turmeric', value: 'turmeric' },
            { label: 'Indigo', value: 'indigo' },
            { label: 'Madder', value: 'madder' },
          ],
          defaultValue: 'saffron',
        }),
        heroEdition: fields.text({
          label: 'Hero edition line',
          defaultValue: 'Edition 001 · सर्वप्रथम',
        }),
        heroIntro: fields.text({
          label: 'Hero intro',
          description: 'The italic intro paragraph under the wordmark on the home page.',
          multiline: true,
          defaultValue:
            'Four foods from the village. Whole, seasonal, unmodified — the way Bhārata has eaten for a thousand years.',
        }),
        shlokas: fields.array(
          fields.object({
            key: fields.text({
              label: 'Key',
              description: 'Lowercase identifier used by products and journal tags (annam | ayur | ahimsa).',
              validation: { length: { min: 1, max: 24 } },
            }),
            dev: fields.text({ label: 'Devanagari' }),
            translit: fields.text({ label: 'Transliteration (IAST)' }),
            trans: fields.text({ label: 'English gloss', multiline: true }),
            source: fields.text({ label: 'Source citation' }),
          }),
          {
            label: 'Shlokas',
            description: 'The Sanskrit citations products and essays reference by key.',
            itemLabel: (props) => props.fields.translit.value || 'Shloka',
          },
        ),
      },
    }),
  },
});
