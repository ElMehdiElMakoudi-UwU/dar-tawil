import Link from "next/link";
import { mad, qty, whatsappLink } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getT } from "@/lib/gestion/lang";
import { orderStatuses, type Order, type OrderStatus } from "@/lib/gestion/queries";
import { deleteOrder, markOrderPaid, setOrderStatus } from "../../actions";
import { ActionButton } from "../../_components/forms";
import { StatusMenu } from "./status-menu";

const badge: Record<OrderStatus, string> = {
  new: "g-badge-gold",
  preparing: "g-badge-warn",
  ready: "g-badge-good",
  out: "g-badge-good",
  delivered: "g-badge-muted",
  cancelled: "g-badge-bad",
};

/** The usual next step; pickups skip "out for delivery". */
function nextStatus(o: Order): OrderStatus | null {
  switch (o.status) {
    case "new":
      return "preparing";
    case "preparing":
      return "ready";
    case "ready":
      return o.fulfilment === "pickup" ? "delivered" : "out";
    case "out":
      return "delivered";
    default:
      return null;
  }
}

export async function OrderCard({ o, late, isAdmin }: { o: Order; late?: boolean; isAdmin: boolean }) {
  const t = await getT();
  const next = nextStatus(o);
  const nextLabel = o.status === "ready" && o.fulfilment === "pickup" ? t.prep.next.readyPickup : t.prep.next[o.status];
  const statusLabel = o.status === "delivered" && o.fulfilment === "pickup" ? t.prep.pickedUp : t.prep.statuses[o.status];
  const priced = o.lines.length > 0;
  const rest = !priced ? null : o.paid ? 0 : Math.max(o.total - o.deposit, 0);
  const wa = whatsappLink(o.phone);

  return (
    <article className={`g-card flex flex-col gap-3 ${late ? "border-[var(--g-bad)]" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2">
          <span className="font-medium">{o.no}</span>
          {o.due_time && <span className="tabular-nums">· {o.due_time}</span>}
          {late && <span className="g-badge g-badge-bad">{t.prep.late}</span>}
        </p>
        <span className={`g-badge ${badge[o.status]}`}>{statusLabel}</span>
      </header>

      <div>
        <p className="text-base font-medium">{o.customer_name}</p>
        <p className="g-muted flex flex-wrap gap-x-3 text-sm">
          {o.phone && (
            <a href={`tel:${o.phone}`} dir="ltr" className="underline-offset-2 hover:underline">
              {o.phone}
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {t.prep.whatsapp}
            </a>
          )}
          {o.channel && <span>{o.channel}</span>}
        </p>
        <p className="g-muted text-sm">
          {o.fulfilment === "pickup"
            ? t.prep.pickup
            : [t.prep.delivery, [o.address, o.city].filter(Boolean).join(", ")].filter(Boolean).join(" — ")}
        </p>
      </div>

      <div className="g-panel space-y-1 !py-3">
        {priced && (
          <ul className="space-y-0.5">
            {o.lines.map((l, i) => (
              <li key={i} dir="auto">
                {qty(l.qty)}
                {l.unit !== "U" && ` ${l.unit}`} × {l.product}
                {l.discount > 0 && <span className="g-muted text-xs"> −{qty(l.discount)}%</span>}
              </li>
            ))}
          </ul>
        )}
        {o.items && <p className={`whitespace-pre-line ${priced ? "g-muted text-sm" : ""}`}>{o.items}</p>}
      </div>
      {o.notes && <p className="g-muted -mt-1 whitespace-pre-line text-sm italic">{o.notes}</p>}

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {!priced ? (
          <span className="g-muted">{t.prep.noPrice}</span>
        ) : (
          <span className="font-medium tabular-nums">
            {mad(o.total)} {t.cur}
          </span>
        )}
        {o.deposit > 0 && !o.paid && <span className="g-muted tabular-nums">{fill(t.prep.deposit, { amount: mad(o.deposit) })}</span>}
        {o.paid ? (
          <span className="g-badge g-badge-good">{t.common.paid}</span>
        ) : (
          rest != null && rest > 0 && <span className="g-badge g-badge-bad tabular-nums">{fill(t.prep.rest, { amount: mad(rest) })}</span>
        )}
        {o.payment && <span className="g-muted text-xs">{o.payment}</span>}
        {o.sale_no && (
          <Link href={`/gestion/sales?month=${(o.sale_date ?? o.due_date).slice(0, 7)}`} className="g-muted text-xs underline underline-offset-2">
            {fill(t.prep.saleLink, { no: o.sale_no })}
          </Link>
        )}
      </p>

      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--g-line)] pt-3">
        {next && (
          <ActionButton action={setOrderStatus} fields={{ id: o.id, status: next }} className="g-btn g-btn-sm">
            {nextLabel}
          </ActionButton>
        )}
        <StatusMenu id={o.id} no={o.no} status={o.status} statuses={orderStatuses} />
        <Link href={`/gestion/orders/${o.id}`} className="g-btn g-btn-ghost g-btn-sm">
          {t.common.edit}
        </Link>
        {!o.paid && priced && o.status !== "cancelled" && (
          <ActionButton action={markOrderPaid} fields={{ id: o.id }}>
            {t.prep.markPaid}
          </ActionButton>
        )}
        {isAdmin && (
          <span className="ms-auto">
            <ActionButton
              action={deleteOrder}
              fields={{ id: o.id }}
              confirm={fill(t.prep.confirmDelete, { no: o.no })}
              className="g-link-danger"
            >
              {t.common.delete}
            </ActionButton>
          </span>
        )}
      </footer>
    </article>
  );
}
