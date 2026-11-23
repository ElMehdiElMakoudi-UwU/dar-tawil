-- Stock control (/gestion/stock-control): the owner counts the shelf at the
-- start, the till keeps selling, and later someone counts again without
-- seeing what the system expects (a blind count). For each product:
--
--   expected = start count + (POS stock at the count − POS stock at the start)
--   gap      = counted − expected
--
-- The POS stock is the one the app always works out (opening stock +
-- deliveries − sales + adjustments). Taking a snapshot of it at the start and
-- again the moment each product is counted catches every movement recorded in
-- between, whatever date it carries, and a sale edited in the meantime nets
-- out. Only some products can be in a control (a category, the expensive
-- ones), so short counts can run every week.

create table stock_controls (
  id          serial primary key,
  label       text not null,
  start_date  date not null,
  started_at  timestamptz not null default now(),
  -- The POS stock was set to the start counts with 'count' adjustments.
  aligned     boolean not null default false,
  status      text not null default 'open' check (status in ('open', 'closed')),
  closed_at   timestamptz,
  closed_by   integer references users(id) on delete set null,
  -- On closing, the gaps were booked as adjustments so the POS stock
  -- matches the shelf again.
  corrected   boolean not null default false,
  created_by  integer references users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table stock_control_lines (
  control_id      integer not null references stock_controls(id) on delete cascade,
  product_id      integer not null references products(id) on delete cascade,
  start_qty       numeric(12, 3) not null check (start_qty >= 0),
  system_start    numeric(12, 3) not null,
  counted_qty     numeric(12, 3) check (counted_qty >= 0),
  system_at_count numeric(12, 3),
  counted_at      timestamptz,
  counted_by      integer references users(id) on delete set null,
  -- The product's cost, price and tolerances when it was counted, so a
  -- gap keeps its value and its verdict if they change later. Admin only.
  unit_cost       numeric(12, 4),
  price           numeric(12, 2),
  tol_qty         numeric(12, 3),
  tol_pct         numeric(5, 2),
  -- What the owner found when he checked the gap.
  gap_reason      text check (gap_reason in ('waste', 'input_error', 'missing_delivery', 'count_error', 'unexplained')),
  gap_note        text,
  primary key (control_id, product_id),
  check ((counted_qty is null) = (system_at_count is null))
);
create index on stock_control_lines (product_id);

-- How far a count may be off before it is flagged, in the stock unit and as
-- a share of the expected quantity; the larger of the two wins. Products sold
-- by weight lose a little to the scale.
alter table products
  add column count_tolerance     numeric(12, 3) not null default 0 check (count_tolerance >= 0),
  add column count_tolerance_pct numeric(5, 2) not null default 0 check (count_tolerance_pct between 0 and 100);

-- Adjustments a control made (aligning at the start, correcting at the
-- close) belong to it: deleting an open control takes them back.
alter table stock_adjustments
  add column control_id integer references stock_controls(id) on delete cascade;
create index on stock_adjustments (control_id);
