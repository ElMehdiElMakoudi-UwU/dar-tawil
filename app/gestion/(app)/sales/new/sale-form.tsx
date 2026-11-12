"use client";

import { useActionState, useEffect, useState } from "react";
import { mad } from "@/lib/gestion/format";
import { createSale, updateSale } from "../../../actions";
import { Message, Submit, useSubmit } from "../../../_components/forms";
import { useT } from "../../../_components/i18n";
import { blankLine, LineEditor, linesTotal, toLine, type Line, type Product } from "../line-editor";

type SavedSale = {
  no: string; customer: string | null; channel: string | null; payment: string | null; paid: boolean;
  lines: { productId: number; qty: number; unitPrice: number; discount: number; alt: boolean }[];
};

/** One order, several lines. With `sale`, edits that sale in place (today is then its date). */
export function SaleForm({
  products,
  customers,
  channels,
  payments,
  today,
  sale,
}: {
  products: Product[];
  customers: string[];
  channels: string[];
  payments: string[];
  today: string;
  sale?: SavedSale;
}) {
  const t = useT();
  const [state, run, pending] = useActionState(sale ? updateSale : createSale, undefined);
  const onSubmit = useSubmit(run);
  const [lines, setLines] = useState<Line[]>(() => (sale ? sale.lines.map(toLine) : [blankLine()]));
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state?.ok) {
      setLines([blankLine()]);
      setFormKey((k) => k + 1);
    }
  }, [state]);

  const total = linesTotal(lines);

  return (
    <form onSubmit={onSubmit} key={formKey} className="space-y-6">
      {sale && <input type="hidden" name="order_no" value={sale.no} />}
      <div className="g-card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="g-label">{t.common.date}</span>
          <input className="g-input" type="date" name="date" defaultValue={today} required />
        </label>
        <label className="block">
          <span className="g-label">{t.common.customerOptional}</span>
          <input
            className="g-input"
            name="customer"
            list="customer-names"
            placeholder={t.common.walkIn}
            autoComplete="off"
            defaultValue={sale?.customer ?? ""}
          />
          <datalist id="customer-names">
            {customers.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="g-label">{t.common.channel}</span>
          <select className="g-input" name="channel" defaultValue={sale ? (sale.channel ?? "") : (channels[0] ?? "")}>
            {sale && !sale.channel && <option value="">—</option>}
            {/* A value since removed from the list stays selectable on its old sales. */}
            {(sale?.channel && !channels.includes(sale.channel) ? [sale.channel, ...channels] : channels).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="g-label">{t.common.payment}</span>
          <select className="g-input" name="payment" defaultValue={sale ? (sale.payment ?? "") : (payments[0] ?? "")}>
            {sale && !sale.payment && <option value="">—</option>}
            {(sale?.payment && !payments.includes(sale.payment) ? [sale.payment, ...payments] : payments).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <LineEditor products={products} lines={lines} setLines={setLines} />

      <div className="g-panel flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="paid" defaultChecked={sale ? sale.paid : true} className="size-4 accent-[var(--color-accent)]" />
          {t.common.paidNow}
        </label>
        <div className="flex items-center gap-4">
          <p className="text-lg">
            {t.common.total} <span className="font-medium tabular-nums">{mad(total)}</span> {t.cur}
          </p>
          <Submit pending={pending}>{sale ? t.sale.saveChanges : t.sales.saveSale}</Submit>
        </div>
      </div>
      <Message state={state} />
    </form>
  );
}
