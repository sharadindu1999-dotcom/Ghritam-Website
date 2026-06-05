<script lang="ts">
  /**
   * Checkout island — order summary, customer form, discount code, and the
   * hosted payment-widget flow. Prices shown here are indicative; the server
   * re-prices in /api/checkout/create-order and that is what is charged.
   */
  import { cart, clearCart } from '../lib/cartStore';
  import { cartCount, cartSubtotal, formatINR, toCartItems } from '@ghritam/commerce';

  type Stage = 'form' | 'paying' | 'success' | 'error';
  let stage = $state<Stage>('form');
  let message = $state('');
  let paidOrderId = $state('');

  const count = $derived(cartCount($cart));
  const subtotal = $derived(cartSubtotal($cart));

  // Customer fields — basic contact + shipping address only. No payment data
  // is collected here; card/UPI entry happens inside the hosted payment widget.
  let name = $state('');
  let email = $state('');
  let phone = $state('');
  let line = $state('');
  let city = $state('');
  let state_ = $state('');
  let pincode = $state('');
  let code = $state('');

  function loadRazorpay(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve();
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not reach the payment provider.'));
      document.head.appendChild(s);
    });
  }

  async function placeOrder(e: SubmitEvent) {
    e.preventDefault();
    if (count === 0) return;
    stage = 'paying';
    message = '';
    try {
      const res = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: toCartItems($cart),
          code: code.trim() || null,
          customer: { name, email, phone, address: { line, city, state: state_, pincode } },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        stage = 'error';
        message = data.message || 'We could not start your order. Please try again.';
        return;
      }

      await loadRazorpay();
      const Razorpay = (window as unknown as { Razorpay: new (o: unknown) => { open(): void } })
        .Razorpay;
      const rzp = new Razorpay({
        key: data.keyId,
        order_id: data.razorpayOrderId,
        amount: data.amountPaise,
        currency: 'INR',
        name: 'Ghritam',
        description: `Order ${data.orderId}`,
        prefill: { name, email, contact: phone },
        theme: { color: '#1a1614' },
        handler: (resp: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => verify(data.orderId, resp),
        modal: {
          ondismiss: () => {
            stage = 'form';
            message = 'Payment was not completed.';
          },
        },
      });
      rzp.open();
    } catch (err) {
      stage = 'error';
      message = err instanceof Error ? err.message : 'Something went wrong.';
    }
  }

  async function verify(
    orderId: string,
    resp: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    },
  ) {
    stage = 'paying';
    try {
      const res = await fetch('/api/checkout/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, ...resp }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        paidOrderId = orderId;
        clearCart();
        stage = 'success';
      } else {
        stage = 'error';
        message = data.message || 'We could not confirm your payment. Contact us with your order id.';
      }
    } catch {
      stage = 'error';
      message = 'We could not confirm your payment. Contact us with your order id.';
    }
  }

  const inputClass =
    'w-full border border-ink bg-transparent px-3 py-2.5 font-serif text-ink outline-none focus:border-accent';
  const labelClass = 'mb-1.5 block font-mono text-[9px] uppercase text-ink-3';
</script>

