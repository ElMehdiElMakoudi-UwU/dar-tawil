-- Sub-products: one stock item sold as pieces of several sizes, such as
-- chocolat enrobé at 5, 6 and 7 dh. The variants share the product's stock
-- and its purchase cost (bought by the kilo); each has its own label, price
-- and weight. A product without variants is sold at products.price as before.

create table product_variants (
  id         serial primary key,
  product_id integer not null references products(id) on delete cascade,
  position   integer not null default 0,
  label      text not null check (label <> ''),
  price      numeric(12, 2) not null check (price >= 0),
  -- How much stock one piece uses, in the product's stock unit (0.025 kg).
  -- A sale line copies it as its factor, so its cost is unit_cost × weight.
  weight     numeric(12, 5) not null default 1 check (weight > 0),
  unique (product_id, label)
);
create index on product_variants (product_id);

-- Each line keeps the variant's label as it was when sold, like unit and
-- unit_cost, so renaming or removing a variant never rewrites the past.
alter table sales       add column variant text;
alter table order_lines add column variant text;
