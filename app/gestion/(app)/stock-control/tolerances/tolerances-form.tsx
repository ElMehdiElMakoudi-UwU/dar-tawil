"use client";

import { useActionState, useState } from "react";
import type { ToleranceRow } from "@/lib/gestion/controls";
import { saveTolerances } from "../../../control-actions";
import { Message, Submit, useSubmit } from "../../../_components/forms";
import { useT } from "../../../_components/i18n";

type Values = Record<number, { qty: string; pct: string }>;

const str = (n: number) => (n ? String(n) : "");

/** Per product: a fixed quantity and a share of the expected stock; the larger one is allowed. */
export function TolerancesForm({ rows }: { rows: ToleranceRow[] }) {
  const t = useT();
  const [state, run, pending] = useActionState(saveTolerances, undefined);
  const onSubmit = useSubmit(run);
  const [values, setValues] = useState<Values>(() => Object.fromEntries(rows.map((r) => [r.id, { qty: str(r.qty), pct: str(r.pct) }])));
  const categories = [...new Set(rows.map((r) => r.category ?? ""))];
  const [bulk, setBulk] = useState({ category: "*", qty: "", pct: "" });

  const set = (id: number, key: "qty" | "pct", value: string) => setValues((v) => ({ ...v, [id]: { ...v[id], [key]: value } }));
  const applyBulk = () =>
    setValues((v) => {
      const next = { ...v };
      for (const r of rows) {
        if (bulk.category !== "*" && (r.category ?? "") !== bulk.category) continue;
        next[r.id] = { qty: bulk.qty || next[r.id].qty, pct: bulk.pct || next[r.id].pct };
      }
      return next;
    });

  const payload = JSON.stringify(rows.map((r) => ({ productId: r.id, qty: values[r.id].qty, pct: values[r.id].pct })));

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="tolerances" value={payload} />

      <div className="g-card mb-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="g-label">{t.common.category}</span>
          <select className="g-input" value={bulk.category} onChange={(e) => setBulk((b) => ({ ...b, category: e.target.value }))}>
            <option value="*">{t.control.allCategories}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c || t.control.noCategory}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="g-label">{t.control.tolQty}</span>
          <input inputMode="decimal" className="g-input w-28" value={bulk.qty} onChange={(e) => setBulk((b) => ({ ...b, qty: e.target.value }))} />
        </label>
        <label className="block">
          <span className="g-label">{t.control.tolPct}</span>
          <input inputMode="decimal" className="g-input w-28" value={bulk.pct} onChange={(e) => setBulk((b) => ({ ...b, pct: e.target.value }))} />
        </label>
        <button type="button" className="g-btn g-btn-ghost" onClick={applyBulk}>
          {t.control.applyBulk}
        </button>
      </div>

      <div className="g-table-wrap">
        <table className="g-table">
          <thead>
            <tr>
              <th>{t.common.product}</th>
              <th>{t.common.category}</th>
              <th className="num">{t.control.tolQty}</th>
              <th className="num">{t.control.tolPct}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.name}
                  <div className="g-muted text-xs">
                    {r.sku} · {r.unit}
                  </div>
                </td>
                <td>{r.category ?? "—"}</td>
                <td className="num">
                  <input
                    inputMode="decimal"
                    className="g-input w-24 text-end tabular-nums"
                    value={values[r.id].qty}
                    placeholder="0"
                    onChange={(e) => set(r.id, "qty", e.target.value)}
                    aria-label={`${t.control.tolQty} — ${r.name}`}
                  />
                </td>
                <td className="num">
                  <input
                    inputMode="decimal"
                    className="g-input w-20 text-end tabular-nums"
                    value={values[r.id].pct}
                    placeholder="0"
                    onChange={(e) => set(r.id, "pct", e.target.value)}
                    aria-label={`${t.control.tolPct} — ${r.name}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Submit pending={pending}>{t.common.save}</Submit>
      </div>
      <Message state={state} />
      <p className="g-muted mt-4 text-xs">{t.control.tolNote}</p>
    </form>
  );
}
