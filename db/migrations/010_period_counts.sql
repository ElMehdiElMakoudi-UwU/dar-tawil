-- Period report (/gestion/admin/period): the owner counts each product at
-- the start and at the end of a period he picks. With the deliveries logged
-- in between, start + deliveries − end is what went out, and at the
-- product's price and cost that gives what the period earned. The counts
-- are kept so the report can be reopened, and a period's end count offers
-- itself as the next period's start.
create table period_counts (
  id         serial primary key,
  date_from  date not null,
  date_to    date not null check (date_to >= date_from),
  product_id integer not null references products(id) on delete cascade,
  start_qty  numeric(12, 3),
  end_qty    numeric(12, 3),
  updated_by integer references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (date_from, date_to, product_id)
);
create index on period_counts (product_id, date_to);
