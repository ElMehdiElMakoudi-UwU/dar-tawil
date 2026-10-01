import "server-only";
import { requireAdmin, requireUser } from "./auth";
import { sql } from "./db";
import { monthRange, today } from "./format";

/*
 * Staff-level reads call requireUser(); anything exposing costs, margins,
 * profit, payroll or cash calls requireAdmin() itself, so a page that forgets
 * its own check still can't leak those numbers.
 */

export type ListKind = "channel" | "payment" | "expense_category" | "product_category" | "customer_type";
export type Lists = Record<ListKind, string[]>;

export async function getLists(): Promise<Lists> {
  await requireUser();
  const rows = await sql<{ kind: ListKind; value: string }[]>`select kind, value from lists order by kind, position, value`;
  const out: Lists = { channel: [], payment: [], expense_category: [], product_category: [], customer_type: [] };
  for (const r of rows) out[r.kind].push(r.value);
  return out;
}

export async function getListRows() {
  await requireAdmin();
  return sql<{ id: number; kind: ListKind; value: string }[]>`select id, kind, value from lists order by kind, position, value`;
}

/* ── products & stock ─────────────────────────────────────────────── */

const stockJoin = sql`
  left join (select product_id, sum(qty) as q from purchases group by 1) pu on pu.product_id = p.id
  left join (select product_id, sum(qty * factor) as q, sum(qty * unit_price * (1 - discount_pct / 100)) as rev,
                    sum(qty * unit_cost) as cogs
             from sales group by 1) s on s.product_id = p.id
`;

export type StaffProduct = {
  id: number; sku: string; name: string; category: string | null; unit: string;
  price: number; in_stock: number; reorder_level: number; active: boolean;
  alt_unit: string | null; alt_factor: number | null; alt_price: number | null;
};

export async function getProducts({ activeOnly = false } = {}) {
  await requireUser();
  return sql<StaffProduct[]>`
    select p.id, p.sku, p.name, p.category, p.unit, p.price, p.reorder_level, p.active,
           p.alt_unit, p.alt_factor, p.alt_price,
           p.opening_stock + coalesce(pu.q, 0) - coalesce(s.q, 0) as in_stock
    from products p ${stockJoin}
    where ${activeOnly ? sql`p.active` : sql`true`}
    order by p.active desc, p.category nulls last, p.name
  `;
}

export type AdminProduct = StaffProduct & {
  unit_cost: number; opening_stock: number; purchased: number; sold: number;
  stock_value: number; revenue: number; profit: number;
};

export async function getProductsAdmin() {
  await requireAdmin();
  return sql<AdminProduct[]>`
    select p.id, p.sku, p.name, p.category, p.unit, p.price, p.unit_cost, p.opening_stock, p.reorder_level, p.active,
           p.alt_unit, p.alt_factor, p.alt_price,
           coalesce(pu.q, 0) as purchased, coalesce(s.q, 0) as sold,
           p.opening_stock + coalesce(pu.q, 0) - coalesce(s.q, 0) as in_stock,
           (p.opening_stock + coalesce(pu.q, 0) - coalesce(s.q, 0)) * p.unit_cost as stock_value,
           coalesce(s.rev, 0) as revenue, coalesce(s.rev, 0) - coalesce(s.cogs, 0) as profit
    from products p ${stockJoin}
    order by p.active desc, p.category nulls last, p.name
  `;
}

export async function getProductAdmin(id: number) {
  await requireAdmin();
  const [p] = await sql<{
    id: number; sku: string; name: string; category: string | null; unit: string; unit_cost: number;
    price: number; opening_stock: number; reorder_level: number; active: boolean;
    alt_unit: string | null; alt_factor: number | null; alt_price: number | null;
  }[]>`
    select id, sku, name, category, unit, unit_cost, price, opening_stock, reorder_level, active, alt_unit, alt_factor, alt_price
    from products where id = ${id}
  `;
  return p ?? null;
}

/* ── sales ────────────────────────────────────────────────────────── */

/** Per sale: what came in before it was fully paid (deposits). */
const received = sql`(select order_no, sum(amount) as amount from sale_payments group by 1)`;

/**
 * What each not-yet-paid sale still owes: its total minus what came in.
 * One row per order_no; `filter` narrows the sales lines.
 */
const owedSales = (filter = sql`true`) => sql`
  select s.order_no, min(s.customer_id) as customer_id,
         greatest(sum(s.qty * s.unit_price * (1 - s.discount_pct / 100)) - coalesce(max(r.amount), 0), 0) as owed
  from sales s left join ${received} r on r.order_no = s.order_no
  where not s.paid and ${filter}
  group by s.order_no
`;

