import "server-only";
import { requireAdmin, requireUser } from "./auth";
import { sql } from "./db";
import type { AdjustReason } from "./adjust";
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

// Returns are negative sale lines, so they come back into stock here by
// themselves; adjustments (losses, counts) are signed.
const stockJoin = sql`
  left join (select product_id, sum(qty) as q from purchases group by 1) pu on pu.product_id = p.id
  left join (select product_id, sum(qty * factor) as q, sum(qty * unit_price * (1 - discount_pct / 100)) as rev,
                    sum(qty * unit_cost) as cogs
             from sales group by 1) s on s.product_id = p.id
  left join (select product_id, sum(qty) as q from stock_adjustments group by 1) adj on adj.product_id = p.id
`;
const inStock = sql`(p.opening_stock + coalesce(pu.q, 0) - coalesce(s.q, 0) + coalesce(adj.q, 0))`;

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
           ${inStock} as in_stock
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
           ${inStock} as in_stock,
           ${inStock} * p.unit_cost as stock_value,
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


export type Adjustment = {
  id: number; date: string; sku: string; product: string; unit: string; qty: number; reason: AdjustReason;
  notes: string | null; created_by: string | null; from_return: string | null;
  /** Admin only: what the stock that moved was worth at cost (negative = lost). */
  value?: number;
};

export async function getAdjustments(month: string) {
  const user = await requireUser();
  const { from, to } = monthRange(month);
  return sql<Adjustment[]>`
    select a.id, a.date, p.sku, p.name as product, p.unit, a.qty, a.reason, a.notes, u.name as created_by,
           s.order_no as from_return
           ${user.role === "admin" ? sql`, a.qty * a.unit_cost as value` : sql``}
    from stock_adjustments a
    join products p on p.id = a.product_id
    left join users u on u.id = a.created_by
    left join sales s on s.id = a.sale_id
    where a.date between ${from} and ${to}
    order by a.date desc, a.id desc
  `;
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
  /** On a credit note's lines: the sale they give back. */
  return_of_no: string | null;
  invoice_no: string | null;
  cogs?: number; profit?: number;
};

export async function getSales(month: string) {
  const user = await requireUser();
  const { from, to } = monthRange(month);
  const admin = user.role === "admin";
  return sql<SaleRow[]>`
    select s.id, s.date, s.order_no, c.name as customer, s.channel, p.sku, p.name as product,
           s.qty, s.unit, s.unit_price, s.discount_pct, s.qty * s.unit_price * (1 - s.discount_pct / 100) as total,
           s.payment, s.paid, u.name as created_by, coalesce(r.amount, 0) as received,
           ro.order_no as return_of_no, i.no as invoice_no
           ${admin ? sql`, s.qty * s.unit_cost as cogs, s.qty * s.unit_price * (1 - s.discount_pct / 100) - s.qty * s.unit_cost as profit` : sql``}
    from sales s
    join products p on p.id = s.product_id
    left join customers c on c.id = s.customer_id
    left join users u on u.id = s.created_by
    left join ${received} r on r.order_no = s.order_no
    left join sales ro on ro.id = s.return_of
    left join invoices i on i.order_no = s.order_no
    where s.date between ${from} and ${to}
    order by s.date desc, s.order_no desc, s.id
  `;
}

export async function getTodaySummary() {
  await requireUser();
  const day = today();
  const [row] = await sql<{ lines: number; orders: number; total: number; unpaid: number }[]>`
    select count(*)::int as lines, count(distinct order_no) filter (where return_of is null)::int as orders,
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
           count(s.id) filter (where s.return_of is null)::int as lines,
           coalesce(sum(s.qty * s.unit_price * (1 - s.discount_pct / 100)), 0) as spent,
           max(s.date) as last_order,
           coalesce(max(o.owed), 0) as unpaid
    from customers c left join sales s on s.customer_id = c.id
    left join (select customer_id, sum(owed) as owed from (${owedSales()}) x group by 1) o on o.customer_id = c.id
    group by c.id order by c.name
  `;
}

export type SaleLine = {
  id: number; product_id: number; sku: string; product: string; qty: number; unit: string; alt: boolean;
  unit_price: number; discount_pct: number; total: number;
  /** How much of this line has been given back already, in its own unit. */
  returned: number;
  cogs?: number;
};

