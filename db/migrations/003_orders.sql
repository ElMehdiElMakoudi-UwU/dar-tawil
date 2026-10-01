-- Orders taken ahead (mostly on WhatsApp), composed in the shop, then
-- delivered or picked up. They are a to-do list for the workshop: nothing
-- here touches stock or revenue — the sale is recorded as usual when the
-- customer pays.

create sequence prep_order_seq;
create table orders (
  id            serial primary key,
  no            text not null unique default 'C' || lpad(nextval('prep_order_seq')::text, 5, '0'),
  customer_id   integer references customers(id) on delete set null,
  -- Kept on the order so it survives the customer being deleted.
  customer_name text not null,
  phone         text,
  channel       text,
  fulfilment    text not null default 'delivery' check (fulfilment in ('delivery', 'pickup')),
  due_date      date not null,
  due_time      text check (due_time ~ '^\d{2}:\d{2}$'),
  address       text,
  city          text,
  items         text not null,   -- what to compose, as the customer asked for it
  notes         text,            -- card message, wrapping, anything else
  total         numeric(12, 2) check (total >= 0),
  deposit       numeric(12, 2) not null default 0 check (deposit >= 0),
  payment       text,
  paid          boolean not null default false,
  status        text not null default 'new'
                check (status in ('new', 'preparing', 'ready', 'out', 'delivered', 'cancelled')),
  status_at     timestamptz not null default now(),
  created_by    integer references users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on orders (status, due_date);
create index on orders (due_date);
create index on orders (customer_id);
