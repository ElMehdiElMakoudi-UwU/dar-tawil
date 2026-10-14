-- A purchase is now one supplier delivery with several product lines, paid
-- (or not) as a whole. The old one-product rows become the lines; rows logged
-- separately for the same day, supplier and payment status are grouped into
-- one purchase, and their notes are kept on it.

alter table purchases rename to purchase_lines;
alter sequence purchases_id_seq rename to purchase_lines_id_seq;
alter index purchases_pkey rename to purchase_lines_pkey;
alter index purchases_product_id_idx rename to purchase_lines_product_id_idx;

create table purchases (
  id         serial primary key,
  date       date not null,
  supplier   text,
  ref        text,                -- the supplier's invoice or delivery note number
  paid       boolean not null default true,
  notes      text,
  created_by integer references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on purchases (date);

alter table purchase_lines
  add column purchase_id integer references purchases(id) on delete cascade,
  add column position    integer not null default 0;

with groups as (
  insert into purchases (date, supplier, paid, notes, created_by, created_at)
  select date, supplier, paid, string_agg(distinct notes, ' · '), min(created_by), min(created_at)
  from purchase_lines
  group by date, supplier, paid
  returning id, date, supplier, paid
)
update purchase_lines l set purchase_id = g.id
from groups g
where g.date = l.date and g.supplier is not distinct from l.supplier and g.paid = l.paid;

update purchase_lines l set position = n.pos
from (select id, row_number() over (partition by purchase_id order by id) - 1 as pos from purchase_lines) n
where n.id = l.id;

alter table purchase_lines
  alter column purchase_id set not null,
  drop column date,
  drop column supplier,
  drop column paid,
  drop column notes,
  drop column created_by,
  drop column created_at;
create index on purchase_lines (purchase_id);
