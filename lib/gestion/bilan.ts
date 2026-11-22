/*
 * Combines saved bilans (period counts) into the figures of any date range
 * the owner picks. A bilan only says what went out over its own dates, so
 * each one is spread evenly over its days: a range covering 10 of a 31-day
 * bilan takes 10/31 of its sales. When bilans overlap, each day is taken
 * from the shortest bilan that covers it (the most precise count), so
 * nothing is counted twice. Days no bilan covers bring no sales: the
 * coverage tells the owner how much of the range the figures stand on.
 */

import type { BilanLine } from "./queries";

const DAY = 86_400_000;
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
export const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);

export type UsedBilan = {
  from: string; to: string; days: number;
  /** Days of the range this bilan supplied. */
  used: number;
  share: number; revenue: number; cogs: number; products: number;
};

export type ProductTotal = { id: number; name: string; unit: string; out: number; revenue: number; cogs: number; margin: number };

export type Combined = {
  revenue: number; cogs: number;
  products: ProductTotal[];
  bilans: UsedBilan[];
  days: number; covered: number;
  /** Ranges of days no bilan covers. */
  gaps: { from: string; to: string }[];
  /** Stock at cost at the start of the first bilan used and the end of the last one. */
  stockStart: number; stockEnd: number;
};

export function combineBilans(lines: BilanLine[], from: string, to: string): Combined {
  const key = (l: { date_from: string; date_to: string }) => `${l.date_from}_${l.date_to}`;
  const groups = new Map<string, BilanLine[]>();
  for (const l of lines) groups.set(key(l), [...(groups.get(key(l)) ?? []), l]);
  const bilans = [...groups.values()].map((ls) => ({ from: ls[0].date_from, to: ls[0].date_to, days: daysBetween(ls[0].date_from, ls[0].date_to), lines: ls }));

  // Day by day: the shortest bilan covering it, the latest on a tie.
  const days = daysBetween(from, to);
  const used = new Map<string, number>();
  const gaps: { from: string; to: string }[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    const best = bilans
      .filter((b) => b.from <= d && b.to >= d)
      .sort((a, b) => a.days - b.days || (a.to < b.to ? 1 : -1))[0];
    if (best) {
      const k = `${best.from}_${best.to}`;
      used.set(k, (used.get(k) ?? 0) + 1);
    } else {
      const last = gaps[gaps.length - 1];
      if (last && addDays(last.to, 1) === d) last.to = d;
      else gaps.push({ from: d, to: d });
    }
  }

  const products = new Map<number, ProductTotal>();
  const usedBilans: UsedBilan[] = [];
  for (const b of bilans) {
    const n = used.get(`${b.from}_${b.to}`) ?? 0;
    if (!n) continue;
    const share = n / b.days;
    let revenue = 0;
    let cogs = 0;
    for (const l of b.lines) {
      const out = l.out * share;
      const p = products.get(l.product_id) ?? { id: l.product_id, name: l.name, unit: l.unit, out: 0, revenue: 0, cogs: 0, margin: 0 };
      p.out += out;
      p.revenue += out * l.price;
      p.cogs += out * l.unit_cost;
      p.margin = p.revenue - p.cogs;
      products.set(l.product_id, p);
      revenue += out * l.price;
      cogs += out * l.unit_cost;
    }
    usedBilans.push({ from: b.from, to: b.to, days: b.days, used: n, share, revenue, cogs, products: b.lines.length });
  }
  usedBilans.sort((a, b) => (a.from < b.from ? -1 : 1));

  const stockAt = (b: UsedBilan | undefined, side: "start_qty" | "end_qty") =>
    b ? groups.get(`${b.from}_${b.to}`)!.reduce((s, l) => s + l[side] * l.unit_cost, 0) : 0;

  const list = [...products.values()];
  return {
    revenue: list.reduce((s, p) => s + p.revenue, 0),
    cogs: list.reduce((s, p) => s + p.cogs, 0),
    products: list,
    bilans: usedBilans,
    days,
    covered: days - gaps.reduce((s, g) => s + daysBetween(g.from, g.to), 0),
    gaps,
    stockStart: stockAt(usedBilans[0], "start_qty"),
    stockEnd: stockAt(usedBilans[usedBilans.length - 1], "end_qty"),
  };
}
