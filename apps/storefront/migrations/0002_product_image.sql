-- Product photography. NULL when an editor has not uploaded an image yet —
-- the storefront falls back to the hatched .ph placeholder in that case.

ALTER TABLE products ADD COLUMN image_path TEXT;
