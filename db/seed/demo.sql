-- Demo data for showing the back office: products, customers, ~6 months of
-- sales, purchases, expenses, payroll, cash and a few orders in progress.
-- Not a migration — run it by hand with `node scripts/seed-demo.mjs`.
-- Dates are relative to today, so the dashboard looks current whenever it's run.
-- Users and dropdown lists are left alone; sales are recorded without an author.

do $$
begin
  if exists (select 1 from products) or exists (select 1 from sales) then
    raise exception 'The database already has products or sales. Run with --reset to wipe business data first.';
  end if;
end $$;

select setseed(0.42);

-- ── Products ────────────────────────────────────────────────────────
-- Dates are stocked by the kg and can also be sold by the piece.
insert into products (sku, name, category, unit, unit_cost, price, opening_stock, reorder_level, alt_unit, alt_factor, alt_price) values
  ('DAT-MAJ', 'Dattes Majhoul',             'Dates', 'kg', 110, 180, 10, 40, 'pc', 0.025, 5),
  ('DAT-BOU', 'Dattes Boufeggous',          'Dates', 'kg',  70, 120, 10,  8, 'pc', 0.012, 2),
  ('DAT-BIT', 'Dattes Bouittob',            'Dates', 'kg',  45,  80, 10,  8, null, null, null),
  ('DAT-NEJ', 'Dattes Nejda',               'Dates', 'kg',  50,  90, 10,  8, null, null, null),
  ('DAT-DGN', 'Dattes Deglet Nour',         'Dates', 'kg',  40,  70, 10,  8, null, null, null),
  ('DAT-FRC', 'Dattes fourrées amande',     'Dates', 'kg', 150, 260,  5,  4, 'pc', 0.020, 6);

insert into products (sku, name, category, unit, unit_cost, price, opening_stock, reorder_level)
select 'CHO-' || code, 'Bonbon ' || name, 'Chocolate', 'U', 2.50, 6, 60, 40
from (values
  ('BOU', 'Bounty'), ('AML', 'Amlo'), ('FER', 'Ferrero'), ('CIT', 'Citron'),
  ('PRA', 'Praliné Amande'), ('GIA', 'Gianduja'), ('NOI', 'Noisette Noire'),
  ('SPE', 'Spéculoos'), ('CDG', 'Corne de Gazelle'), ('FRU', 'Fruits Rouges'),
  ('PIA', 'Pistache Amande'), ('KON', 'Konafa Pistache'), ('CAF', 'Café')
) as f(code, name);

insert into products (sku, name, category, unit, unit_cost, price, opening_stock, reorder_level) values
  ('BOX-R12', 'Coffret rond 12 pièces',        'Gift boxes', 'U',  18,  45, 30, 10),
  ('BOX-C24', 'Coffret carré 24 pièces',       'Gift boxes', 'U',  25,  65, 30, 10),
  ('BOX-E2',  'Coffret deux étages',           'Gift boxes', 'U',  60, 150, 15,  5),
  ('BOX-PLT', 'Plateau dfou3 (présentation)',  'Gift boxes', 'U', 120, 350, 10, 40),
  ('OTH-CRT', 'Carte message personnalisée',   'Other',      'U',   2,  10, 100, 20);

-- ── Customers ───────────────────────────────────────────────────────
insert into customers (name, phone, city, type, notes) values
  ('Khadija Benali',          '0661 23 45 67', 'Ksar El Kebir', 'Individual', 'Cliente fidèle, préfère le Majhoul'),
  ('Youssef El Amrani',       '0662 34 56 78', 'Larache',       'Individual', null),
  ('Nadia Tazi',              '0663 45 67 89', 'Tanger',        'Individual', 'Mariage de sa fille en préparation'),
  ('Hamid Ouazzani',          '0664 56 78 90', 'Ksar El Kebir', 'Individual', null),
  ('Salma Idrissi',           '0665 67 89 01', 'Tétouan',       'Individual', null),
  ('Rachid Bennani',          '0666 78 90 12', 'Rabat',         'Individual', null),
  ('Imane Chraibi',           '0667 89 01 23', 'Casablanca',    'Individual', 'Commande souvent sur Instagram'),
  ('Omar Alaoui',             '0668 90 12 34', 'Ksar El Kebir', 'Individual', null),
  ('Zineb Fassi',             '0669 01 23 45', 'Fès',           'Individual', null),
  ('Mehdi Berrada',           '0670 12 34 56', 'Larache',       'Individual', null),
  ('Hôtel Riad Loukkos',      '0539 91 22 33', 'Larache',       'Corporate',  'Coffrets d''accueil pour les chambres'),
  ('Banque Populaire Nord',   '0539 33 44 55', 'Tanger',        'Corporate',  'Cadeaux clients fin d''année'),
  ('Clinique Al Amal',        '0539 90 11 22', 'Ksar El Kebir', 'Corporate',  null),
  ('Épicerie Fine Al Baraka', '0661 99 88 77', 'Tétouan',       'Reseller',   'Revend les coffrets ronds'),
  ('Traiteur Dar Lalla',      '0662 88 77 66', 'Tanger',        'Reseller',   'Partenaire mariages');

