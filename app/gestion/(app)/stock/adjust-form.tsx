"use client";

import { useState } from "react";
import { qty as fmtQty } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { adjustReasons, type AdjustReason } from "@/lib/gestion/adjust";
import { createAdjustment } from "../../actions";
import { ActionForm, Submit } from "../../_components/forms";
import { useT } from "../../_components/i18n";

type Product = { id: number; sku: string; name: string; unit: string; in_stock: number };

/** What the quantity means depends on the reason: lost, counted, or a signed correction. */
export function AdjustForm({ products, today }: { products: Product[]; today: string }) {
  const t = useT();
  const [reason, setReason] = useState<AdjustReason>("waste");
  const [productId, setProductId] = useState<number | "">("");
  const p = products.find((x) => x.id === productId);
  const unit = p && p.unit !== "U" ? ` (${p.unit})` : "";

  return (
    <ActionForm action={createAdjustment} className="g-card">
      <h2 className="mb-3 text-lg">{t.adjust.formTitle}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <label className="block">
          <span className="g-label">{t.common.product}</span>
          <select
            className="g-input"
            name="product_id"
            required
            value={productId}
            onChange={(e) => setProductId(Number(e.target.value) || "")}
          >
            <option value="">{t.common.choose}</option>
            {products.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({x.sku})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="g-label">{t.adjust.reason}</span>
          <select className="g-input" name="reason" value={reason} onChange={(e) => setReason(e.target.value as AdjustReason)}>
            {adjustReasons.map((r) => (
              <option key={r} value={r}>
                {t.adjust.reasons[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="g-label">
            {(reason === "count" ? t.adjust.qtyCounted : reason === "other" ? t.adjust.qtySigned : t.adjust.qtyLost) + unit}
          </span>
          <input className="g-input" name="qty" inputMode="decimal" required />
        </label>
        <label className="block">
          <span className="g-label">{t.common.date}</span>
          <input className="g-input" type="date" name="date" defaultValue={today} required />
        </label>
        <label className="block sm:col-span-2 lg:col-span-4">
          <span className="g-label">{t.common.notes}</span>
          <input className="g-input" name="notes" placeholder={t.adjust.notesPh} />
        </label>
      </div>
      <p className="g-muted mt-3 text-xs">
        {p && fill(t.adjust.systemSays, { qty: fmtQty(p.in_stock), unit: p.unit })} {t.adjust.hints[reason]}
      </p>
      <div className="mt-4">
        <Submit>{t.adjust.save}</Submit>
      </div>
    </ActionForm>
  );
}