{#if stage === 'success'}
  <div class="px-5 py-16 text-center md:px-10 lg:px-14 lg:py-20">
    <div class="font-dev text-accent" style="font-size:48px">कृतज्ञता</div>
    <h1 class="mt-2 font-serif italic" style="font-size:40px">Thank you.</h1>
    <p class="mx-auto mt-3 max-w-[440px] font-serif text-ink-2" style="font-size:16px">
      Your order is placed. We have emailed the details — a villager somewhere is
      already setting aside your jar.
    </p>
    <div class="mt-4 font-mono text-[10px] uppercase text-ink-3" style="letter-spacing:0.2em">
      Order {paidOrderId}
    </div>
    <a
      href="/foods"
      class="mt-6 inline-block border border-ink px-5 py-3 font-mono text-[11px] uppercase tracking-wide hover:bg-ink hover:text-paper"
      >Continue browsing</a
    >
  </div>
{:else if count === 0}
  <div class="px-5 py-16 text-center md:px-10 lg:px-14 lg:py-20">
    <div class="font-dev text-accent" style="font-size:40px">रिक्तम्</div>
    <p class="mt-3 font-serif italic text-ink-2" style="font-size:18px">
      Your basket is empty.
    </p>
    <a
      href="/foods"
      class="mt-5 inline-block border-b border-ink pb-0.5 font-mono text-[10px] uppercase tracking-wide"
      >Browse our foods →</a
    >
  </div>
{:else}
  <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
    <!-- Customer form -->
    <form onsubmit={placeOrder} class="border-b border-ink px-5 py-8 md:px-10 md:py-10 lg:border-b-0 lg:border-r lg:px-14 lg:py-12">
      <div class="font-mono text-[10px] uppercase text-ink-3" style="letter-spacing:0.3em">
        ॥ ग्राहक ॥ — Where it should travel
      </div>
      <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="col-span-2">
          <label class={labelClass} for="co-name">Full name</label>
          <input id="co-name" class={inputClass} bind:value={name} required />
        </div>
        <div>
          <label class={labelClass} for="co-email">Email</label>
          <input id="co-email" type="email" class={inputClass} bind:value={email} required />
        </div>
        <div>
          <label class={labelClass} for="co-phone">Phone</label>
          <input id="co-phone" type="tel" class={inputClass} bind:value={phone} required />
        </div>
        <div class="col-span-2">
          <label class={labelClass} for="co-line">Address</label>
          <input id="co-line" class={inputClass} bind:value={line} required />
        </div>
        <div>
          <label class={labelClass} for="co-city">City</label>
          <input id="co-city" class={inputClass} bind:value={city} required />
        </div>
        <div>
          <label class={labelClass} for="co-state">State</label>
          <input id="co-state" class={inputClass} bind:value={state_} required />
        </div>
        <div>
          <label class={labelClass} for="co-pin">Pincode</label>
          <input id="co-pin" class={inputClass} bind:value={pincode} required />
        </div>
      </div>

      {#if message}
        <p class="mt-5 font-serif italic text-note" style="font-size:14px">{message}</p>
      {/if}

      <button
        type="submit"
        disabled={stage === 'paying'}
        class="mt-7 w-full cursor-pointer border border-ink bg-ink py-4 font-mono text-sm uppercase tracking-wide text-paper transition-colors hover:bg-ink-2 disabled:opacity-50"
      >
        {stage === 'paying' ? 'One moment…' : `Pay securely · ${formatINR(subtotal)}`}
      </button>
      <p class="mt-2.5 font-serif italic text-ink-3" style="font-size:12px">
        Final total — including any discount — is confirmed on the next screen.
        Card and UPI details are entered through a secure payment widget; we never see them.
      </p>
    </form>

    <!-- Order summary -->
    <aside class="px-5 py-8 md:px-10 md:py-10 lg:py-12">
      <div class="font-mono text-[10px] uppercase text-ink-3" style="letter-spacing:0.3em">
        Your basket
      </div>
      <div class="mt-4">
        {#each $cart as l (l.sku)}
          <div class="flex justify-between border-b border-ink py-3">
            <div>
              <div class="font-serif italic" style="font-size:16px">{l.productName}</div>
              <div class="font-mono text-[9px] uppercase text-ink-3" style="letter-spacing:0.16em">
                {l.variantLabel} × {l.qty}
              </div>
            </div>
            <div class="font-serif" style="font-size:16px">{formatINR(l.unitPrice * l.qty)}</div>
          </div>
        {/each}
      </div>

      <div class="mt-4">
        <label class={labelClass} for="co-code">Discount code</label>
        <input
          id="co-code"
          class={inputClass}
          bind:value={code}
          placeholder="Optional"
          style="text-transform:uppercase"
        />
      </div>

      <div class="mt-5 flex items-baseline justify-between border-t-2 border-ink pt-3">
        <span class="font-mono text-[10px] uppercase text-ink-3" style="letter-spacing:0.2em"
          >Subtotal</span
        >
        <span class="font-serif" style="font-size:24px">{formatINR(subtotal)}</span>
      </div>
    </aside>
  </div>
{/if}