export type SaleRow = {
  id: number; date: string; order_no: string; customer: string | null; channel: string | null;
  sku: string; product: string; qty: number; unit: string; unit_price: number; discount_pct: number; total: number;
  payment: string | null; paid: boolean; created_by: string | null;
  /** Received so far on the whole sale (same on each of its lines). */
  received: number;
  cogs?: number; profit?: number;
};

export async function getSales(month: string) {
  const user = await requireUser();
  const { from, to } = monthRange(month);
  const admin = user.role === "admin";
  return sql<SaleRow[]>`
    select s.id, s.date, s.order_no, c.name as customer, s.channel, p.sku, p.name as product,
           s.qty, s.unit, s.unit_price, s.discount_pct, s.qty * s.unit_price * (1 - s.discount_pct / 100) as total,
           s.payment, s.paid, u.name as created_by, coalesce(r.amount, 0) as received
           ${admin ? sql`, s.qty * s.unit_cost as cogs, s.qty * s.unit_price * (1 - s.discount_pct / 100) - s.qty * s.unit_cost as profit` : sql``}
    from sales s
    join products p on p.id = s.product_id
    left join customers c on c.id = s.customer_id
    left join users u on u.id = s.created_by
    left join ${received} r on r.order_no = s.order_no
    where s.date between ${from} and ${to}
    order by s.date desc, s.order_no desc, s.id
  `;
}

export async function getTodaySummary() {
  await requireUser();
  const day = today();
  const [row] = await sql<{ lines: number; orders: number; total: number; unpaid: number }[]>`
    select count(*)::int as lines, count(distinct order_no)::int as orders,
           coalesce(sum(qty * unit_price * (1 - discount_pct / 100)), 0) as total,
           (select coalesce(sum(owed), 0) from (${owedSales(sql`s.date = ${day}`)}) o) as unpaid
    from sales where date = ${day}
  `;
  return row;
}

/* ── customers ────────────────────────────────────────────────────── */

export async function getCustomers() {
  await requireUser();
  return sql<{
    id: number; name: string; phone: string | null; city: string | null; type: string | null; notes: string | null;
    lines: number; spent: number; last_order: string | null; unpaid: number;
  }[]>`
    select c.id, c.name, c.phone, c.city, c.type, c.notes,
           count(s.id)::int as lines,
           coalesce(sum(s.qty * s.unit_price * (1 - s.discount_pct / 100)), 0) as spent,
           max(s.date) as last_order,
           coalesce(max(o.owed), 0) as unpaid
    from customers c left join sales s on s.customer_id = c.id
    left join (select customer_id, sum(owed) as owed from (${owedSales()}) x group by 1) o on o.customer_id = c.id
    group by c.id order by c.name
  `;
}

/* ── orders to prepare ────────────────────────────────────────────── */

