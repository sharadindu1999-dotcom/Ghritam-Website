<script lang="ts">
  /** Slide-over basket. Mounted once in the layout; opened by CartButton. */
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cart, updateQty, removeFromCart, onOpenCart } from '../lib/cartStore';
  import { cartCount, cartSubtotal, formatINR } from '@ghritam/commerce';

  let open = $state(false);
  const count = $derived(cartCount($cart));
  const subtotal = $derived(cartSubtotal($cart));

  function close() {
    open = false;
  }

  onMount(() => {
    const offOpen = onOpenCart(() => (open = true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      offOpen();
      window.removeEventListener('keydown', onKey);
    };
  });
</script>

{#if open}
  <div
    class="fixed inset-0 z-[100] bg-black/60"
    transition:fade={{ duration: 150 }}
    onclick={close}
    role="presentation"
  ></div>
  <aside
    transition:fly={{ x: 440, duration: 220 }}
    class="fixed right-0 top-0 z-[101] flex h-full w-full flex-col bg-paper text-ink sm:max-w-[440px]"
    style="border-left:1px solid var(--color-ink)"
  >
    <header class="flex items-center justify-between border-b border-ink px-7 py-5">
      <div>
        <div class="font-mono text-[9px] uppercase text-ink-3" style="letter-spacing:0.3em">
          ॥ टोकरी ॥
        </div>
        <div class="font-serif italic" style="font-size:24px">Your basket</div>
      </div>
      <button
        type="button"
        onclick={close}
        aria-label="Close basket"
        class="cursor-pointer font-mono text-sm uppercase tracking-wide hover:text-accent">Close ✕</button
      >
    </header>

    <div class="flex-1 overflow-y-auto">
      {#if count === 0}
        <div class="px-7 py-16 text-center">
          <div class="font-dev text-accent" style="font-size:40px">रिक्तम्</div>
          <p class="mt-3 font-serif italic text-ink-2" style="font-size:16px">
            Your basket is empty. The four foods are waiting.
          </p>
          <a
            href="/foods"
            class="mt-5 inline-block border-b border-ink pb-0.5 font-mono text-[10px] uppercase tracking-wide"
            >Browse our foods →</a
          >
        </div>
      {:else}
        {#each $cart as line (line.sku)}
          <article class="flex gap-4 border-b border-ink px-7 py-5">
            <div class="font-dev leading-none text-accent" style="font-size:30px">{line.dev}</div>
            <div class="flex-1">
              <div class="font-serif italic" style="font-size:18px">{line.productName}</div>
              <div class="font-mono text-[9px] uppercase text-ink-3" style="letter-spacing:0.18em">
                {line.variantLabel} · {formatINR(line.unitPrice)}
              </div>
              <div class="mt-2.5 flex items-center gap-3">
                <div class="flex items-center border border-ink">
                  <button
                    type="button"
                    aria-label="Decrease"
                    onclick={() => updateQty(line.sku, line.qty - 1)}
                    class="cursor-pointer px-2.5 py-1.5 font-mono text-xs">−</button
                  >
                  <span class="w-7 text-center font-mono text-xs">{line.qty}</span>
                  <button
                    type="button"
                    aria-label="Increase"
                    onclick={() => updateQty(line.sku, line.qty + 1)}
                    class="cursor-pointer px-2.5 py-1.5 font-mono text-xs">+</button
                  >
                </div>
                <button
                  type="button"
                  onclick={() => removeFromCart(line.sku)}
                  class="cursor-pointer font-mono text-[9px] uppercase tracking-wide text-ink-3 hover:text-note"
                  >Remove</button
                >
              </div>
            </div>
            <div class="font-serif" style="font-size:18px">
              {formatINR(line.unitPrice * line.qty)}
            </div>
          </article>
        {/each}
      {/if}
    </div>

    {#if count > 0}
      <footer class="border-t-2 border-ink px-7 py-5">
        <div class="flex items-baseline justify-between">
          <span class="font-mono text-[10px] uppercase text-ink-3" style="letter-spacing:0.2em"
            >Subtotal · {count} item{count === 1 ? '' : 's'}</span
          >
          <span class="font-serif" style="font-size:24px">{formatINR(subtotal)}</span>
        </div>
        <p class="mt-1.5 font-serif italic text-ink-3" style="font-size:13px">
          Any discount code is applied at checkout.
        </p>
        <a
          href="/checkout"
          class="mt-4 block border border-ink bg-ink py-3.5 text-center font-mono text-sm uppercase tracking-wide text-paper transition-colors hover:bg-ink-2"
          >Proceed to checkout →</a
        >
      </footer>
    {/if}
  </aside>
{/if}
