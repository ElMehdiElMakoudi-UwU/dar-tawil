-- The money the owner collected over a stock control, typed by hand, so it
-- can be set against what the POS sold and what left the shelf.
alter table stock_controls
  add column cash_collected numeric(12, 2) check (cash_collected >= 0),
  add column cash_note      text;
