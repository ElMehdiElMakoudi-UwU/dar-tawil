import type { ControlLine } from "@/lib/gestion/control";
import type { Control, ControlSales } from "@/lib/gestion/controls";
import { mad, qty } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getT } from "@/lib/gestion/lang";
import { Section, Stat } from "../../../_components/ui";
import { CollectedForm } from "./collected-form";

const signed = (n: number) => `${n > 0 ? "+" : ""}${qty(n)}`;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

type Row = {
  l: ControlLine;
  pos: ControlSales;
  /** Only once counted: sorti = début + livraisons − fin, and what it should have brought in. */
  shelf: { qty: number; unrecorded: number; amount: number } | null;
};

type Totals = { start: number; delivered: number; end: number; shelfQty: number; posQty: number; unrecorded: number; posAmount: number; shelfAmount: number };
const zero = (): Totals => ({ start: 0, delivered: 0, end: 0, shelfQty: 0, posQty: 0, unrecorded: 0, posAmount: 0, shelfAmount: 0 });
function add(t: Totals, r: Row) {
  t.start += r.l.start_qty;
  t.delivered += r.pos.delivered;
  t.posQty += r.pos.pos_qty;
  t.posAmount += r.pos.pos_amount;
  if (r.shelf) {
    t.end += r.l.counted_qty!;
    t.shelfQty += r.shelf.qty;
    t.unrecorded += r.shelf.unrecorded;
    t.shelfAmount += r.shelf.amount;
  }
}

/**
 * The owner's method, product by product over the control:
 *   sorti          = stock début + livraisons − stock fin compté
 *   non enregistré = sorti − vendu POS
 *   sorti au prix  = montant POS + non enregistré × prix de vente
 * then the money he collected, typed by hand, against both amounts.
 */
