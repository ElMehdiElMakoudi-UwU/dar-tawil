import "server-only";
import type { TransactionSql } from "postgres";
import { requireAdmin, requireUser } from "./auth";
import { evaluate, type ControlLine, type GapReason } from "./control";
import { sql } from "./db";
import { cashDays } from "./queries";
import { today } from "./format";

/*
 * Stock control: see db/migrations/013_stock_controls.sql for the method.
 * Only the owner (admin) runs controls, so the count sheet shows what the
 * till expects next to each count.
 */

/* Times are read in Morocco and sent as "YYYY-MM-DD HH:MI" text, so pages never deal with time zones. */

/** The POS stock of product `p`: opening + deliveries − sales + adjustments. */
const stockOf = sql`
  p.opening_stock
    + coalesce((select sum(qty) from purchase_lines where product_id = p.id), 0)
    - coalesce((select sum(qty * factor) from sales where product_id = p.id), 0)
    + coalesce((select sum(qty) from stock_adjustments where product_id = p.id), 0)
`;

/**
 * The POS stock of some products right now, locking them so a sale saved at
 * the same moment waits for the snapshot. Same sum as the products page.
 */
export async function posStock(tx: TransactionSql<any>, ids: number[]) {
  const rows = await tx<{ id: number; unit_cost: number; price: number; tol_qty: number; tol_pct: number; stock: number }[]>`
    select p.id, p.unit_cost, p.price, p.count_tolerance as tol_qty, p.count_tolerance_pct as tol_pct,
           ${stockOf} as stock
    from products p where p.id in ${tx(ids.length ? ids : [0])}
    for update
  `;
  return new Map(rows.map((r) => [r.id, { ...r, stock: Math.round(r.stock * 1000) / 1000 }]));
}

export type Control = {
  id: number; label: string; start_date: string; started_at: string; aligned: boolean;
  status: "open" | "closed"; closed_at: string | null; closed_by: string | null; corrected: boolean;
  created_by: string | null; lines: number; counted: number;
  /** Money the owner collected over the control, typed by hand. */
  cash_collected: number | null; cash_note: string | null;
};

const controlCols = sql`
  c.id, c.label, c.start_date, to_char(c.started_at at time zone 'Africa/Casablanca', 'YYYY-MM-DD HH24:MI') as started_at, c.aligned, c.status,
  to_char(c.closed_at at time zone 'Africa/Casablanca', 'YYYY-MM-DD HH24:MI') as closed_at, cu.name as closed_by, c.corrected, u.name as created_by, c.cash_collected, c.cash_note,
  (select count(*)::int from stock_control_lines l where l.control_id = c.id) as lines,
  (select count(*)::int from stock_control_lines l where l.control_id = c.id and l.counted_qty is not null) as counted
`;
const controlFrom = sql`
  stock_controls c
  left join users u on u.id = c.created_by
  left join users cu on cu.id = c.closed_by
`;

export async function getOpenControls() {
  await requireUser();
  return sql<Control[]>`select ${controlCols} from ${controlFrom} where c.status = 'open' order by c.started_at desc`;
}

export async function getControl(id: number) {
  await requireUser();
  const [c] = await sql<Control[]>`select ${controlCols} from ${controlFrom} where c.id = ${id}`;
  return c ?? null;
}

/** Every column of a line the review needs; `c` and `l` must be in scope. */
const lineCols = sql`
  l.control_id, l.product_id, p.sku, p.name, p.category, p.unit, l.start_qty, l.system_start, l.counted_qty, l.system_at_count,
  to_char(l.counted_at at time zone 'Africa/Casablanca', 'YYYY-MM-DD HH24:MI') as counted_at, u.name as counted_by,
  coalesce(l.unit_cost, p.unit_cost) as unit_cost, coalesce(l.price, p.price) as price,
  coalesce(l.tol_qty, p.count_tolerance) as tol_qty, coalesce(l.tol_pct, p.count_tolerance_pct) as tol_pct, l.gap_reason, l.gap_note,
  coalesce((
    select sum(a.qty) from stock_adjustments a
    where a.product_id = l.product_id and a.reason = 'count' and a.control_id is distinct from l.control_id
      and a.created_at > c.started_at and a.created_at <= coalesce(l.counted_at, now())
  ), 0) as manual_counts
`;
const lineFrom = sql`
  stock_control_lines l
  join stock_controls c on c.id = l.control_id
  join products p on p.id = l.product_id
  left join users u on u.id = l.counted_by
`;

/** Admin: a control's lines with everything needed to work out the gaps. */
export async function getControlLines(id: number) {
  await requireAdmin();
  return sql<ControlLine[]>`
    select ${lineCols} from ${lineFrom} where l.control_id = ${id}
    order by p.category nulls last, p.name
  `;
}

