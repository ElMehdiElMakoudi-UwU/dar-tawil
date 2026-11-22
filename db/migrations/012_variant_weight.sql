-- 011 was edited after it had already run in production to add
-- product_variants.weight, so databases that applied the first version
-- never got the column. Add it here; a no-op where 011 already created it.
alter table product_variants
  add column if not exists weight numeric(12, 5) not null default 1 check (weight > 0);
