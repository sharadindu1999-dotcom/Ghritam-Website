import { config, fields, collection, singleton } from '@keystatic/core';

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
const repo = (import.meta.env.KEYSTATIC_REPO ?? 'your-org/ghritam') as `${string}/${string}`;

export default config({
  storage: import.meta.env.PROD ? { kind: 'github', repo } : { kind: 'local' },
  ui: {
    brand: { name: 'Ghritam' },
    navigation: {
      Catalog: ['products', 'discounts'],
      Editorial: ['journal'],
      Settings: ['siteConfig'],
    },
  },

  collections: {
    products: collection({
      label: 'Products',
      slugField: 'name',
      path: 'content/products/*',
      format: { data: 'json' },
      columns: ['name', 'category'],
      schema: {
        name: fields.slug({
          name: { label: 'Product name', description: 'e.g. A2 Bilona Ghee' },
        }),
        handle: fields.text({
          label: 'Short handle',
          description: 'Lowercase one-word id used internally (e.g. "ghee").',
        }),
        dev: fields.text({ label: 'Devanagari seed-word', description: 'e.g. घृत' }),
        category: fields.select({
          label: 'Category',
          options: [
            { label: 'Dairy', value: 'dairy' },
            { label: 'Apiary', value: 'apiary' },
            { label: 'Mountain', value: 'mountain' },
          ],
          defaultValue: 'dairy',
        }),
        origin: fields.text({ label: 'Origin line' }),
        story: fields.text({ label: 'Story', multiline: true }),
        note: fields.text({ label: 'Marginal note' }),
        inSeason: fields.checkbox({ label: 'In season', defaultValue: true }),
        shlokaKey: fields.select({
          label: 'Shloka',
          description: 'Which shloka (from Settings) anchors this product.',
          options: [
            { label: 'Annaṁ Brahman', value: 'annam' },
            { label: 'Āyur Ghṛtam', value: 'ayur' },
            { label: 'Sarve Bhavantu Sukhinaḥ', value: 'ahimsa' },
          ],
          defaultValue: 'annam',
        }),
        maker: fields.object(
          {
            name: fields.text({ label: 'Maker name' }),
            place: fields.text({ label: 'Place' }),
            blurb: fields.text({ label: 'Blurb', multiline: true }),
          },
          { label: 'Maker' },
        ),
        badges: fields.array(fields.text({ label: 'Badge' }), {
          label: 'Trust badges',
          itemLabel: (props) => props.value,
        }),
        variants: fields.array(
          fields.object({
            sku: fields.text({ label: 'SKU' }),
            label: fields.text({ label: 'Variant label', description: 'e.g. 500 ml' }),
            price: fields.integer({ label: 'Price (₹, whole rupees)' }),
            batch: fields.text({ label: 'Batch line' }),
            stock: fields.integer({ label: 'Stock', defaultValue: 0 }),
          }),
          { label: 'Variants', itemLabel: (props) => props.fields.label.value || 'Variant' },
        ),
      },
    }),

    discounts: collection({
      label: 'Discounts',
      slugField: 'code',
      path: 'content/discounts/*',
      format: { data: 'json' },
      columns: ['code', 'type'],
      schema: {
        code: fields.slug({ name: { label: 'Discount code', description: 'e.g. KARTIKA10' } }),
        type: fields.select({
          label: 'Type',
          options: [
            { label: 'Percentage off', value: 'percent' },
            { label: 'Flat amount off (₹)', value: 'flat' },
          ],
          defaultValue: 'percent',
        }),
        value: fields.integer({ label: 'Value', description: 'Percent (e.g. 10) or flat ₹.' }),
        minOrder: fields.integer({ label: 'Minimum order (₹)', defaultValue: 0 }),
        appliesTo: fields.select({
          label: 'Applies to',
          options: [
            { label: 'Whole catalog', value: 'all' },
            { label: 'Dairy', value: 'dairy' },
            { label: 'Apiary', value: 'apiary' },
            { label: 'Mountain', value: 'mountain' },
          ],
          defaultValue: 'all',
        }),
        validFrom: fields.date({ label: 'Valid from' }),
        validTo: fields.date({ label: 'Valid until' }),
        usageCap: fields.integer({
          label: 'Usage cap',
          description: '0 = unlimited.',
          defaultValue: 0,
        }),
        active: fields.checkbox({ label: 'Active', defaultValue: true }),
      },
    }),

    journal: collection({
      label: 'Journal',
      slugField: 'title',
      path: 'content/journal/*',
      format: { contentField: 'content' },
      columns: ['title', 'publishedDate'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        devSeed: fields.text({ label: 'Devanagari seed-word' }),
        excerpt: fields.text({ label: 'Excerpt', multiline: true }),
        readingTime: fields.integer({ label: 'Reading time (min)', defaultValue: 5 }),
        publishedDate: fields.date({ label: 'Published date' }),
        content: fields.markdoc({ label: 'Body', extension: 'md' }),
      },
    }),
  },

  singletons: {
    siteConfig: singleton({
      label: 'Site configuration',
      path: 'content/site-config',
      format: { data: 'json' },
      schema: {
        brandDev: fields.text({ label: 'Wordmark (Devanagari)', defaultValue: 'घृतम्' }),
        brandLatin: fields.text({ label: 'Wordmark (Latin)', defaultValue: 'Ghritam' }),
        tagline: fields.text({
          label: 'Tagline',
          defaultValue: 'पुरातन · शुद्ध · सात्त्विक',
        }),
        currency: fields.text({ label: 'Currency symbol', defaultValue: '₹' }),
        accent: fields.select({
          label: 'Accent colour',
          options: [
            { label: 'Saffron', value: 'saffron' },
            { label: 'Turmeric', value: 'turmeric' },
            { label: 'Indigo', value: 'indigo' },
            { label: 'Madder', value: 'madder' },
          ],
          defaultValue: 'saffron',
        }),
        heroEdition: fields.text({ label: 'Hero edition line', defaultValue: 'Edition 001 · सर्वप्रथम' }),
        heroIntro: fields.text({
          label: 'Hero intro',
          multiline: true,
          defaultValue:
            'Four foods from the village. Whole, seasonal, unmodified — the way Bhārata has eaten for a thousand years.',
        }),
        shlokas: fields.array(
          fields.object({
            key: fields.text({ label: 'Key', description: 'annam | ayur | ahimsa' }),
            dev: fields.text({ label: 'Devanagari' }),
            translit: fields.text({ label: 'Transliteration (IAST)' }),
            trans: fields.text({ label: 'English gloss', multiline: true }),
            source: fields.text({ label: 'Source citation' }),
          }),
          { label: 'Shlokas', itemLabel: (props) => props.fields.translit.value || 'Shloka' },
        ),
      },
    }),
  },
});
