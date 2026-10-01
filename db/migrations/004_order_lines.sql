-- Orders now list the products to compose, priced like a sale. Marking an
-- order delivered records those lines as a sale (sale_no is its order_no in
-- sales); moving it back out of "delivered" removes that sale again.

create table order_lines (
  id           serial primary key,
  order_id     integer not null references orders(id) on delete cascade,
  product_id   integer not null references products(id),
  qty          numeric(12, 3) not null check (qty > 0),
  alt          boolean not null default false,  -- in the product's second unit
  unit_price   numeric(12, 2) not null check (unit_price >= 0),
  discount_pct numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  position     integer not null default 0
);
create index on order_lines (order_id);

-- The total is now the sum of the lines; the free text stays for how to
-- compose the order, and is optional.
alter table orders
  drop column total,
  alter column items drop not null,
  add column sale_no text;
create index on orders (sale_no);