-- ── Staff ───────────────────────────────────────────────────────────
insert into employees (name, position, phone, monthly_salary, start_date, notes) values
  ('Fatima Zahra Moussaoui', 'Chocolatière',              '0671 11 22 33', 4200, current_date - 400, null),
  ('Ayoub Kettani',          'Vendeur boutique',          '0672 22 33 44', 3200, current_date - 300, null),
  ('Hajar Lamrani',          'Préparation & livraisons',  '0673 33 44 55', 3000, current_date - 100, 'Période d''essai terminée');

-- ── Sales: ~180 days of orders ──────────────────────────────────────
do $$
declare
  d date;
  n int;
  nlines int;
  no text;
  cust int;
  ctype text;
  ch text;
  pay text;
  is_paid boolean;
  p record;
  alt boolean;
  q numeric;
  price numeric;
  disc numeric;
  total numeric;
begin
  for d in select generate_series(current_date - 179, current_date, interval '1 day')::date loop
    -- Closed on Sundays except for online orders; busier on Fridays and Saturdays.
    n := 3 + floor(random() * 4)::int
         + case when extract(dow from d) in (5, 6) then 3 else 0 end
         + case when d > current_date - 45 then 2 else 0 end;  -- a growing business
    if extract(dow from d) = 0 then n := 1 + floor(random() * 2)::int; end if;

    for i in 1..n loop
      no := 'O' || lpad(nextval('order_seq')::text, 5, '0');

      -- Channel, then a customer that fits it.
      ch := case
        when random() < 0.50 then 'Shop'
        when random() < 0.65 then 'Instagram / WhatsApp'
        when random() < 0.50 then 'Website'
        when random() < 0.60 then 'Corporate / B2B'
        else 'Wholesale' end;
      if extract(dow from d) = 0 then ch := 'Instagram / WhatsApp'; end if;

      ctype := case ch when 'Corporate / B2B' then 'Corporate' when 'Wholesale' then 'Reseller' else 'Individual' end;
      cust := null;
      if ch <> 'Shop' or random() < 0.4 then
        select id into cust from customers where type = ctype order by random() limit 1;
      end if;

      pay := case ch
        when 'Shop' then case when random() < 0.65 then 'Cash' else 'Card' end
        when 'Instagram / WhatsApp' then case when random() < 0.6 then 'Cash on delivery' else 'Bank transfer' end
        when 'Website' then case when random() < 0.5 then 'Card' else 'Cash on delivery' end
        when 'Corporate / B2B' then case when random() < 0.7 then 'Bank transfer' else 'Cheque' end
        else 'Bank transfer' end;

      -- A few recent orders are still unpaid.
      is_paid := not (d > current_date - 21 and ch <> 'Shop' and random() < 0.25);

      nlines := case when ch in ('Corporate / B2B', 'Wholesale') then 2 + floor(random() * 2)::int
                     else 2 + floor(random() * 3)::int end;
      total := 0;

      for j in 1..nlines loop
        select * into p from products order by random() limit 1;
        alt := false;
        if p.unit = 'kg' then
          if p.alt_unit is not null and ch = 'Shop' and random() < 0.3 then
            alt := true;
            q := 6 + floor(random() * 20);
            price := p.alt_price;
          else
            q := (array[0.5, 1, 1, 1.5, 2, 3])[1 + floor(random() * 6)::int];
            price := p.price;
          end if;
        elsif p.category = 'Chocolate' then
          q := (array[12, 12, 24, 24, 36])[1 + floor(random() * 5)::int];
          price := p.price;
        else
          q := 1 + floor(random() * 2);
          price := p.price;
        end if;
        if ch in ('Corporate / B2B', 'Wholesale') then q := q * (3 + floor(random() * 5)); end if;

        disc := case when ch = 'Wholesale' then 15
                     when ch = 'Corporate / B2B' then 10
                     when random() < 0.08 then 5
                     else 0 end;

        insert into sales (date, order_no, customer_id, channel, product_id, qty, unit, factor, unit_price, discount_pct, unit_cost, payment, paid)
        values (d, no, cust, ch, p.id, q,
                case when alt then p.alt_unit else p.unit end,
                case when alt then p.alt_factor else 1 end,
                price, disc,
                round(p.unit_cost * case when alt then p.alt_factor else 1 end, 4),
                pay, is_paid);
        total := total + q * price * (1 - disc / 100);
      end loop;

      -- Half of the unpaid ones have a deposit already.
      if not is_paid and random() < 0.5 then
        insert into sale_payments (order_no, date, amount, payment)
        values (no, d, round(total * 0.3 / 10) * 10 + 10, pay);
      end if;
    end loop;
  end loop;
