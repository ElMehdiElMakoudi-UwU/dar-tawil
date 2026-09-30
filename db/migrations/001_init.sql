-- Dar Tawil — management app schema.
-- Mirrors the tabs of the old dar_tawil.xlsx tracker, plus the admin-only
-- sections (payroll, cash & bank, users).

create table users (
  id            serial primary key,
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  role          text not null check (role in ('admin', 'staff')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- The cookie holds a random token; only its SHA-256 is stored.
create table sessions (
  id         text primary key,
  user_id    integer not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create index on sessions (user_id);

-- Dropdown options (the old "Lists" tab).
create table lists (
  id       serial primary key,
  kind     text not null check (kind in ('channel', 'payment', 'expense_category', 'product_category', 'customer_type')),
  value    text not null,
  position integer not null default 0,
  unique (kind, value)
);

create table products (
  id             serial primary key,
  sku            text not null unique,
  name           text not null,
  category       text,
  unit           text not null default 'U',
  unit_cost      numeric(12, 2) not null default 0,  -- admin only
  price          numeric(12, 2) not null default 0,
  opening_stock  numeric(12, 2) not null default 0,
  reorder_level  numeric(12, 2) not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table customers (
  id         serial primary key,
  name       text not null unique,
  phone      text,
  city       text,
  type       text,
  notes      text,
  created_at timestamptz not null default now()
);

-- One row per product sold; lines of the same order share order_no.
create sequence order_seq;
create table sales (
  id           serial primary key,
  date         date not null,
  order_no     text not null,
  customer_id  integer references customers(id) on delete set null,
  channel      text,
  product_id   integer not null references products(id),
  qty          numeric(12, 2) not null check (qty > 0),
  unit_price   numeric(12, 2) not null check (unit_price >= 0),
  discount_pct numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  -- The product's cost at the moment of sale, so later cost changes don't
  -- rewrite past profit. Admin only.
  unit_cost    numeric(12, 2) not null default 0,
  payment      text,
  paid         boolean not null default true,
  created_by   integer references users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on sales (date);
create index on sales (order_no);
create index on sales (product_id);
create index on sales (customer_id);

create table purchases (
  id         serial primary key,
  date       date not null,
  supplier   text,
  product_id integer not null references products(id),
  qty        numeric(12, 2) not null check (qty > 0),
  unit_cost  numeric(12, 2) not null check (unit_cost >= 0),
  paid       boolean not null default true,
  notes      text,
  created_by integer references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on purchases (date);
create index on purchases (product_id);

create table expenses (
  id          serial primary key,
  date        date not null,
  category    text not null,
  description text,
  amount      numeric(12, 2) not null check (amount >= 0),
  payment     text,
  notes       text,
  created_by  integer references users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on expenses (date);

-- Staff & payroll (admin only). Payroll payments count as a cost in the
-- P&L, so salaries are no longer logged under Expenses.
create table employees (
  id             serial primary key,
  name           text not null,
  position       text,
  phone          text,
  monthly_salary numeric(12, 2) not null default 0,
  start_date     date,
  active         boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now()
);

create table payroll (
  id          serial primary key,
  employee_id integer not null references employees(id) on delete cascade,
  date        date not null,
  period      text not null check (period ~ '^\d{4}-\d{2}$'),  -- month the payment is for, YYYY-MM
  kind        text not null check (kind in ('salary', 'advance', 'bonus')),
  amount      numeric(12, 2) not null check (amount >= 0),
  notes       text,
  created_by  integer references users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on payroll (employee_id, period);
create index on payroll (date);

-- Cash & bank (admin only). Money moving in or out of the till or the bank
-- that isn't a sale, purchase, expense or payroll line: owner withdrawals,
-- deposits of the till to the bank, capital put in, etc.
create table cash_movements (
  id         serial primary key,
  date       date not null,
  account    text not null check (account in ('cash', 'bank')),
  direction  text not null check (direction in ('in', 'out')),
  category   text not null,
  amount     numeric(12, 2) not null check (amount > 0),
  notes      text,
  created_by integer references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on cash_movements (date);

-- End-of-day till count, compared against cash sales recorded that day.
create table cash_counts (
  id         serial primary key,
  date       date not null unique,
  counted    numeric(12, 2) not null,
  notes      text,
  created_by integer references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Defaults copied from the Lists tab of the spreadsheet ("Salaries" moved to payroll).
insert into lists (kind, value, position) values
  ('channel', 'Shop', 1), ('channel', 'Instagram / WhatsApp', 2), ('channel', 'Website', 3),
  ('channel', 'Corporate / B2B', 4), ('channel', 'Wholesale', 5), ('channel', 'Events & fairs', 6),
  ('payment', 'Cash', 1), ('payment', 'Card', 2), ('payment', 'Bank transfer', 3),
  ('payment', 'Cash on delivery', 4), ('payment', 'Cheque', 5),
  ('expense_category', 'Rent', 1), ('expense_category', 'Packaging', 2),
  ('expense_category', 'Marketing', 3), ('expense_category', 'Delivery', 4), ('expense_category', 'Utilities', 5),
  ('expense_category', 'Equipment', 6), ('expense_category', 'Fees & taxes', 7), ('expense_category', 'Other', 8),
  ('product_category', 'Dates', 1), ('product_category', 'Chocolate', 2),
  ('product_category', 'Gift boxes', 3), ('product_category', 'Other', 4),
  ('customer_type', 'Individual', 1), ('customer_type', 'Corporate', 2), ('customer_type', 'Reseller', 3);