export type CountRow = ControlLine & {
  /** The POS stock right now: what is expected for a product not counted yet. */
  system_now: number;
};

/** Admin: the count sheet, with what the till expects for each product. */
export async function getCountSheet(id: number) {
  await requireAdmin();
  return sql<CountRow[]>`
    select ${lineCols}, round((${stockOf})::numeric, 3) as system_now from ${lineFrom}
    where l.control_id = ${id}
    order by p.category nulls last, p.name
  `;
}

export type StartRow = {
  id: number; sku: string; name: string; category: string | null; unit: string;
  /** The product's last count in a closed control: a starting point. */
  last_count: number | null; last_date: string | null;
  /** An open control the product is also in (it may be in several). */
  busy: number | null;
};

/** Admin: active products for a new control. */
export async function getStartSheet() {
  await requireAdmin();
  return sql<StartRow[]>`
    select p.id, p.sku, p.name, p.category, p.unit, last.counted_qty as last_count, last.date as last_date,
           (select l.control_id from stock_control_lines l join stock_controls c on c.id = l.control_id
            where l.product_id = p.id and c.status = 'open' limit 1) as busy
    from products p
    left join lateral (
      select l.counted_qty, (l.counted_at at time zone 'Africa/Casablanca')::date as date
      from stock_control_lines l join stock_controls c on c.id = l.control_id
      where l.product_id = p.id and c.status = 'closed' and l.counted_qty is not null
      order by l.counted_at desc limit 1
    ) last on true
    where p.active
    order by p.category nulls last, p.name
  `;
}

export type ClosedControl = Control & { flagged: number; net_cost: number; missing_price: number };

/** Admin: closed controls, latest first, with their gaps added up. */
export async function getClosedControls(limit = 30) {
  await requireAdmin();
  const controls = await sql<Control[]>`
    select ${controlCols} from ${controlFrom} where c.status = 'closed' order by c.closed_at desc limit ${limit}
  `;
  if (!controls.length) return [];
  const lines = await sql<(ControlLine & { control_id: number })[]>`
    select ${lineCols} from ${lineFrom} where l.control_id in ${sql(controls.map((c) => c.id))} and l.counted_qty is not null
  `;
  return controls.map((c): ClosedControl => {
    const ev = lines.filter((l) => l.control_id === c.id).map(evaluate).filter((e) => e != null);
    return {
      ...c,
      flagged: ev.filter((e) => e.flagged).length,
      net_cost: ev.reduce((s, e) => s + e.atCost, 0),
      missing_price: ev.reduce((s, e) => s + Math.min(e.atPrice, 0), 0),
    };
  });
}

export type RecurringGap = {
  product_id: number; name: string; sku: string; unit: string;
  flagged: number; counted: number; gap: number; at_cost: number;
};

/** Admin: products off beyond tolerance in at least two of the last `last` closed controls. */
export async function getRecurringGaps(last = 6) {
  await requireAdmin();
  const lines = await sql<ControlLine[]>`
    select ${lineCols} from ${lineFrom}
    where l.counted_qty is not null and l.control_id in (
      select id from stock_controls where status = 'closed' order by closed_at desc limit ${last}
    )
  `;
  const by = new Map<number, RecurringGap>();
  for (const l of lines) {
    const e = evaluate(l)!;
    const r = by.get(l.product_id) ?? { product_id: l.product_id, name: l.name, sku: l.sku, unit: l.unit, flagged: 0, counted: 0, gap: 0, at_cost: 0 };
    r.counted++;
    if (e.flagged) r.flagged++;
    r.gap += e.gap;
    r.at_cost += e.atCost;
    by.set(l.product_id, r);
  }
  return [...by.values()].filter((r) => r.flagged >= 2).sort((a, b) => a.at_cost - b.at_cost);
}

export type GapHistory = {
  control_id: number; label: string; date: string; expected: number; counted: number; gap: number;
  flagged: boolean; at_cost: number; reason: GapReason | null; note: string | null;
};

/** Admin: one product's gaps in every closed control, latest first. */
export async function getProductGapHistory(productId: number) {
  await requireAdmin();
  const lines = await sql<(ControlLine & { control_id: number; label: string })[]>`
    select ${lineCols}, c.label from ${lineFrom}
    where l.product_id = ${productId} and c.status = 'closed' and l.counted_qty is not null
    order by l.counted_at desc
  `;
  return lines.map((l): GapHistory => {
    const e = evaluate(l)!;
    return {
      control_id: l.control_id, label: l.label, date: l.counted_at!.slice(0, 10), expected: e.expected,
      counted: l.counted_qty!, gap: e.gap, flagged: e.flagged, at_cost: e.atCost, reason: l.gap_reason, note: l.gap_note,
    };
  });
}