end $$;

-- ── Purchases: monthly restock, a bit more than what sold ───────────
insert into purchases (date, supplier, product_id, qty, unit_cost, paid, notes)
select m.month::date,
       case
         when p.sku in ('DAT-MAJ', 'DAT-BOU') then 'Coopérative Tafilalet, Erfoud'
         when p.category = 'Dates' then 'Palmeraie de Zagora'
         when p.category = 'Chocolate' then 'Atelier (couverture Callebaut)'
         when p.category = 'Gift boxes' then 'Emballages du Nord, Tanger'
         else 'Imprimerie Al Andalous'
       end,
       p.id,
       ceil(m.used * 1.1),
       p.unit_cost,
       m.month < date_trunc('month', current_date),  -- this month's invoices not settled yet
       null
from (
  select product_id, date_trunc('month', date) as month, sum(qty * factor) as used
  from sales group by 1, 2
) m
join products p on p.id = m.product_id;

-- ── Expenses ────────────────────────────────────────────────────────
insert into expenses (date, category, description, amount, payment)
select e.date, e.category, e.description, e.amount, e.payment
from generate_series(date_trunc('month', current_date - 179), current_date, interval '1 month') as m(month)
cross join lateral (values
  (m.month::date,                    'Rent',         'Loyer boutique & atelier',      4500::numeric,                         'Bank transfer'),
  (m.month::date + 4,                'Marketing',    'Publicité Instagram',           (800 + floor(random() * 6) * 100),     'Card'),
  (m.month::date + 9,                'Utilities',    'Électricité & eau (ONEE)',      (450 + floor(random() * 300)),         'Bank transfer'),
  (m.month::date + 11,               'Packaging',    'Rubans, papier de soie, sacs',  (600 + floor(random() * 9) * 100),     'Cash'),
  (m.month::date + 14,               'Delivery',     'Coursiers Tanger / Tétouan',    (300 + floor(random() * 5) * 50),      'Cash'),
  (m.month::date + 19,               'Utilities',    'Internet & téléphone',          299::numeric,                          'Bank transfer'),
  (m.month::date + 24,               'Delivery',     'Envois Amana',                  (150 + floor(random() * 4) * 50),      'Cash')
) as e(date, category, description, amount, payment)
where e.date <= current_date;

insert into expenses (date, category, description, amount, payment) values
  (current_date - 150, 'Equipment',    'Tempéreuse chocolat 8 kg',        18500, 'Bank transfer'),
  (current_date - 95,  'Fees & taxes', 'Patente annuelle',                 1200, 'Cash'),
  (current_date - 60,  'Equipment',    'Vitrine réfrigérée (acompte)',     6000, 'Cheque'),
  (current_date - 40,  'Marketing',    'Shooting photo nouveaux coffrets', 2500, 'Bank transfer'),
  (current_date - 12,  'Other',        'Fleurs fraîches vitrine',           180, 'Cash');

-- ── Payroll: salary at each month end, a couple of advances ─────────
insert into payroll (employee_id, date, period, kind, amount, notes)
select e.id, (m.month + interval '1 month - 1 day')::date, to_char(m.month, 'YYYY-MM'), 'salary', e.monthly_salary, null
from employees e
cross join generate_series(date_trunc('month', current_date - 179), date_trunc('month', current_date) - interval '1 month', interval '1 month') as m(month)
where e.start_date <= m.month;

insert into payroll (employee_id, date, period, kind, amount, notes)
select id, current_date - 6, to_char(current_date, 'YYYY-MM'), 'advance', 500, 'Avance demandée'
from employees where name = 'Ayoub Kettani';

insert into payroll (employee_id, date, period, kind, amount, notes)
select id, (date_trunc('month', current_date) - interval '1 day')::date,
       to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM'), 'bonus', 800, 'Prime saison des mariages'
from employees where name = 'Fatima Zahra Moussaoui';

