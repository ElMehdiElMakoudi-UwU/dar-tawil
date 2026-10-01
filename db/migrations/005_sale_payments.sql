-- Money received on a sale before it is fully paid, e.g. the deposit taken
-- with an order. sales.paid still means "fully paid"; while it is false,
-- what the customer owes is the sale's total minus these payments.

create table sale_payments (
  id         serial primary key,
  order_no   text not null,           -- sales.order_no
  -- Set for the deposit copied from an order, so editing the order can replace it.
  order_id   integer references orders(id) on delete set null,
  date       date not null,
  amount     numeric(12, 2) not null check (amount > 0),
  payment    text,
  created_by integer references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on sale_payments (order_no);
