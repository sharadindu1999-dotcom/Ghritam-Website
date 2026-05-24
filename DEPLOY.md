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

## 6. Keystatic CMS — auth, change tracking, previews

`/keystatic` is the editing UI. In production it uses GitHub storage; locally
it writes to the working tree.

### One-time setup (auth)

1. Deploy the storefront once with no Keystatic env vars set.
2. Visit `https://<your-site>/keystatic`. Keystatic shows a "Set up GitHub"
   wizard that walks you through creating a GitHub App on the repo and
   installing it. It hands you four values at the end.
3. Set the four values + a fresh secret + the origin as Cloudflare Pages
   environment variables:
   - `KEYSTATIC_GITHUB_CLIENT_ID`
   - `KEYSTATIC_GITHUB_CLIENT_SECRET`
   - `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`
   - `KEYSTATIC_SECRET` — generate locally with `openssl rand -hex 32`
   - `PUBLIC_SITE_URL` — your deployed origin, used by the "Preview" buttons
4. Redeploy.

The GitHub App should request the minimum repo permissions:
**Contents: read & write** (so Keystatic can commit edits) and
**Metadata: read** (default). No other scopes needed.

### Who can edit

The GitHub App is installed on the repo and grants editing rights to the
people the owner adds to the App's "Installation access" list. Anyone else
gets a "not authorised" screen at `/keystatic`. There are no Keystatic-level
roles — access is binary, controlled by GitHub.

### Change tracking + undo

Every Save in the CMS is a real commit on `main`. The change history *is*
git history:

```sh
# see who changed what when
git log -- apps/storefront/content/products/

# revert one bad edit (Keystatic-friendly: makes a new commit)
git revert <sha>
git push origin main
```

For catalog edits, the revert commit fires the sync webhook the same way a
forward edit does — D1 updates within seconds. No rebuild needed.

### Preview links

Each Product and Journal entry has a **Preview** button in the admin that
opens the live page in a new tab. `PUBLIC_SITE_URL` (above) controls the
origin those links use.

### Catalog edits don't trigger rebuilds (recap)

Cloudflare Pages build watch paths exclude `apps/storefront/content/products/`
and `apps/storefront/content/discounts/` (section 2). Those edits go through
the GitHub-push webhook -> `/api/sync/catalog` -> D1 and skip the build.
siteConfig and journal edits *do* trigger a normal rebuild (~1-2 min).
