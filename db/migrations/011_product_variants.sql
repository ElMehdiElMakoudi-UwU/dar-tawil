-- Sub-products: one stock item sold at several prices, such as chocolat
-- enrobé at 5, 6 and 7 dh. The variants share the product's stock, cost and
-- unit; each only has its own label and price. A product without variants
-- is sold at products.price as before.

create table product_variants (
  id         serial primary key,
  product_id integer not null references products(id) on delete cascade,
  position   integer not null default 0,
  label      text not null check (label <> ''),
  price      numeric(12, 2) not null check (price >= 0),
  unique (product_id, label)
);
create index on product_variants (product_id);

-- Each line keeps the variant's label as it was when sold, like unit and
-- unit_cost, so renaming or removing a variant never rewrites the past.
alter table sales       add column variant text;
alter table order_lines add column variant text;
