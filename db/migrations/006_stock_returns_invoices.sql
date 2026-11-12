-- Stock adjustments, returns, invoices and the business's legal details.

-- Stock that leaves or turns up outside a sale or a purchase: dates gone
-- bad, a broken box, tasting samples, the house's own use, and corrections
-- after a physical count. qty is signed, in the product's stock unit
-- (negative = stock lost). unit_cost is the product's cost at that moment,
-- like on a sale, so the loss keeps its value if the cost changes later.
create table stock_adjustments (
  id         serial primary key,
  date       date not null,
  product_id integer not null references products(id),
  qty        numeric(12, 3) not null check (qty <> 0),
  reason     text not null check (reason in ('waste', 'damaged', 'sample', 'own_use', 'count', 'other')),
  unit_cost  numeric(12, 4) not null default 0,  -- admin only
  notes      text,
  -- Set when a returned item was not put back on the shelf: removing the
  -- return removes this too.
  sale_id    integer,
  created_by integer references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on stock_adjustments (date);
create index on stock_adjustments (product_id);

-- Returns are sale lines with a negative quantity, under their own credit
-- note number (R00001), each pointing at the line it gives back. Revenue,
-- cost of goods, stock, the till and what customers spent then all net out
-- without any query having to know about returns.
create sequence return_seq;
alter table sales
  drop constraint sales_qty_check,
  add column return_of integer references sales(id) on delete cascade,
  add constraint sales_qty_sign check ((qty > 0) = (return_of is null));
create index on sales (return_of);

alter table stock_adjustments
  add constraint stock_adjustments_sale_fk foreign key (sale_id) references sales(id) on delete cascade;

-- What a business customer's invoice needs.
alter table customers
  add column ice     text,
  add column address text;

-- Invoices: numbered without gaps per year (F-2026-0001), as Moroccan
-- invoicing requires, one per sale or credit note. The customer's details
-- are copied at issue, so the invoice reads the same later.
create table invoices (
  id               serial primary key,
  no               text not null unique,
  year             integer not null,
  seq              integer not null,
  order_no         text not null unique,  -- sales.order_no
  date             date not null,
  customer_name    text,
  customer_ice     text,
  customer_address text,
  created_by       integer references users(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (year, seq)
);

-- The house's own details, printed on receipts and invoices.
create table settings (
  key   text primary key,
  value text not null
);
insert into settings (key, value) values
  ('business_name', 'Dar Tawil'),
  ('receipt_footer', 'Merci de votre visite'),
  ('vat_rate', '0');