export type Sale = {
  no: string; date: string; customer_id: number | null; customer: string | null; phone: string | null;
  ice: string | null; address: string | null; channel: string | null; payment: string | null; paid: boolean;
  created_by: string | null; created_by_id: number | null; created_at: Date;
  lines: SaleLine[]; total: number; received: number; owed: number;
  payments: { id: number; date: string; amount: number; payment: string | null; by: string | null }[];
  /** Credit notes made against this sale. */
  returns: { no: string; date: string; total: number }[];
  /** Set on a credit note: the sale it gives back. */
  return_of_no: string | null;
  /** Set when the sale came from an order to prepare. */
  order: { id: number; no: string } | null;
  invoice: { no: string; date: string; customer_name: string | null; customer_ice: string | null; customer_address: string | null } | null;
};

/** One sale or credit note with everything its page, receipt and invoice need. */
export async function getSale(no: string): Promise<Sale | null> {
  const user = await requireUser();
  const admin = user.role === "admin";
  const lines = await sql<(SaleLine & {
    date: string; customer_id: number | null; channel: string | null; payment: string | null; paid: boolean;
    created_by: string | null; created_by_id: number | null; created_at: Date; return_of_no: string | null;
  })[]>`
    select s.id, s.product_id, p.sku, p.name as product, s.qty, s.unit, s.factor <> 1 or s.unit <> p.unit as alt,
           s.unit_price, s.discount_pct, s.qty * s.unit_price * (1 - s.discount_pct / 100) as total,
           coalesce((select -sum(r.qty) from sales r where r.return_of = s.id), 0) as returned,
           s.date, s.customer_id, s.channel, s.payment, s.paid, u.name as created_by, s.created_by as created_by_id,
           s.created_at, ro.order_no as return_of_no
           ${admin ? sql`, s.qty * s.unit_cost as cogs` : sql``}
    from sales s
    join products p on p.id = s.product_id
    left join users u on u.id = s.created_by
    left join sales ro on ro.id = s.return_of
    where s.order_no = ${no}
    order by s.id
  `;
  if (!lines.length) return null;
  const first = lines[0];

  const [customer, payments, returns, order, invoice] = await Promise.all([
    first.customer_id
      ? sql<{ name: string; phone: string | null; ice: string | null; address: string | null }[]>`
          select name, phone, ice, address from customers where id = ${first.customer_id}`.then((r) => r[0])
      : null,
    sql<Sale["payments"]>`
      select sp.id, sp.date, sp.amount, sp.payment, u.name as by
      from sale_payments sp left join users u on u.id = sp.created_by
      where sp.order_no = ${no} order by sp.date, sp.id
    `,
    sql<Sale["returns"]>`
      select r.order_no as no, min(r.date) as date, sum(r.qty * r.unit_price * (1 - r.discount_pct / 100)) as total
      from sales r join sales s on s.id = r.return_of
      where s.order_no = ${no} group by r.order_no order by 2, 1
    `,
    sql<{ id: number; no: string }[]>`select id, no from orders where sale_no = ${no}`.then((r) => r[0] ?? null),
    sql<NonNullable<Sale["invoice"]>[]>`
      select no, date, customer_name, customer_ice, customer_address from invoices where order_no = ${no}
    `.then((r) => r[0] ?? null),
  ]);

  const total = lines.reduce((s, l) => s + l.total, 0);
  const received = payments.reduce((s, p) => s + p.amount, 0);
  const paid = lines.every((l) => l.paid);
  return {
    no, date: first.date, customer_id: first.customer_id, customer: customer?.name ?? null, phone: customer?.phone ?? null,
    ice: customer?.ice ?? null, address: customer?.address ?? null, channel: first.channel, payment: first.payment, paid,
    created_by: first.created_by, created_by_id: first.created_by_id, created_at: first.created_at,
    lines: lines.map(({ id, product_id, sku, product, qty, unit, alt, unit_price, discount_pct, total, returned, cogs }) =>
      ({ id, product_id, sku, product, qty, unit, alt, unit_price, discount_pct, total, returned, ...(admin ? { cogs } : {}) })),
    total, received, owed: paid ? 0 : Math.max(total - received, 0),
    payments, returns, return_of_no: first.return_of_no, order, invoice,
  };
}

