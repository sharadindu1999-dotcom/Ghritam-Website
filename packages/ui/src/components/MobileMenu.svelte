<script lang="ts">
  /**
   * Mobile-only hamburger menu. Visibility is controlled by the parent
   * (`md:hidden`); this component just owns the button + slide-down panel.
   * The cart row dispatches the same `openCart()` the desktop CartButton does.
   */
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cart, openCart } from '../lib/cartStore';
  import { cartCount } from '@ghritam/commerce';

  let open = $state(false);
  const count = $derived(cartCount($cart));

  const items = [
    { label: 'Home', href: '/' },
    { label: 'Philosophy', href: '/philosophy' },
    { label: 'Our Foods', href: '/foods' },
    { label: 'Journal', href: '/#journal' },
  ];

  function close() {
    open = false;
  }
  function openBasket() {
    close();
    openCart();
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<button
  type="button"
  aria-label={open ? 'Close menu' : 'Open menu'}
  aria-expanded={open}
  onclick={() => (open = !open)}
  class="-mr-1 flex h-11 w-11 cursor-pointer items-center justify-center text-ink"
>
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5">
    <line x1="2" y1="6" x2="20" y2="6" />
    <line x1="2" y1="11" x2="20" y2="11" />
    <line x1="2" y1="16" x2="20" y2="16" />
  </svg>
</button>

{#if open}
  <div
    transition:fade={{ duration: 120 }}
    onclick={close}
    role="presentation"
    class="fixed inset-0 z-[90] bg-black/40"
  ></div>
  <nav
    transition:fly={{ y: -16, duration: 180 }}
    class="fixed inset-x-0 top-0 z-[91] border-b-2 border-ink bg-paper"
  >
    <div class="flex items-center justify-between border-b border-ink px-5 py-4">
      <span class="font-dev text-ink" style="font-size:24px">घृतम्</span>
      <button
        type="button"
        onclick={close}
        aria-label="Close menu"
        class="cursor-pointer font-mono text-sm uppercase tracking-wide hover:text-accent"
        >Close ✕</button
      >
    </div>
    <ul class="flex flex-col">
      {#each items as i (i.href)}
        <li>
          <a
            href={i.href}
            onclick={close}
            class="block border-b border-ink px-5 py-4 font-mono text-sm uppercase tracking-wide hover:text-accent"
            style="letter-spacing:0.18em">{i.label}</a
          >
        </li>
      {/each}
      <li>
        <button
          type="button"
          onclick={openBasket}
          class="block w-full cursor-pointer border-b border-ink px-5 py-4 text-left font-mono text-sm uppercase tracking-wide hover:text-accent"
          style="letter-spacing:0.18em">Cart ({count})</button
        >
      </li>
    </ul>
  </nav>
{/if}
