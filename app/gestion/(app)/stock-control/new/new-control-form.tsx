"use client";

import { useActionState, useMemo, useState } from "react";
import type { StartRow } from "@/lib/gestion/controls";
import { dateLabel, qty } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { createControl } from "../../../control-actions";
import { Message, Submit, useSubmit } from "../../../_components/forms";
import { useLang, useT } from "../../../_components/i18n";

/**
 * Pick the products to control (all, a category, a few expensive ones) and
 * type what is on the shelf. A product may be in several open controls.
 */
export function NewControlForm({ rows, today }: { rows: StartRow[]; today: string }) {
  const t = useT();
  const lang = useLang();
  const [state, run, pending] = useActionState(createControl, undefined);
  const onSubmit = useSubmit(run);
  const [picked, setPicked] = useState<Set<number>>(() => new Set(rows.map((r) => r.id)));
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const by = new Map<string, StartRow[]>();
    for (const r of rows) {
      const k = r.category ?? t.control.noCategory;
      by.set(k, [...(by.get(k) ?? []), r]);
    }
    return [...by.entries()];
  }, [rows, t]);

  const q = search.trim().toLowerCase();
  const shown = (r: StartRow) => !q || r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q);
  const toggle = (ids: number[], on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const chosen = rows.filter((r) => picked.has(r.id));
  const missing = chosen.filter((r) => !(counts[r.id] ?? "").trim()).length;
  const canFill = chosen.some((r) => r.last_count != null && !(counts[r.id] ?? "").trim());
  const fillLast = () =>
    setCounts((c) => {
      const next = { ...c };
      for (const r of chosen) if (r.last_count != null && !(c[r.id] ?? "").trim()) next[r.id] = String(r.last_count);
      return next;
    });

  const payload = JSON.stringify(chosen.map((r) => ({ productId: r.id, qty: counts[r.id] ?? "" })));

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="lines" value={payload} />

      <div className="g-card mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="g-label">{t.control.label}</span>
          <input name="label" className="g-input" placeholder={fill(t.control.defaultLabel, { date: today })} />
        </label>
        <label className="block">
          <span className="g-label">{t.control.startDate}</span>
          <input type="date" name="start_date" className="g-input" defaultValue={today} required />
        </label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2 lg:col-span-1">
          <input type="checkbox" name="align" defaultChecked className="mt-1" />
          <span>
            {t.control.align}
            <span className="g-muted block text-xs">{t.control.alignHint}</span>
          </span>
        </label>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          className="g-input w-56"
          placeholder={t.control.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t.control.search}
        />
        <button type="button" className="g-btn g-btn-ghost g-btn-sm" onClick={() => toggle(rows.map((r) => r.id), true)}>
          {t.control.pickAll}
        </button>
        <button type="button" className="g-btn g-btn-ghost g-btn-sm" onClick={() => setPicked(new Set())}>
          {t.control.pickNone}
        </button>
        {canFill && (
          <button type="button" className="g-btn g-btn-ghost g-btn-sm" onClick={fillLast}>
            {t.control.useLast}
          </button>
        )}
      </div>

      <div className="g-table-wrap">
        <table className="g-table">
          <thead>
            <tr>
              <th className="w-10" />
              <th>{t.common.product}</th>
              <th className="num">{t.control.startCount}</th>
            </tr>
          </thead>
          {groups.map(([category, items]) => {
            const visible = items.filter(shown);
            if (!visible.length) return null;
            const ids = visible.map((r) => r.id);
            const all = ids.length > 0 && ids.every((id) => picked.has(id));
            return (
              <tbody key={category}>
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      checked={all}
                      disabled={!ids.length}
                      onChange={(e) => toggle(ids, e.target.checked)}
                      aria-label={fill(t.control.pickCategory, { category })}
                    />
                  </td>
                  <td colSpan={2} className="g-label !mb-0">
                    {category}
                  </td>
                </tr>
                {visible.map((r) => {
                  const on = picked.has(r.id);
                  return (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => toggle([r.id], e.target.checked)}
                          aria-label={r.name}
                        />
                      </td>
                      <td>
                        {r.name}
                        <div className="g-muted text-xs">
                          {r.sku} · {r.unit}
                          {r.busy != null && <> · {fill(t.control.busy, { id: r.busy })}</>}
                        </div>
                      </td>
                      <td className="num">
                        <input
                          inputMode="decimal"
                          className="g-input w-28 text-end tabular-nums"
                          value={counts[r.id] ?? ""}
                          disabled={!on}
                          required={on}
                          onChange={(e) => setCounts((c) => ({ ...c, [r.id]: e.target.value }))}
                          aria-label={`${t.control.startCount} — ${r.name}`}
                        />
                        {on && r.last_count != null && r.last_date && (
                          <div className="g-muted mt-0.5 text-xs">
                            {fill(t.control.lastHint, { qty: qty(r.last_count), date: dateLabel(r.last_date, lang) })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Submit pending={pending}>{t.control.start}</Submit>
        <span className="g-muted text-sm">
          {fill(t.control.picked, { n: chosen.length })}
          {missing > 0 && <> · {fill(t.control.toType, { n: missing })}</>}
        </span>
      </div>
      <Message state={state} />
    </form>
  );
}
