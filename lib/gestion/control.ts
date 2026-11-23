/** Stock control: what a gap is, shared by the server and the review table. */

/** What the owner found when he checked a gap. */
export const gapReasons = ["waste", "input_error", "missing_delivery", "count_error", "unexplained"] as const;
export type GapReason = (typeof gapReasons)[number];

export type ControlLine = {
  product_id: number; sku: string; name: string; category: string | null; unit: string;
  start_qty: number; system_start: number;
  counted_qty: number | null; system_at_count: number | null;
  counted_at: string | null; counted_by: string | null;
  /** Cost, price and tolerances: frozen when counted, the product's current ones before that. */
  unit_cost: number; price: number;
  tol_qty: number; tol_pct: number;
  gap_reason: GapReason | null; gap_note: string | null;
  /**
   * "Stock compté" corrections typed in Pertes & inventaire while the
   * control ran: they move the POS stock onto the shelf and hide part of the gap.
   */
  manual_counts: number;
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export type Evaluated = {
  /** What the till says moved between the start and the count (− sold, + delivered). */
  moved: number;
  expected: number;
  gap: number;
  /** The largest gap still accepted. */
  allowed: number;
  flagged: boolean;
  /** The gap at cost and at selling price (negative = missing). */
  atCost: number;
  atPrice: number;
};

/** null until the product has been counted. */
export function evaluate(l: Pick<ControlLine, "start_qty" | "system_start" | "counted_qty" | "system_at_count" | "unit_cost" | "price" | "tol_qty" | "tol_pct">): Evaluated | null {
  if (l.counted_qty == null || l.system_at_count == null) return null;
  const moved = round3(l.system_at_count - l.system_start);
  const expected = round3(l.start_qty + moved);
  const gap = round3(l.counted_qty - expected);
  const allowed = round3(Math.max(l.tol_qty, (l.tol_pct / 100) * Math.abs(expected)));
  return {
    moved,
    expected,
    gap,
    allowed,
    flagged: Math.abs(gap) > allowed + 1e-9,
    atCost: gap * l.unit_cost,
    atPrice: gap * l.price,
  };
}