-- ── Cash & bank ─────────────────────────────────────────────────────
insert into cash_movements (date, account, direction, category, amount, notes) values
  (current_date - 180, 'cash', 'in', 'Solde d’ouverture', 3000,  'Fond de caisse'),
  (current_date - 180, 'bank', 'in', 'Solde d’ouverture', 45000, 'Solde compte CIH'),
  (current_date - 150, 'bank', 'in', 'Apport du propriétaire', 20000, 'Achat de la tempéreuse');

-- Each Monday, most of last week's cash sales go to the bank.
insert into cash_movements (date, account, direction, category, amount, notes)
select w.monday, acc.account, acc.direction, 'Caisse déposée en banque', w.amount, null
from (
  select (date_trunc('week', date) + interval '7 day')::date as monday,
         floor(sum(qty * unit_price * (1 - discount_pct / 100)) * 0.8 / 100) * 100 as amount
  from sales where payment = 'Cash' and paid
  group by 1
) w
cross join (values ('cash', 'out'), ('bank', 'in')) as acc(account, direction)
where w.monday <= current_date and w.amount > 0;

insert into cash_movements (date, account, direction, category, amount, notes)
select (m.month + interval '27 day')::date, 'bank', 'out', 'Retrait du propriétaire', 6000, null
from generate_series(date_trunc('month', current_date - 179), current_date, interval '1 month') as m(month)
where m.month + interval '27 day' <= current_date;

insert into cash_movements (date, account, direction, category, amount, notes)
select (m.month + interval '1 month - 1 day')::date, 'bank', 'out', 'Frais bancaires', 45, 'Tenue de compte'
from generate_series(date_trunc('month', current_date - 179), current_date - interval '1 month', interval '1 month') as m(month);

-- Till counted at closing for the last three weeks, usually spot on.
insert into cash_counts (date, counted, notes)
select date,
       cash + case when r < 0.75 then 0 when r < 0.9 then -20 else 10 end,
       case when r >= 0.75 and r < 0.9 then 'Manque 20 DH, monnaie rendue en trop ?' end
from (
  select date, sum(qty * unit_price * (1 - discount_pct / 100)) as cash, random() as r
  from sales
  where payment = 'Cash' and paid and date between current_date - 21 and current_date - 1
  group by date
) c;

-- ── Orders taken ahead ──────────────────────────────────────────────
create function pg_temp.demo_order(
  cust_name text, ch text, ful text, due date, due_t text, st text,
  items_txt text, note text, dep numeric, pay text, lines jsonb
) returns void language plpgsql as $f$
declare
  oid int;
  c record;
  sno text;
  l jsonb;
  pos int := 0;
begin
  select * into c from customers where name = cust_name;
  insert into orders (customer_id, customer_name, phone, channel, fulfilment, due_date, due_time, address, city,
                      items, notes, deposit, payment, paid, status, status_at)
  values (c.id, cust_name, c.phone, ch, ful, due, due_t,
          case when ful = 'delivery' then 'Quartier ' || (array['Al Andalous', 'Hay Salam', 'Centre-ville', 'Mers Sultan'])[1 + floor(random() * 4)::int] end,
          c.city, items_txt, note, dep, pay, st = 'delivered', st,
          case when st = 'new' then now() - interval '1 day' else now() - interval '3 hours' end)
  returning id into oid;

  for l in select * from jsonb_array_elements(lines) loop
    pos := pos + 1;
    insert into order_lines (order_id, product_id, qty, alt, unit_price, discount_pct, position)
    select oid, p.id, (l->>'qty')::numeric, coalesce((l->>'alt')::boolean, false),
           case when coalesce((l->>'alt')::boolean, false) then p.alt_price else p.price end,
           coalesce((l->>'disc')::numeric, 0), pos
    from products p where p.sku = l->>'sku';
  end loop;

  -- Delivered: its lines became a sale, and the deposit a payment on it.
  if st = 'delivered' then
    sno := 'O' || lpad(nextval('order_seq')::text, 5, '0');
    insert into sales (date, order_no, customer_id, channel, product_id, qty, unit, factor, unit_price, discount_pct, unit_cost, payment, paid)
    select due, sno, c.id, ch, p.id, ol.qty,
           case when ol.alt then p.alt_unit else p.unit end,
           case when ol.alt then p.alt_factor else 1 end,
           ol.unit_price, ol.discount_pct,
           round(p.unit_cost * case when ol.alt then p.alt_factor else 1 end, 4),
           pay, true
    from order_lines ol join products p on p.id = ol.product_id
    where ol.order_id = oid;
    if dep > 0 then
      insert into sale_payments (order_no, order_id, date, amount, payment) values (sno, oid, due - 5, dep, pay);
    end if;
    update orders set sale_no = sno where id = oid;
  end if;
