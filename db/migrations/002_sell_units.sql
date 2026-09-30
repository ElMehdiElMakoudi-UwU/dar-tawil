-- A product can be sold in a second unit besides its stock unit: dates are
-- stocked and sold by the kg, but a customer can also buy a single date.
-- Stock, cost and purchases stay in the stock unit (products.unit);
-- alt_factor says how much stock one alt unit uses (1 pc = 0.012 kg).

alter table products
  add column alt_unit   text,
  add column alt_factor numeric(12, 5) check (alt_factor > 0),
  add column alt_price  numeric(12, 2) check (alt_price >= 0),
  add constraint products_alt_complete check (
    (alt_unit is null and alt_factor is null and alt_price is null) or
    (alt_unit is not null and alt_factor is not null and alt_price is not null)
  );

-- Each sale line remembers the unit it was sold in and how much stock that
-- used, copied at the moment of sale like unit_cost. unit_cost is now per
-- unit sold (product cost × factor), so qty * unit_cost is still the COGS.
alter table sales
  add column unit   text,
  add column factor numeric(12, 5) not null default 1 check (factor > 0),
  alter column unit_cost type numeric(12, 4);

update sales s set unit = p.unit from products p where p.id = s.product_id;
alter table sales alter column unit set not null;

-- Grams: 0.125 kg must not round to 0.13.
alter table sales     alter column qty type numeric(12, 3);
alter table purchases alter column qty type numeric(12, 3);
alter table products
  alter column opening_stock type numeric(12, 3),
  alter column reorder_level type numeric(12, 3);