/** A customer, with every sale they made (newest first) and what each still owes. */
export async function getCustomer(id: number) {
  await requireUser();
  const [c] = await sql<{
    id: number; name: string; phone: string | null; city: string | null; type: string | null; notes: string | null;
    ice: string | null; address: string | null;
  }[]>`select id, name, phone, city, type, notes, ice, address from customers where id = ${id}`;
  if (!c) return null;
  const sales = await sql<{ no: string; date: string; total: number; paid: boolean; owed: number; is_return: boolean; items: string }[]>`
    select s.order_no as no, min(s.date) as date, sum(s.qty * s.unit_price * (1 - s.discount_pct / 100)) as total,
           bool_and(s.paid) as paid, coalesce(max(o.owed), 0) as owed, bool_or(s.return_of is not null) as is_return,
           string_agg(p.name, ', ' order by s.id) as items
    from sales s
    join products p on p.id = s.product_id
    left join (${owedSales(sql`s.customer_id = ${id}`)}) o on o.order_no = s.order_no
    where s.customer_id = ${id}
    group by s.order_no order by 2 desc, 1 desc
  `;
  return { ...c, sales };
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
  // Cash that came in per day: sales paid in one go (refunds net out as
  // negative lines), plus deposits and payments on account on the day they
  // were received. A sale paid in several goes counts only through its payments.
  const days = await sql<{ date: string; cash_sales: number; counted: number | null; count_id: number | null; notes: string | null }[]>`
    with c as (
      select s.date, s.qty * s.unit_price * (1 - s.discount_pct / 100) as amount
      from sales s
      where s.date between ${from} and ${to} and s.payment = 'Cash' and s.paid
        and not exists (select 1 from sale_payments sp where sp.order_no = s.order_no)
      union all
      select date, amount from sale_payments where date between ${from} and ${to} and payment = 'Cash'
    ),
    d as (select date from c union select date from cash_counts where date between ${from} and ${to})
    select d.date, coalesce((select sum(amount) from c where c.date = d.date), 0) as cash_sales,
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

  const months = await sql<{ m: number; revenue: number; cogs: number; items: number; expenses: number; payroll: number; losses: number }[]>`
    with m as (select generate_series(1, 12) as m),
    s as (select extract(month from date)::int as m,
                 sum(qty * unit_price * (1 - discount_pct / 100)) as revenue,
                 sum(qty * unit_cost) as cogs, sum(qty) as items
          from sales where date between ${from} and ${to} group by 1),
    e as (select extract(month from date)::int as m, sum(amount) as amount
          from expenses where date between ${from} and ${to} group by 1),
    p as (select extract(month from date)::int as m, sum(amount) as amount
          from payroll where date between ${from} and ${to} group by 1),
    -- Stock lost (or found, on a count) at its cost: positive = a loss.
    a as (select extract(month from date)::int as m, -sum(qty * unit_cost) as amount
          from stock_adjustments where date between ${from} and ${to} group by 1)
    select m.m, coalesce(s.revenue, 0) as revenue, coalesce(s.cogs, 0) as cogs, coalesce(s.items, 0) as items,
           coalesce(e.amount, 0) as expenses, coalesce(p.amount, 0) as payroll, coalesce(a.amount, 0) as losses
    from m left join s using (m) left join e using (m) left join p using (m) left join a using (m)
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
      (select coalesce(sum(greatest(${inStock}, 0) * p.unit_cost), 0)
         from products p ${stockJoin}) as stock_value,
      (select count(*)::int from products p ${stockJoin}
         where p.active and ${inStock} <= p.reorder_level) as to_reorder,
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

/* ── business details ─────────────────────────────────────────────── */

export const businessKeys = [
  "business_name", "legal_name", "address", "city", "phone", "email",
  "ice", "if_no", "rc", "patente", "cnss", "vat_rate", "receipt_footer", "invoice_footer",
] as const;
export type BusinessKey = (typeof businessKeys)[number];
export type Business = Record<BusinessKey, string>;

/** Printed on receipts and invoices, so staff read them too; nothing here is private. */
export async function getBusiness(): Promise<Business> {
  await requireUser();
  const rows = await sql<{ key: string; value: string }[]>`select key, value from settings`;
  const out = Object.fromEntries(businessKeys.map((k) => [k, ""])) as Business;
  for (const r of rows) if ((businessKeys as readonly string[]).includes(r.key)) out[r.key as BusinessKey] = r.value;
  return out;
}