end $f$;

select pg_temp.demo_order('Nadia Tazi', 'Instagram / WhatsApp', 'delivery', current_date + 12, '16:00', 'new',
  'Dfou3 de mariage : 6 plateaux, dattes fourrées au centre, bonbons en couronne. Couleurs : blanc et doré.',
  'Rubans dorés, monogramme N & A sur chaque plateau', 1500, 'Bank transfer',
  '[{"sku":"BOX-PLT","qty":6},{"sku":"DAT-FRC","qty":3},{"sku":"DAT-MAJ","qty":4},{"sku":"CHO-PIA","qty":60},{"sku":"CHO-CDG","qty":60},{"sku":"CHO-KON","qty":60}]');

select pg_temp.demo_order('Banque Populaire Nord', 'Corporate / B2B', 'delivery', current_date + 5, '10:00', 'preparing',
  '40 coffrets carrés, assortiment maison', 'Carte avec logo de la banque', 2000, 'Bank transfer',
  '[{"sku":"BOX-C24","qty":40,"disc":10},{"sku":"OTH-CRT","qty":40,"disc":10}]');

select pg_temp.demo_order('Khadija Benali', 'Instagram / WhatsApp', 'pickup', current_date, '18:30', 'ready',
  'Coffret deux étages : Majhoul en haut, bonbons en bas', 'Carte : « Joyeux anniversaire Maman »', 100, 'Cash',
  '[{"sku":"BOX-E2","qty":1},{"sku":"DAT-MAJ","qty":0.5},{"sku":"CHO-FER","qty":12},{"sku":"CHO-GIA","qty":12},{"sku":"OTH-CRT","qty":1}]');

select pg_temp.demo_order('Imane Chraibi', 'Instagram / WhatsApp', 'delivery', current_date, '15:00', 'out',
  null, 'Livraison Amana', 0, 'Cash on delivery',
  '[{"sku":"BOX-R12","qty":2},{"sku":"CHO-BOU","qty":12},{"sku":"CHO-SPE","qty":12}]');

select pg_temp.demo_order('Hôtel Riad Loukkos', 'Corporate / B2B', 'delivery', current_date + 2, '11:00', 'new',
  '20 petits coffrets d''accueil, 3 dattes + 3 bonbons', null, 0, 'Cheque',
  '[{"sku":"BOX-R12","qty":20,"disc":10},{"sku":"DAT-BOU","qty":60,"alt":true},{"sku":"CHO-AML","qty":60,"disc":10}]');

select pg_temp.demo_order('Omar Alaoui', 'Shop', 'pickup', current_date + 1, '12:00', 'new',
  null, 'Sans spéculoos (allergie)', 0, null,
  '[{"sku":"BOX-C24","qty":1},{"sku":"CHO-PRA","qty":12},{"sku":"CHO-CAF","qty":12}]');

select pg_temp.demo_order('Traiteur Dar Lalla', 'Wholesale', 'delivery', current_date + 8, '09:00', 'preparing',
  'Plateaux pour un mariage de 300 invités', null, 3000, 'Bank transfer',
  '[{"sku":"BOX-PLT","qty":10,"disc":15},{"sku":"DAT-MAJ","qty":8,"disc":15},{"sku":"DAT-FRC","qty":4,"disc":15}]');

select pg_temp.demo_order('Zineb Fassi', 'Website', 'delivery', current_date - 4, '17:00', 'delivered',
  null, null, 200, 'Card',
  '[{"sku":"BOX-E2","qty":1},{"sku":"CHO-FRU","qty":12},{"sku":"CHO-CIT","qty":12}]');

select pg_temp.demo_order('Clinique Al Amal', 'Corporate / B2B', 'pickup', current_date - 9, '10:00', 'delivered',
  '15 coffrets ronds pour le personnel', null, 0, 'Cheque',
  '[{"sku":"BOX-R12","qty":15,"disc":10},{"sku":"CHO-NOI","qty":90,"disc":10},{"sku":"CHO-AML","qty":90,"disc":10}]');

select pg_temp.demo_order('Mehdi Berrada', 'Instagram / WhatsApp', 'delivery', current_date - 2, null, 'cancelled',
  'Coffret rond', 'Client injoignable', 0, null,
  '[{"sku":"BOX-R12","qty":1},{"sku":"CHO-KON","qty":12}]');