export async function SalesSection({ control, lines, sales }: { control: Control; lines: ControlLine[]; sales: Map<number, ControlSales> }) {
  const t = await getT();
  const rows: Row[] = lines.map((l) => {
    const pos = sales.get(l.product_id) ?? { product_id: l.product_id, pos_qty: 0, pos_amount: 0, delivered: 0 };
    if (l.counted_qty == null) return { l, pos, shelf: null };
    const out = round3(l.start_qty + pos.delivered - l.counted_qty);
    const unrecorded = round3(out - pos.pos_qty);
    return { l, pos, shelf: { qty: out, unrecorded, amount: pos.pos_amount + unrecorded * l.price } };
  });

  // Quantities only add up within one unit; products not counted yet only have POS sales.
  const byUnit = new Map<string, Totals>();
  const counted = zero();
  const pending = zero();
  for (const r of rows) {
    if (!r.shelf) {
      add(pending, r);
      continue;
    }
    const u = byUnit.get(r.l.unit) ?? zero();
    add(u, r);
    byUnit.set(r.l.unit, u);
    add(counted, r);
  }
  const notCounted = rows.length - rows.filter((r) => r.shelf).length;
  const posTotal = counted.posAmount + pending.posAmount;
  // What should be in hand: counted products at their shelf value, the others at their POS sales.
  const dueTotal = counted.shelfAmount + pending.posAmount;
  const cash = control.cash_collected;

  const q = (n: number, unit?: string) => (unit ? <>{qty(round3(n))} <span className="g-muted text-xs">{unit}</span></> : null);
  const totalRow = (label: string, x: Totals, unit?: string, posOnly = false) => (
    <tr key={label}>
      <td>{label}</td>
      <td className="num tabular-nums">{posOnly ? null : q(x.start, unit)}</td>
      <td className="num tabular-nums">{posOnly ? null : q(x.delivered, unit)}</td>
      <td className="num tabular-nums">{posOnly ? null : q(x.end, unit)}</td>
      <td className="num tabular-nums">{posOnly ? null : q(x.shelfQty, unit)}</td>
      <td className="num tabular-nums">{q(x.posQty, unit)}</td>
      <td className={`num tabular-nums ${x.unrecorded > 0 ? "g-neg" : ""}`} dir="ltr">
        {unit && !posOnly ? signed(round3(x.unrecorded)) : null}
      </td>
      <td className="num tabular-nums">{mad(x.posAmount)}</td>
      <td className="num tabular-nums">{posOnly ? null : mad(x.shelfAmount)}</td>
    </tr>
  );

  return (
    <>
      <Section title={t.control.salesTitle}>
        <p className="g-muted mb-3 text-sm">{t.control.salesSub}</p>
        <div className="g-table-wrap">
          <table className="g-table">
            <thead>
              <tr>
                <th>{t.common.product}</th>
                <th className="num">{t.control.startCount}<span className="g-th-hint">{t.control.colHint.start}</span></th>
                <th className="num">{t.control.delivered}<span className="g-th-hint">{t.control.colHint.delivered}</span></th>
                <th className="num">{t.control.endCount}<span className="g-th-hint">{t.control.colHint.counted}</span></th>
                <th className="num">{t.control.shelfSold}<span className="g-th-hint">{t.control.colHint.shelf}</span></th>
                <th className="num">{t.control.posSold}<span className="g-th-hint">{t.control.colHint.pos}</span></th>
                <th className="num">{t.control.unrecorded}<span className="g-th-hint">{t.control.colHint.unrecorded}</span></th>
                <th className="num">{t.control.posAmount}<span className="g-th-hint">{t.control.colHint.posAmount}</span></th>
                <th className="num">{t.control.shelfAmount}<span className="g-th-hint">{t.control.colHint.shelfAmount}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ l, pos, shelf }) => (
                <tr key={l.product_id} className={shelf && shelf.unrecorded > 0 ? "g-row-flag" : undefined}>
                  <td>
                    {l.name}
                    <div className="g-muted text-xs">
                      {l.sku} · {l.unit}
                    </div>
                  </td>
                  <td className="num tabular-nums">{qty(l.start_qty)}</td>
                  <td className="num tabular-nums">{pos.delivered ? qty(pos.delivered) : "—"}</td>
                  <td className="num tabular-nums">{shelf ? qty(l.counted_qty) : <span className="g-muted">{t.control.notCounted}</span>}</td>
                  <td className="num tabular-nums">{shelf ? qty(shelf.qty) : "—"}</td>
                  <td className="num tabular-nums">{qty(pos.pos_qty)}</td>
                  <td className={`num font-medium tabular-nums ${shelf && shelf.unrecorded > 0 ? "g-neg" : ""}`} dir="ltr">
                    {shelf ? (shelf.unrecorded === 0 ? "✓" : signed(shelf.unrecorded)) : "—"}
                  </td>
                  <td className="num tabular-nums">{mad(pos.pos_amount)}</td>
                  <td className="num tabular-nums">{shelf ? mad(shelf.amount) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {[...byUnit.entries()].map(([unit, x]) => totalRow(fill(t.control.totalUnit, { unit }), x, unit))}
              {byUnit.size > 1 && totalRow(t.control.totalCounted, counted)}
              {notCounted > 0 && totalRow(fill(t.control.totalPending, { n: notCounted }), pending, undefined, true)}
            </tfoot>
          </table>
        </div>
        {notCounted > 0 && <p className="g-muted mt-2 text-xs">{fill(t.control.salesNotCounted, { n: notCounted })}</p>}
      </Section>

      <Section title={t.control.collectTitle}>
        <CollectedForm key={`${cash}|${control.cash_note}`} controlId={control.id} amount={cash} note={control.cash_note} />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label={t.control.collected} value={cash == null ? "—" : mad(cash)} note={control.cash_note ?? undefined} />
          <Stat label={t.control.posAmount} value={mad(posTotal)} note={t.control.posAmountNote} />
          <Stat
            label={t.control.collectedVsPos}
            note={t.control.collectedVsPosNote}
            value={cash == null ? "—" : mad(cash - posTotal)}
            tone={cash == null ? undefined : cash - posTotal < -0.005 ? "bad" : "good"}
          />
          <Stat label={t.control.dueAmount} value={mad(dueTotal)} note={notCounted ? t.control.dueNotePending : t.control.dueNote} />
          <Stat
            label={t.control.collectedVsDue}
            note={t.control.collectedVsDueNote}
            value={cash == null ? "—" : mad(cash - dueTotal)}
            tone={cash == null ? undefined : cash - dueTotal < -0.005 ? "bad" : "good"}
          />
        </div>
        <p className="g-muted mt-4 text-xs">{t.control.salesMethod}</p>
      </Section>
    </>
  );
}
