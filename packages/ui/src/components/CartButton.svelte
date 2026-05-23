<script lang="ts">
  /** Nav cart button — live count, opens the drawer. Replaces the static link. */
  import { cart, openCart } from '../lib/cartStore';
  import { cartCount } from '@ghritam/commerce';

  let { label = 'Cart' }: { label?: string } = $props();
  const count = $derived(cartCount($cart));
</script>

<button
  type="button"
  onclick={openCart}
  class="cursor-pointer border-b border-transparent pb-0.5 text-ink uppercase hover:border-accent"
>
  {label} ({count})
</button>