export type Movement = {
  at: string; kind: "sale" | "return" | "delivery" | "adjustment";
  ref: string | null; ref_id: number | null; detail: string | null; by: string | null;
  /** Signed, in the product's stock unit: − leaves the shelf. */
  qty: number;
};

/**
 * Admin: what was recorded for one product between the start of a control
 * and its count (or now), to find where a gap comes from.
 */
export async function getProductMovements(controlId: number, productId: number) {
  await requireAdmin();
  return sql<Movement[]>`
    with w as (
      select c.started_at as since, coalesce(l.counted_at, now()) as until
      from stock_controls c join stock_control_lines l on l.control_id = c.id
      where c.id = ${controlId} and l.product_id = ${productId}
    ),
    m as (
      select s.created_at as t, case when s.return_of is null then 'sale' else 'return' end as kind,
             s.order_no as ref, null::int as ref_id,
             trim(both ' ' from concat_ws(' · ', s.variant, trim_scale(s.qty) || ' ' || s.unit, s.payment)) as detail,
             u.name as by, -(s.qty * s.factor) as qty
      from sales s left join users u on u.id = s.created_by, w
      where s.product_id = ${productId} and s.created_at > w.since and s.created_at <= w.until
      union all
      select pu.created_at, 'delivery', pu.ref, pu.id, pu.supplier, u.name, pl.qty
      from purchase_lines pl join purchases pu on pu.id = pl.purchase_id left join users u on u.id = pu.created_by, w
      where pl.product_id = ${productId} and pu.created_at > w.since and pu.created_at <= w.until
      union all
      select a.created_at, 'adjustment', a.reason, a.control_id, a.notes, u.name, a.qty
      from stock_adjustments a left join users u on u.id = a.created_by, w
      where a.product_id = ${productId} and a.created_at > w.since and a.created_at <= w.until
    )
    select to_char(t at time zone 'Africa/Casablanca', 'YYYY-MM-DD HH24:MI') as at, kind, ref, ref_id, detail, by, qty from m order by t
  `;
}

/**
 * Admin: the till over the same days, so a stock gap can be read next to a
 * cash gap. Only days with a closing count take part.
 */
export async function getTillGap(from: string, to = today()) {
  const days = await cashDays(from, to < from ? from : to);
  const counted = days.filter((d) => d.counted != null);
  return {
    gap: counted.reduce((s, d) => s + (d.counted! - d.cash_sales), 0),
    counted: counted.length,
    days: days.length,
  };
}

/** A line's window: from the start to its count (or the close, or now). */
const until = sql`coalesce(l.counted_at, c.closed_at, now())`;

export type ControlSales = {
  product_id: number;
  /** Sold at the POS in the stock unit, returns netted out. */
  pos_qty: number;
  pos_amount: number;
  /** Delivered over the window, in the stock unit. */
  delivered: number;
};

/** Admin: what the POS sold and what was delivered, per product, over the control. */
export async function getControlSales(controlId: number) {
  await requireAdmin();
  const rows = await sql<ControlSales[]>`
    select l.product_id,
           round(coalesce((
             select sum(s.qty * s.factor) from sales s
             where s.product_id = l.product_id and s.created_at > c.started_at and s.created_at <= ${until}
           ), 0)::numeric, 3) as pos_qty,
           round(coalesce((
             select sum(s.qty * s.unit_price * (1 - s.discount_pct / 100)) from sales s
             where s.product_id = l.product_id and s.created_at > c.started_at and s.created_at <= ${until}
           ), 0)::numeric, 2) as pos_amount,
           round(coalesce((
             select sum(pl.qty) from purchase_lines pl join purchases pu on pu.id = pl.purchase_id
             where pl.product_id = l.product_id and pu.created_at > c.started_at and pu.created_at <= ${until}
           ), 0)::numeric, 3) as delivered
    from stock_control_lines l join stock_controls c on c.id = l.control_id
    where l.control_id = ${controlId}
  `;
  return new Map(rows.map((r) => [r.product_id, r]));
}

export type ToleranceRow = { id: number; sku: string; name: string; category: string | null; unit: string; qty: number; pct: number };

/** Admin: how far each active product's count may be off before it is flagged. */
export async function getTolerances() {
  await requireAdmin();
  return sql<ToleranceRow[]>`
    select id, sku, name, category, unit, count_tolerance as qty, count_tolerance_pct as pct
    from products where active order by category nulls last, name
  `;
}
