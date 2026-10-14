"use client";

import { useActionState, useEffect, useState } from "react";
import { mad } from "@/lib/gestion/format";
import { savePurchase } from "../../../actions";
import { Message, Submit, useSubmit } from "../../../_components/forms";
import { useT } from "../../../_components/i18n";

export type Product = { id: number; sku: string; name: string; unit: string; unit_cost: number };
type Saved = {
  id: number; date: string; supplier: string | null; ref: string | null; paid: boolean; notes: string | null;
  lines: { productId: number; qty: number; unitCost: number }[];
};
type Line = { key: number; productId: number | ""; qty: string; unitCost: string };

let nextKey = 1;
const blankLine = (): Line => ({ key: nextKey++, productId: "", qty: "", unitCost: "" });
const num = (s: string) => Number(s.replace(",", ".")) || 0;
const lineTotal = (l: Line) => num(l.qty) * num(l.unitCost);

/**
 * One supplier delivery: the header once, then a line per product, sent as
 * one `lines` JSON field. Picking a product fills its current cost (editable).
 */
export function PurchaseForm({
  products,
  suppliers,
  today,
  purchase,
}: {
  products: Product[];
  suppliers: string[];
  today: string;
  purchase?: Saved;
}) {
  const t = useT();
  const [state, run, pending] = useActionState(savePurchase, undefined);
  const onSubmit = useSubmit(run);
  const [lines, setLines] = useState<Line[]>(() =>
    purchase
      ? purchase.lines.map((l) => ({ key: nextKey++, productId: l.productId, qty: String(l.qty), unitCost: String(l.unitCost) }))
      : [blankLine()],
  );
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state?.ok && !purchase) {
      setLines([blankLine()]);
      setFormKey((k) => k + 1);
    }
  }, [state, purchase]);

  const byId = new Map(products.map((p) => [p.id, p]));
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const payload = JSON.stringify(
    lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, qty: num(l.qty), unitCost: num(l.unitCost) })),
  );
  const total = lines.reduce((s, l) => s + (l.productId ? lineTotal(l) : 0), 0);

  return (
    <form onSubmit={onSubmit} key={formKey} className="space-y-4">
      {purchase && <input type="hidden" name="id" value={purchase.id} />}
      <input type="hidden" name="lines" value={payload} />

      <div className="g-card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="g-label">{t.common.date}</span>
          <input className="g-input" type="date" name="date" defaultValue={purchase?.date ?? today} required />
        </label>
        <label className="block">
          <span className="g-label">{t.purchases.supplier}</span>
          <input className="g-input" name="supplier" list="suppliers" autoComplete="off" defaultValue={purchase?.supplier ?? ""} />
          <datalist id="suppliers">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="g-label">{t.purchases.ref}</span>
          <input className="g-input" name="ref" autoComplete="off" defaultValue={purchase?.ref ?? ""} />
        </label>
        <label className="block">
          <span className="g-label">{t.common.notes}</span>
          <input className="g-input" name="notes" defaultValue={purchase?.notes ?? ""} />
        </label>
      </div>

      {lines.map((l, i) => {
        const p = l.productId ? byId.get(l.productId) : undefined;
        return (
          <div key={l.key} className="g-card grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,3fr)_repeat(2,minmax(0,1fr))_auto] sm:items-end">
            <label className="col-span-2 block sm:col-span-1">
              <span className="g-label">
                {t.common.product} {lines.length > 1 ? i + 1 : ""}
              </span>
              <select
                className="g-input"
                value={l.productId}
                required={i === 0}
                onChange={(e) => {
                  const id = Number(e.target.value) || "";
                  const prod = id ? byId.get(id) : undefined;
                  update(l.key, { productId: id, unitCost: prod ? String(prod.unit_cost) : "" });
                }}
              >
                <option value="">{t.common.choose}</option>
                {products.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.name} ({prod.sku})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="g-label">
                {t.common.quantity}
                {p && p.unit !== "U" ? ` (${p.unit})` : ""}
              </span>
              <input className="g-input" inputMode="decimal" value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} />
            </label>
            <label className="block">
              <span className="g-label">{t.common.unitCostMad}</span>
              <input className="g-input" inputMode="decimal" value={l.unitCost} onChange={(e) => update(l.key, { unitCost: e.target.value })} />
            </label>
            <div className="flex items-center justify-between gap-3 sm:block sm:text-end">
              <p className="tabular-nums font-medium sm:mb-2">{p ? mad(lineTotal(l)) : "—"}</p>
              {lines.length > 1 && (
                <button type="button" className="g-link-danger" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                  {t.common.remove}
                </button>
              )}
            </div>
          </div>
        );
      })}
      <button type="button" className="g-btn g-btn-ghost" onClick={() => setLines((ls) => [...ls, blankLine()])}>
        {t.purchases.addAnother}
      </button>

      <div className="g-panel flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="paid" defaultChecked={purchase?.paid ?? true} className="size-4 accent-[var(--color-accent)]" />
            {t.common.paid}
          </label>
          <label className="flex items-center gap-2">
            {/* On by default for a new delivery only: an old one shouldn't roll costs back. */}
            <input type="checkbox" name="update_cost" defaultChecked={!purchase} className="size-4 accent-[var(--color-accent)]" />
            {t.purchases.updateCost}
          </label>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-lg">
            {t.common.total} <span className="font-medium tabular-nums">{mad(total)}</span> {t.cur}
          </p>
          <Submit pending={pending}>{t.purchases.save}</Submit>
        </div>
      </div>
      <Message state={state} />
    </form>
  );
}
