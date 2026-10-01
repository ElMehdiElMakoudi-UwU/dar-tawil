"use client";

import { useActionState, useEffect, useState } from "react";
import { mad } from "@/lib/gestion/format";
import { createSale } from "../../../actions";
import { Message, Submit, useSubmit } from "../../../_components/forms";
import { useT } from "../../../_components/i18n";
import { blankLine, LineEditor, linesTotal, type Line, type Product } from "../line-editor";

/** One order, several lines. */
export function SaleForm({
  products,
  customers,
  channels,
  payments,
  today,
}: {
  products: Product[];
  customers: string[];
  channels: string[];
  payments: string[];
  today: string;
}) {
  const t = useT();
  const [state, run, pending] = useActionState(createSale, undefined);
  const onSubmit = useSubmit(run);
  const [lines, setLines] = useState<Line[]>(() => [blankLine()]);
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
      <div className="g-card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="g-label">{t.common.date}</span>
          <input className="g-input" type="date" name="date" defaultValue={today} required />
        </label>
        <label className="block">
          <span className="g-label">{t.common.customerOptional}</span>
          <input className="g-input" name="customer" list="customer-names" placeholder={t.common.walkIn} autoComplete="off" />
          <datalist id="customer-names">
            {customers.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="g-label">{t.common.channel}</span>
          <select className="g-input" name="channel" defaultValue={channels[0] ?? ""}>
            {channels.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="g-label">{t.common.payment}</span>
          <select className="g-input" name="payment" defaultValue={payments[0] ?? ""}>
            {payments.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <LineEditor products={products} lines={lines} setLines={setLines} />

      <div className="g-panel flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="paid" defaultChecked className="size-4 accent-[var(--color-accent)]" />
          {t.common.paidNow}
        </label>
        <div className="flex items-center gap-4">
          <p className="text-lg">
            {t.common.total} <span className="font-medium tabular-nums">{mad(total)}</span> {t.cur}
          </p>
          <Submit pending={pending}>{t.sales.saveSale}</Submit>
        </div>
      </div>
      <Message state={state} />
    </form>
  );
}
