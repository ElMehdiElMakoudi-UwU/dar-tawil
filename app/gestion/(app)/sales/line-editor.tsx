"use client";

import { mad, qty as fmtQty } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { useT } from "../../_components/i18n";

export type Product = {
  id: number; sku: string; name: string; price: number; in_stock: number; unit: string;
  alt_unit: string | null; alt_factor: number | null; alt_price: number | null;
};
/** alt: sold in the product's second unit (by the piece) rather than its stock unit. */
export type Line = { key: number; productId: number | ""; qty: string; unitPrice: string; discount: string; alt: boolean };

let nextKey = 1;
export const blankLine = (): Line => ({ key: nextKey++, productId: "", qty: "1", unitPrice: "", discount: "", alt: false });
/** A saved line (numbers) back into the editor's text fields. */
export const toLine = (l: { productId: number; qty: number; unitPrice: number; discount: number; alt: boolean }): Line => ({
  key: nextKey++,
  productId: l.productId,
  qty: String(l.qty),
  unitPrice: String(l.unitPrice),
  discount: l.discount ? String(l.discount) : "",
  alt: l.alt,
});
const num = (s: string) => Number(s.replace(",", ".")) || 0;
const lineTotal = (l: Line) => num(l.qty) * num(l.unitPrice) * (1 - num(l.discount) / 100);
export const linesTotal = (lines: Line[]) => lines.reduce((s, l) => s + (l.productId ? lineTotal(l) : 0), 0);

/**
 * The product lines of a sale or an order, sent as one `lines` JSON field.
 * Picking a product fills its price (editable); the cost side is filled in on
 * the server and never reaches this page.
 */
export function LineEditor({
  products,
  lines,
  setLines,
}: {
  products: Product[];
  lines: Line[];
  setLines: (update: (lines: Line[]) => Line[]) => void;
}) {
  const t = useT();
  const byId = new Map(products.map((p) => [p.id, p]));

  const update = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const payload = JSON.stringify(
    lines
      .filter((l) => l.productId)
      .map((l) => ({ productId: l.productId, qty: num(l.qty), unitPrice: num(l.unitPrice), discount: num(l.discount), alt: l.alt })),
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name="lines" value={payload} />
      {lines.map((l, i) => {
        const p = l.productId ? byId.get(l.productId) : undefined;
        return (
          <div key={l.key} className="g-card grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,3fr)_repeat(3,minmax(0,1fr))_auto] sm:items-end">
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
                  update(l.key, { productId: id, unitPrice: prod ? String(prod.price) : "", alt: false });
                }}
              >
                <option value="">{t.common.choose}</option>
                {products.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.name} ({prod.sku}) — {fill(t.sales.left, { qty: fmtQty(prod.in_stock), unit: prod.unit })}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="g-label">
                {t.common.qty}
                {p && !p.alt_unit && p.unit !== "U" ? ` (${p.unit})` : ""}
              </span>
              <div className="flex gap-1">
                <input
                  className="g-input min-w-0"
                  inputMode="decimal"
                  value={l.qty}
                  onChange={(e) => update(l.key, { qty: e.target.value })}
                />
                {p?.alt_unit && (
                  <select
                    className="g-input w-auto"
                    aria-label={t.common.soldBy}
                    value={l.alt ? "alt" : "stock"}
                    onChange={(e) => {
                      const alt = e.target.value === "alt";
                      update(l.key, { alt, unitPrice: String(alt ? p.alt_price : p.price) });
                    }}
                  >
                    <option value="stock">{p.unit}</option>
                    <option value="alt">{p.alt_unit}</option>
                  </select>
                )}
              </div>
            </label>
            <label className="block">
              <span className="g-label">{t.common.priceMad}</span>
              <input
                className="g-input"
                inputMode="decimal"
                value={l.unitPrice}
                onChange={(e) => update(l.key, { unitPrice: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="g-label">{t.common.discountPct}</span>
              <input
                className="g-input"
                inputMode="decimal"
                placeholder="0"
                value={l.discount}
                onChange={(e) => update(l.key, { discount: e.target.value })}
              />
            </label>
            <div className="flex items-center justify-between gap-3 sm:block sm:text-end">
              <p className="tabular-nums font-medium sm:mb-2">{p ? mad(lineTotal(l)) : "—"}</p>
              {lines.length > 1 && (
                <button
                  type="button"
                  className="g-link-danger"
                  onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                >
                  {t.common.remove}
                </button>
              )}
            </div>
            {p && num(l.qty) * (l.alt ? p.alt_factor ?? 1 : 1) > p.in_stock && (
              <p className="col-span-full text-xs text-[var(--g-bad)]">
                {fill(t.common.onlyInStock, { qty: fmtQty(p.in_stock), unit: p.unit })}
              </p>
            )}
          </div>
        );
      })}
      <button type="button" className="g-btn g-btn-ghost" onClick={() => setLines((ls) => [...ls, blankLine()])}>
        {t.sales.addAnother}
      </button>
    </div>
  );
}
