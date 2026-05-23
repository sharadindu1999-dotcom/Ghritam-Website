-- Ghritam D1 schema.
-- products/variants/discounts are a runtime read-replica of the Keystatic
-- (git) catalog, refreshed by the /api/sync/catalog webhook.
-- orders/discount_redemptions are owned by D1 (written at checkout).

CREATE TABLE IF NOT EXISTS products (
  slug        TEXT PRIMARY KEY,
  handle      TEXT NOT NULL,
  name        TEXT NOT NULL,
  dev         TEXT NOT NULL,
  category    TEXT NOT NULL,
  origin      TEXT NOT NULL,
  story       TEXT NOT NULL,
  note        TEXT NOT NULL,
  in_season   INTEGER NOT NULL DEFAULT 1,
  shloka_key  TEXT NOT NULL,
  maker_name  TEXT NOT NULL,
  maker_place TEXT NOT NULL,
  maker_blurb TEXT NOT NULL,
  badges      TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS variants (
  sku          TEXT PRIMARY KEY,
  product_slug TEXT NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  price        INTEGER NOT NULL,            -- whole rupees
  batch        TEXT NOT NULL,
  stock        INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_slug);

CREATE TABLE IF NOT EXISTS discounts (
  code       TEXT PRIMARY KEY,
  type       TEXT NOT NULL,                 -- 'percent' | 'flat'
  value      INTEGER NOT NULL,
  min_order  INTEGER NOT NULL DEFAULT 0,
  applies_to TEXT NOT NULL DEFAULT 'all',   -- 'all' | category
  valid_from TEXT,
  valid_to   TEXT,
  usage_cap  INTEGER NOT NULL DEFAULT 0,    -- 0 = unlimited
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id                  TEXT PRIMARY KEY,
  status              TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | failed
  email               TEXT,
  phone               TEXT,
  address             TEXT,                             -- JSON
  items               TEXT NOT NULL,                    -- JSON line items
  subtotal            INTEGER NOT NULL,
  discount_code       TEXT,
  discount_amount     INTEGER NOT NULL DEFAULT 0,
  total               INTEGER NOT NULL,
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_rzp ON orders(razorpay_order_id);

CREATE TABLE IF NOT EXISTS discount_redemptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL,
  order_id    TEXT NOT NULL,
  redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_redemptions_code ON discount_redemptions(code);
