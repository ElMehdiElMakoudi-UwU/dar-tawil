import { dayLabel, mad, qty } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import type { SaleRow } from "@/lib/gestion/queries";
import { deleteSale, setOrderPaid } from "../../actions";
import { ActionButton } from "../../_components/forms";
import { Paid } from "../../_components/ui";

/** Sales grouped by order. Profit and delete only render for admins. */
export async function OrdersTable({ rows, isAdmin }: { rows: SaleRow[]; isAdmin: boolean }) {
  const [lang, t] = await Promise.all([getLang(), getT()]);
  const orders = new Map<string, SaleRow[]>();
  for (const r of rows) orders.set(r.order_no, [...(orders.get(r.order_no) ?? []), r]);

  let total = 0;
  let profit = 0;

  return (
    <div className="g-table-wrap">
      <table className="g-table">
        <thead>
          <tr>
            <th>{t.orders.order}</th>
            <th>{t.common.customer}</th>
            <th>{t.orders.items}</th>
            <th className="num">{t.common.totalMad}</th>
            {isAdmin && <th className="num">{t.common.profit}</th>}
            <th>{t.common.payment}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...orders.entries()].map(([no, lines]) => {
            const first = lines[0];
            const orderTotal = lines.reduce((s, l) => s + l.total, 0);
            const orderProfit = lines.reduce((s, l) => s + (l.profit ?? 0), 0);
            const paid = lines.every((l) => l.paid);
            total += orderTotal;
            profit += orderProfit;
            return (
              <tr key={no}>
                <td className="whitespace-nowrap">
                  <span className="font-medium">{no}</span>
                  <br />
                  <span className="g-muted text-xs">
                    {dayLabel(first.date, lang)} · {first.created_by ?? "—"}
                  </span>
                </td>
                <td>
                  {first.customer ?? <span className="g-muted">{t.common.walkIn}</span>}
                  {first.channel && <div className="g-muted text-xs">{first.channel}</div>}
                </td>
                <td>
                  <ul className="space-y-0.5">
                    {lines.map((l) => (
                      <li key={l.id} className="flex items-baseline gap-2">
                        {/* Its own direction, so "2 pc × Dates" keeps its order in Arabic. */}
                        <span dir="auto">
                          {qty(l.qty)}
                          {l.unit !== "U" && ` ${l.unit}`} × {l.product}
                          <span className="g-muted text-xs">
                            {" "}
                            @ {mad(l.unit_price)}
                            {l.discount_pct > 0 && ` −${qty(l.discount_pct)}%`}
                          </span>
                        </span>
                        {isAdmin && (
                          <ActionButton
                            action={deleteSale}
                            fields={{ id: l.id }}
                            confirm={fill(t.orders.confirmDeleteLine, { line: `${qty(l.qty)}${l.unit !== "U" ? ` ${l.unit}` : ""} × ${l.product}`, no })}
                            className="g-link-danger"
                          >
                            ✕
                          </ActionButton>
                        )}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="num font-medium">{mad(orderTotal)}</td>
                {isAdmin && <td className={`num ${orderProfit < 0 ? "g-neg" : ""}`}>{mad(orderProfit)}</td>}
                <td>
                  <Paid paid={paid} />
                  {!paid && first.received > 0 && (
                    <div className="g-muted text-xs tabular-nums">
                      {fill(t.orders.received, { amount: mad(first.received), rest: mad(Math.max(orderTotal - first.received, 0)) })}
                    </div>
                  )}
                  {first.payment && <div className="g-muted text-xs">{first.payment}</div>}
                </td>
                <td className="text-end">
                  {!paid ? (
                    <ActionButton action={setOrderPaid} fields={{ order_no: no, paid: "true" }}>
                      {t.common.markPaid}
                    </ActionButton>
                  ) : (
                    isAdmin && (
                      <ActionButton
                        action={setOrderPaid}
                        fields={{ order_no: no, paid: "false" }}
                        confirm={fill(t.orders.confirmUnpay, { no })}
                      >
                        {t.common.unpay}
                      </ActionButton>
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              {fill(t.orders.count, { n: orders.size })}
            </td>
            <td className="num">{mad(total)}</td>
            {isAdmin && <td className="num">{mad(profit)}</td>}
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
