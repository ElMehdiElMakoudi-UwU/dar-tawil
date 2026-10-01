import "server-only";
import type { TransactionSql } from "postgres";
import { InputError } from "./form";

/** alt: sold in the product's second unit (e.g. by the piece) instead of its stock unit. */
export type Line = { productId: number; qty: number; unitPrice: number; discount: number; alt?: boolean };

/** The `lines` JSON field sent by the line editor, checked. At least one line. */
export function parseLines(fd: FormData): Line[] {
  let lines: Line[];
  try {
    lines = JSON.parse(String(fd.get("lines") ?? "[]"));
  } catch {
    throw new InputError("readProducts");
  }
  if (!Array.isArray(lines)) throw new InputError("readProducts");
  lines = lines.filter((l) => l && l.productId);
  if (!lines.length) throw new InputError("addProduct");
  for (const l of lines) {
    if (!Number.isInteger(l.productId)) throw new InputError("pickProduct");
    if (!(l.qty > 0)) throw new InputError("qtyPositive");
    if (!(l.unitPrice >= 0)) throw new InputError("priceNegative");
    if (!(l.discount >= 0 && l.discount <= 100)) throw new InputError("discountRange");
  }
  return lines;
}

export const linesTotal = (lines: Line[]) => lines.reduce((s, l) => s + l.qty * l.unitPrice * (1 - l.discount / 100), 0);

/**
 * Writes the lines of one sale under `no` (a fresh one when omitted) and
 * returns it. Unit, factor and unit_cost come from the product here; staff
 * never send or see the cost. unit_cost is per unit sold.
 */
export async function insertSale(
  tx: TransactionSql<any>,
  sale: {
    no?: string; day: string; customerId: number | null; channel: string | null;
    payment: string | null; paid: boolean; userId: number; lines: Line[];
  },
) {
  const no = sale.no ?? (await tx<{ no: string }[]>`select 'O' || lpad(nextval('order_seq')::text, 5, '0') as no`)[0].no;
  for (const l of sale.lines) {
    const alt = l.alt === true;
    const inserted = await tx`
      insert into sales (date, order_no, customer_id, channel, product_id, qty, unit, factor, unit_price, discount_pct, unit_cost, payment, paid, created_by)
      select ${sale.day}, ${no}, ${sale.customerId}, ${sale.channel}, p.id, ${l.qty}, u.unit, u.factor, ${l.unitPrice}, ${l.discount},
             round(p.unit_cost * u.factor, 4), ${sale.payment}, ${sale.paid}, ${sale.userId}
      from products p
      cross join lateral (
        select case when ${alt} then p.alt_unit else p.unit end as unit,
               case when ${alt} then p.alt_factor else 1 end as factor
      ) u
      where p.id = ${l.productId} and p.active and u.unit is not null
    `;
    if (inserted.count !== 1) {
      throw new InputError(alt ? "altGone" : "productGone");
    }
  }
  return no;
}
