# Deploying Ghritam

Target: **Cloudflare Pages** (static CDN + Functions) with **D1**. Fixed cost: $0.

## 1. Database (D1)

```sh
cd apps/storefront
wrangler d1 create ghritam            # paste the returned database_id into wrangler.jsonc
pnpm db:migrate:remote                # apply migrations/0001_init.sql to the remote DB
```

Local development uses a SQLite file under `.wrangler/` — run `pnpm db:migrate`
once, then `pnpm dev`.

## 2. Cloudflare Pages project

- Connect the GitHub repo.
- Build command: `pnpm build` · output dir: `apps/storefront/dist` · root: repo root.
- Bind the D1 database as **`DB`** in the Pages project settings.
- **Build watch paths:** set to ignore `apps/storefront/content/products/*` and
  `apps/storefront/content/discounts/*` — catalog edits are pushed to D1 by the
  sync webhook and must *not* trigger a full rebuild.

## 3. Secrets (Pages → Settings → Environment variables)

See `apps/storefront/.env.example`. Minimum for Phase 2:
`KEYSTATIC_REPO`, `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`, `CONTENT_REF`.
Phase 3 adds the Razorpay + Resend keys.

## 4. Catalog sync webhook

In the GitHub repo → Settings → Webhooks, add:

- Payload URL: `https://<your-site>/api/sync/catalog`
- Content type: **`application/json`** (required — other types are rejected by
  CSRF protection)
- Secret: same value as `GITHUB_WEBHOOK_SECRET`
- Event: **Just the `push` event**

Every push then refreshes the D1 catalog replica within seconds. To sync
manually: `curl -X POST -H 'Content-Type: application/json' -H 'Authorization: Bearer <SYNC_SECRET>' https://<your-site>/api/sync/catalog`.

## 5. Payments (Razorpay)

Set as Pages secrets:

- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — from the Razorpay dashboard (use
  `rzp_test_*` keys until you go live).
- `RAZORPAY_WEBHOOK_SECRET` — set when creating the webhook below.
- `RESEND_API_KEY` + `ORDER_EMAIL_FROM` — optional; order-confirmation email.
  Without them the order still completes, just no email is sent.

Razorpay dashboard → Settings → Webhooks → add:

- URL: `https://<your-site>/api/webhooks/razorpay`
- Secret: same as `RAZORPAY_WEBHOOK_SECRET`
- Active events: `payment.captured`, `order.paid`

The webhook reconciles payments server-to-server, so an order finalizes even if
the buyer closes the tab before the in-page verification runs.

## 6. Keystatic CMS

`/keystatic` is the editing UI. In production it uses GitHub storage — create a
Keystatic GitHub App (it walks you through it on first load) and set the
`KEYSTATIC_GITHUB_*` / `KEYSTATIC_SECRET` / `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`
secrets. Edits commit to the repo, which triggers the sync webhook above.