export const orderStatuses = ["new", "preparing", "ready", "out", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const openStatuses: readonly OrderStatus[] = ["new", "preparing", "ready", "out"];

export type OrderLine = {
  productId: number; product: string; unit: string; qty: number; alt: boolean; unitPrice: number; discount: number;
};

export type Order = {
  id: number; no: string; customer_name: string; phone: string | null; channel: string | null;
  fulfilment: "delivery" | "pickup"; due_date: string; due_time: string | null;
  address: string | null; city: string | null; items: string | null; notes: string | null;
  lines: OrderLine[]; total: number; deposit: number; payment: string | null; paid: boolean;
  status: OrderStatus; sale_no: string | null; sale_date: string | null; created_by: string | null;
};

// Lines come back as JSON, so their numbers are plain floats; fine at these amounts.
const orderCols = sql`
  o.id, o.no, o.customer_name, o.phone, o.channel, o.fulfilment, o.due_date, o.due_time,
  o.address, o.city, o.items, o.notes, o.deposit, o.payment, o.paid, o.status, o.sale_no, u.name as created_by,
  coalesce(l.lines, '[]') as lines, coalesce(l.total, 0) as total,
  (select min(s.date) from sales s where s.order_no = o.sale_no) as sale_date
`;
const orderJoins = sql`
  left join users u on u.id = o.created_by
  left join lateral (
    select json_agg(json_build_object(
             'productId', p.id, 'product', p.name, 'unit', case when ol.alt then p.alt_unit else p.unit end,
             'qty', ol.qty, 'alt', ol.alt, 'unitPrice', ol.unit_price, 'discount', ol.discount_pct
           ) order by ol.position, ol.id) as lines,
           sum(ol.qty * ol.unit_price * (1 - ol.discount_pct / 100)) as total
    from order_lines ol join products p on p.id = ol.product_id
    where ol.order_id = o.id
  ) l on true
`;

/** Everything not yet delivered or cancelled, soonest first. */
export async function getOpenOrders() {
  await requireUser();
  return sql<Order[]>`
    select ${orderCols} from orders o ${orderJoins}
    where o.status in ${sql(openStatuses)}
    order by o.due_date, o.due_time nulls last, o.id
  `;
}

/** Delivered and cancelled orders that were due in a month, latest first. */
export async function getClosedOrders(month: string) {
  await requireUser();
  const { from, to } = monthRange(month);
  return sql<Order[]>`
    select ${orderCols} from orders o ${orderJoins}
    where o.status in ('delivered', 'cancelled') and o.due_date between ${from} and ${to}
    order by o.due_date desc, o.due_time desc nulls last, o.id desc
  `;
}

export async function getOrder(id: number) {
  await requireUser();
  const [o] = await sql<Order[]>`
    select ${orderCols} from orders o ${orderJoins} where o.id = ${id}
  `;
  return o ?? null;
}

/* ── admin: purchases, expenses ───────────────────────────────────── */

export async function getPurchases(month: string) {
  await requireAdmin();
  const { from, to } = monthRange(month);
  return sql<{
    id: number; date: string; supplier: string | null; sku: string; product: string;
    qty: number; unit_cost: number; total: number; paid: boolean; notes: string | null;
  }[]>`
    select pu.id, pu.date, pu.supplier, p.sku, p.name as product, pu.qty, pu.unit_cost,
           pu.qty * pu.unit_cost as total, pu.paid, pu.notes
    from purchases pu join products p on p.id = pu.product_id
    where pu.date between ${from} and ${to}
    order by pu.date desc, pu.id desc
  `;
}

export async function getSuppliers() {
  await requireAdmin();
  const rows = await sql<{ supplier: string }[]>`select distinct supplier from purchases where supplier is not null order by 1`;
  return rows.map((r) => r.supplier);
}

export async function getExpenses(month: string) {
  await requireAdmin();
  const { from, to } = monthRange(month);
  return sql<{
    id: number; date: string; category: string; description: string | null;
    amount: number; payment: string | null; notes: string | null;
  }[]>`
    select id, date, category, description, amount, payment, notes
    from expenses where date between ${from} and ${to}
    order by date desc, id desc
  `;
}

/* ── admin: payroll ───────────────────────────────────────────────── */

export type Employee = {
  id: number; name: string; position: string | null; phone: string | null; monthly_salary: number;
  start_date: string | null; active: boolean; notes: string | null;
};

export async function getEmployees() {
  await requireAdmin();
  return sql<Employee[]>`
    select id, name, position, phone, monthly_salary, start_date, active, notes
    from employees order by active desc, name
  `;
}

/** Per employee for one month: salary due, what was paid, what is left. */
export async function getPayrollMonth(period: string) {
  await requireAdmin();
  const summary = await sql<{
    id: number; name: string; position: string | null; monthly_salary: number;
    salary: number; advance: number; bonus: number;
  }[]>`
    select e.id, e.name, e.position, e.monthly_salary,
           coalesce(sum(p.amount) filter (where p.kind = 'salary'), 0) as salary,
           coalesce(sum(p.amount) filter (where p.kind = 'advance'), 0) as advance,
           coalesce(sum(p.amount) filter (where p.kind = 'bonus'), 0) as bonus
    from employees e left join payroll p on p.employee_id = e.id and p.period = ${period}
    where e.active or p.id is not null
    group by e.id order by e.name
  `;
  const payments = await sql<{
    id: number; date: string; employee: string; kind: string; amount: number; notes: string | null;
  }[]>`
    select p.id, p.date, e.name as employee, p.kind, p.amount, p.notes
    from payroll p join employees e on e.id = p.employee_id
    where p.period = ${period}
    order by p.date desc, p.id desc
  `;
  return { summary, payments };
}

/* ── admin: cash & bank ───────────────────────────────────────────── */

export async function getCash(month: string) {
  await requireAdmin();
  const { from, to } = monthRange(month);
  const movements = await sql<{
    id: number; date: string; account: "cash" | "bank"; direction: "in" | "out";
    category: string; amount: number; notes: string | null;
  }[]>`
    select id, date, account, direction, category, amount, notes
    from cash_movements where date between ${from} and ${to}
    order by date desc, id desc
  `;
  // Every day of the month that had cash sales or a till count.
  const days = await sql<{ date: string; cash_sales: number; counted: number | null; count_id: number | null; notes: string | null }[]>`
    with d as (
      select date from sales where date between ${from} and ${to} and payment = 'Cash' and paid
      union select date from cash_counts where date between ${from} and ${to}
    )
    select d.date,
           coalesce((select sum(qty * unit_price * (1 - discount_pct / 100)) from sales s
                     where s.date = d.date and s.payment = 'Cash' and s.paid), 0) as cash_sales,
           cc.counted, cc.id as count_id, cc.notes
    from d left join cash_counts cc on cc.date = d.date
    order by d.date desc
  `;
  return { movements, days };
}

/* ── admin: dashboard ─────────────────────────────────────────────── */

export async function getDashboard(year: number) {
  await requireAdmin();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const months = await sql<{ m: number; revenue: number; cogs: number; items: number; expenses: number; payroll: number }[]>`
    with m as (select generate_series(1, 12) as m),
    s as (select extract(month from date)::int as m,
                 sum(qty * unit_price * (1 - discount_pct / 100)) as revenue,
                 sum(qty * unit_cost) as cogs, sum(qty) as items
          from sales where date between ${from} and ${to} group by 1),
    e as (select extract(month from date)::int as m, sum(amount) as amount
          from expenses where date between ${from} and ${to} group by 1),
    p as (select extract(month from date)::int as m, sum(amount) as amount
          from payroll where date between ${from} and ${to} group by 1)
    select m.m, coalesce(s.revenue, 0) as revenue, coalesce(s.cogs, 0) as cogs, coalesce(s.items, 0) as items,
           coalesce(e.amount, 0) as expenses, coalesce(p.amount, 0) as payroll
    from m left join s using (m) left join e using (m) left join p using (m)
    order by m.m
  `;

  const byChannel = await sql<{ label: string; amount: number }[]>`
    select coalesce(channel, '—') as label, sum(qty * unit_price * (1 - discount_pct / 100)) as amount
    from sales where date between ${from} and ${to} group by 1 order by 2 desc
  `;
  const byCategory = await sql<{ label: string; amount: number }[]>`
    select coalesce(p.category, '—') as label, sum(s.qty * s.unit_price * (1 - s.discount_pct / 100)) as amount
    from sales s join products p on p.id = s.product_id
    where s.date between ${from} and ${to} group by 1 order by 2 desc
  `;
  const byExpense = await sql<{ label: string; amount: number }[]>`
    select category as label, sum(amount) as amount
    from expenses where date between ${from} and ${to} group by 1 order by 2 desc
  `;
  // qty is in the stock unit, so kg and single pieces add up.
  const topProducts = await sql<{ label: string; unit: string; revenue: number; profit: number; qty: number }[]>`
    select p.name as label, p.unit, sum(s.qty * s.unit_price * (1 - s.discount_pct / 100)) as revenue,
           sum(s.qty * s.unit_price * (1 - s.discount_pct / 100) - s.qty * s.unit_cost) as profit, sum(s.qty * s.factor) as qty
    from sales s join products p on p.id = s.product_id
    where s.date between ${from} and ${to} group by p.id order by 2 desc limit 8
  `;

  // "Right now" figures, independent of the year.
  const [now] = await sql<{ stock_value: number; to_reorder: number; customers_owe: number; owe_suppliers: number }[]>`
    select
      (select coalesce(sum(greatest(p.opening_stock + coalesce(pu.q, 0) - coalesce(s.q, 0), 0) * p.unit_cost), 0)
         from products p ${stockJoin}) as stock_value,
      (select count(*)::int from products p ${stockJoin}
         where p.active and p.opening_stock + coalesce(pu.q, 0) - coalesce(s.q, 0) <= p.reorder_level) as to_reorder,
      (select coalesce(sum(owed), 0) from (${owedSales()}) o) as customers_owe,
      (select coalesce(sum(qty * unit_cost), 0) from purchases where not paid) as owe_suppliers
  `;

  const years = await sql<{ y: number }[]>`
    select distinct extract(year from date)::int as y from sales
    union select extract(year from now())::int order by 1 desc
  `;

  return { months, byChannel, byCategory, byExpense, topProducts, now, years: years.map((r) => r.y) };
}

/* ── admin: users ─────────────────────────────────────────────────── */

export async function getUsers() {
  await requireAdmin();
  return sql<{ id: number; name: string; email: string; role: "admin" | "staff"; active: boolean; created_at: Date }[]>`
    select id, name, email, role, active, created_at from users order by active desc, role, name
  `;
}
