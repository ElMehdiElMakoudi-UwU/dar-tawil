"use client";

import { useEffect, useRef, useState } from "react";
import { mad } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { useT } from "../../_components/i18n";

type Row = { key: number; label: string; price: string; weight: string };
type Variant = { label: string; price: number; weight: number };

let nextKey = 1;
const blank = (): Row => ({ key: nextKey++, label: "", price: "", weight: "" });
const num = (s: string) => Number(s.replace(",", "."));

/**
 * The product's sub-products, as many as the admin adds: a name, a selling
 * price and the weight of one piece in the stock unit. They all share the
 * product's stock and its purchase cost per stock unit, so each piece costs
 * cost × weight. Sent as variant_label / variant_price / variant_weight rows.
 */
export function VariantRows({ variants, unit, unitCost }: { variants: Variant[]; unit: string; unitCost: number }) {
  const t = useT();
  const saved = () => variants.map((v) => ({ key: nextKey++, label: v.label, price: String(v.price), weight: String(v.weight) }));
  const [rows, setRows] = useState<Row[]>(saved);
  const ref = useRef<HTMLDivElement>(null);
  // "Add product" clears its form after saving with form.reset(), which
  // doesn't reach state: start over from the saved rows then too.
  useEffect(() => {
    const form = ref.current?.closest("form");
    const onReset = () => setRows(saved());
    form?.addEventListener("reset", onReset);
    return () => form?.removeEventListener("reset", onReset);
  });
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div ref={ref} className="space-y-2">
      {rows.length > 0 && (
        <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 sm:grid">
          <span className="g-label">{t.products.variantLabel}</span>
          <span className="g-label">{t.products.variantPrice}</span>
          <span className="g-label">{fill(t.products.variantWeight, { unit })}</span>
          <span className="g-label">{t.products.variantCost}</span>
          <span />
        </div>
      )}
      {rows.map((r) => {
        const w = r.weight.trim() ? num(r.weight) : 1;
        const cost = unitCost > 0 && w > 0 ? unitCost * w : null;
        return (
          <div
            key={r.key}
            className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
          >
            <input
              className="g-input col-span-2 sm:col-span-1"
              name="variant_label"
              aria-label={t.products.variantLabel}
              placeholder={t.products.variantLabelPh}
              value={r.label}
              onChange={(e) => update(r.key, { label: e.target.value })}
              required
            />
            <input
              className="g-input"
              name="variant_price"
              inputMode="decimal"
              aria-label={t.products.variantPrice}
              placeholder={t.products.variantPrice}
              value={r.price}
              onChange={(e) => update(r.key, { price: e.target.value })}
              required
            />
            <input
              className="g-input"
              name="variant_weight"
              inputMode="decimal"
              aria-label={fill(t.products.variantWeight, { unit })}
              placeholder={t.products.variantWeightPh}
              value={r.weight}
              onChange={(e) => update(r.key, { weight: e.target.value })}
            />
            <span className="g-muted text-sm tabular-nums">
              <span className="sm:hidden">{t.products.variantCost} </span>
              {cost == null ? "—" : mad(cost)}
            </span>
            <button
              type="button"
              className="g-link-danger justify-self-end"
              onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
            >
              {t.common.remove}
            </button>
          </div>
        );
      })}
      <button type="button" className="g-btn g-btn-ghost g-btn-sm" onClick={() => setRows((rs) => [...rs, blank()])}>
        {t.products.addVariant}
      </button>
    </div>
  );
}
