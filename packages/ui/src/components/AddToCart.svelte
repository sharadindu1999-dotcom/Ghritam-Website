<script lang="ts">
  /** Product-detail island: variant selector + quantity stepper + add button. */
  import type { Product } from '@ghritam/commerce';
  import { formatINR } from '@ghritam/commerce';
  import { addToCart } from '../lib/cartStore';

  let { product }: { product: Product } = $props();

  let selectedSku = $state(product.variants[0]?.sku ?? '');
  let qty = $state(1);

  const variant = $derived(
    product.variants.find((v) => v.sku === selectedSku) ?? product.variants[0],
  );
  const soldOut = $derived(!variant || variant.stock <= 0);
  const maxQty = $derived(Math.min(variant?.stock ?? 0, 20));

  function add() {
    if (!variant || soldOut) return;
    const n = Math.max(1, Math.min(qty, maxQty));
    addToCart({
      sku: variant.sku,
      qty: n,
      productSlug: product.slug,
      productName: product.name,
      variantLabel: variant.label,
      dev: product.dev,
      unitPrice: variant.price,
    });
  }
</script>

<div>
  {#if product.variants.length > 1}
    <div class="mb-2.5 font-mono text-[9px] uppercase text-ink-3" style="letter-spacing:0.22em">
      Choose
    </div>
    <div class="mb-4 flex flex-wrap gap-2">
      {#each product.variants as v (v.sku)}
        <button
          type="button"
          onclick={() => (selectedSku = v.sku)}
          disabled={v.stock <= 0}
          class:bg-ink={v.sku === selectedSku}
          class:text-paper={v.sku === selectedSku}
          class="cursor-pointer border border-ink px-3 py-2 font-mono text-[10px] uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
        >
          {v.label} · {formatINR(v.price)}
        </button>
      {/each}
    </div>
  {/if}

  <div class="flex gap-2.5">
    <div class="flex items-center border border-ink">
      <button
        type="button"
        aria-label="Decrease quantity"
        onclick={() => (qty = Math.max(1, qty - 1))}
        class="cursor-pointer px-3.5 py-4 font-mono text-sm">−</button>
      <span class="w-8 text-center font-mono text-sm">{qty}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onclick={() => (qty = Math.min(maxQty, qty + 1))}
        class="cursor-pointer px-3.5 py-4 font-mono text-sm">+</button>
    </div>
    <button
      type="button"
      onclick={add}
      disabled={soldOut}
      class="flex-1 cursor-pointer border border-ink bg-ink px-[18px] py-4 font-mono text-sm uppercase tracking-wide text-paper transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {soldOut ? 'Sold out' : `Add to cart · ${formatINR((variant?.price ?? 0) * qty)}`}
    </button>
  </div>

  {#if variant && variant.stock > 0 && variant.stock <= 5}
    <div class="mt-2 font-mono text-[9px] uppercase text-note" style="letter-spacing:0.18em">
      Only {variant.stock} left · {variant.batch}
    </div>
  {/if}
</div>
