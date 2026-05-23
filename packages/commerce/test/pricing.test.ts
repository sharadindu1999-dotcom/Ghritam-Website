import { describe, it, expect } from 'vitest';
import { priceItems, evaluateDiscount, priceCart } from '../src/pricing.ts';
import type { Product, DiscountRecord } from '../src/types.ts';

function product(over: Partial<Product> & Pick<Product, 'slug' | 'category' | 'variants'>): Product {
  return {
    id: over.slug,
    name: over.slug,
    dev: 'x',
    origin: '',
    story: '',
    note: '',
    inSeason: true,
    maker: { name: '', place: '', blurb: '' },
    shlokaKey: 'annam',
    badges: [],
    ...over,
  };
}

const ghee = product({
  slug: 'ghee',
  category: 'dairy',
  variants: [
    { sku: 'G1', label: '500ml', price: 1000, batch: '', stock: 5 },
    { sku: 'G2', label: '1L', price: 1800, batch: '', stock: 0 },
  ],
});
const walnut = product({
  slug: 'walnut',
  category: 'mountain',
  variants: [{ sku: 'W1', label: '500g', price: 800, batch: '', stock: 10 }],
});
const catalog = [ghee, walnut];

const discount = (over: Partial<DiscountRecord>): DiscountRecord => ({
  code: 'CODE',
  type: 'percent',
  value: 10,
  minOrder: 0,
  appliesTo: 'all',
  validFrom: null,
  validTo: null,
  usageCap: 0,
  active: true,
  ...over,
});

describe('priceItems', () => {
  it('prices from the catalog, not from any client-supplied price', () => {
    const { lines, subtotal } = priceItems(catalog, [{ sku: 'G1', qty: 2 }]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.unitPrice).toBe(1000);
    expect(lines[0]!.lineTotal).toBe(2000);
    expect(subtotal).toBe(2000);
  });

  it('rejects unknown SKUs', () => {
    const { lines, errors } = priceItems(catalog, [{ sku: 'NOPE', qty: 1 }]);
    expect(lines).toHaveLength(0);
    expect(errors[0]).toMatch(/unknown/i);
  });

  it('rejects sold-out variants and over-stock quantities', () => {
    expect(priceItems(catalog, [{ sku: 'G2', qty: 1 }]).errors[0]).toMatch(/sold out/i);
    expect(priceItems(catalog, [{ sku: 'G1', qty: 99 }]).errors[0]).toMatch(/only 5/i);
  });
});

describe('evaluateDiscount', () => {
  const now = new Date('2026-06-01');
  const lines = priceItems(catalog, [
    { sku: 'G1', qty: 1 },
    { sku: 'W1', qty: 1 },
  ]).lines;
  const subtotal = 1800;

  it('applies a percentage to the whole order', () => {
    const r = evaluateDiscount(discount({ value: 10 }), lines, subtotal, 0, now);
    expect(r.amount).toBe(180);
  });

  it('applies a flat discount only to the eligible category', () => {
    const r = evaluateDiscount(
      discount({ type: 'flat', value: 100, appliesTo: 'mountain' }),
      lines,
      subtotal,
      0,
      now,
    );
    expect(r.amount).toBe(100);
    expect(r.code).toBe('CODE');
  });

  it('rejects expired codes', () => {
    const r = evaluateDiscount(discount({ validTo: '2020-01-01' }), lines, subtotal, 0, now);
    expect(r.amount).toBe(0);
    expect(r.reason).toMatch(/expired/i);
  });

  it('rejects when the minimum order is not met', () => {
    const r = evaluateDiscount(discount({ minOrder: 5000 }), lines, subtotal, 0, now);
    expect(r.reason).toMatch(/at least/i);
  });

  it('rejects when the usage cap is reached', () => {
    const r = evaluateDiscount(discount({ usageCap: 3 }), lines, subtotal, 3, now);
    expect(r.reason).toMatch(/usage limit/i);
  });

  it('rejects a category code when nothing qualifies', () => {
    const dairyOnly = priceItems(catalog, [{ sku: 'G1', qty: 1 }]).lines;
    const r = evaluateDiscount(discount({ appliesTo: 'mountain' }), dairyOnly, 1000, 0, now);
    expect(r.reason).toMatch(/qualif/i);
  });
});

describe('priceCart', () => {
  it('produces an authoritative total with a valid code', () => {
    const result = priceCart({
      catalog,
      discounts: [discount({ code: 'TEN', value: 10 })],
      items: [{ sku: 'G1', qty: 2 }],
      code: 'ten',
      now: new Date('2026-06-01'),
    });
    expect(result.subtotal).toBe(2000);
    expect(result.discount.amount).toBe(200);
    expect(result.total).toBe(1800);
  });

  it('flags an unrecognised code but still prices the cart', () => {
    const result = priceCart({
      catalog,
      discounts: [],
      items: [{ sku: 'W1', qty: 1 }],
      code: 'BOGUS',
    });
    expect(result.total).toBe(800);
    expect(result.discount.reason).toMatch(/not recognised/i);
  });
});
