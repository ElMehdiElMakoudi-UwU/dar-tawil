"use client";

import { useActionState, useEffect, useState } from "react";
import { fill } from "@/lib/gestion/i18n";
import { mad, qty } from "@/lib/gestion/format";
import type { PeriodRow } from "@/lib/gestion/queries";
import { savePeriodCounts } from "../../../actions";
import { Message, Submit, useSubmit } from "../../../_components/forms";
import { useT } from "../../../_components/i18n";

type Counts = Record<number, { start: string; end: string }>;

const toStr = (n: number | null) => (n == null ? "" : String(n));
/** null for an empty or unreadable box, so a missing count never reads as 0. */
const parse = (s: string) => {
  const v = s.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const initial = (rows: PeriodRow[]): Counts =>
  Object.fromEntries(rows.map((r) => [r.id, { start: toStr(r.start_qty), end: toStr(r.end_qty) }]));

/**
 * One row per product: the owner types the start and end counts, the
 * deliveries come from Achats, and everything else is worked out as he types.
 * Counts are saved together in one `counts` JSON field.
 */
export function PeriodTable({ from, to, rows }: { from: string; to: string; rows: PeriodRow[] }) {
  const t = useT();
  const [state, run, pending] = useActionState(savePeriodCounts, undefined);
  const onSubmit = useSubmit(run);
  const [counts, setCounts] = useState<Counts>(() => initial(rows));
  const [saved, setSaved] = useState<Counts>(counts);

  useEffect(() => {
    if (state?.ok) setSaved(counts);
    // Only when a save comes back, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const dirty = rows.some((r) => counts[r.id].start !== saved[r.id].start || counts[r.id].end !== saved[r.id].end);
  const set = (id: number, key: "start" | "end", value: string) => setCounts((c) => ({ ...c, [id]: { ...c[id], [key]: value } }));
  const canFill = rows.some((r) => r.prev_end != null && !counts[r.id].start.trim());
  const fillFromPrev = () =>
    setCounts((c) => {
      const next = { ...c };
      for (const r of rows) if (r.prev_end != null && !c[r.id].start.trim()) next[r.id] = { ...c[r.id], start: String(r.prev_end) };
      return next;
    });

  const lines = rows.map((r) => {
    const start = parse(counts[r.id].start);
    const end = parse(counts[r.id].end);
    const out = start != null && end != null ? start + r.delivered - end : null;
    return {
      r,
      out,
      revenue: out == null ? null : out * r.price,
      cost: out == null ? null : out * r.unit_cost,
      earned: out == null ? null : out * (r.price - r.unit_cost),
    };
  });
  const done = lines.filter((l) => l.out != null);
  const sum = (k: "revenue" | "cost" | "earned") => done.reduce((s, l) => s + (l[k] ?? 0), 0);
  const totals = { revenue: sum("revenue"), cost: sum("cost"), earned: sum("earned") };

  const payload = JSON.stringify(rows.map((r) => ({ productId: r.id, start: parse(counts[r.id].start), end: parse(counts[r.id].end) })));

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="counts" value={payload} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="g-card">
          <p className="g-label">{t.period.totalRevenue}</p>
          <p className="text-xl font-medium tabular-nums sm:text-2xl">{mad(totals.revenue)}</p>
        </div>
        <div className="g-card">
          <p className="g-label">{t.period.totalCost}</p>
          <p className="text-xl font-medium tabular-nums sm:text-2xl">{mad(totals.cost)}</p>
        </div>
        <div className="g-card">
          <p className="g-label">{t.period.totalEarned}</p>
          <p className={`text-xl font-medium tabular-nums sm:text-2xl ${totals.earned < 0 ? "text-[var(--g-bad)]" : totals.earned > 0 ? "text-[var(--g-good)]" : ""}`}>
            {mad(totals.earned)}
          </p>
          <p className="g-muted mt-0.5 text-xs">{fill(t.period.counted, { n: done.length, total: rows.length })}</p>
        </div>
      </div>

      {canFill && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button type="button" className="g-btn g-btn-ghost g-btn-sm" onClick={fillFromPrev}>
            {t.period.usePrev}
          </button>
          <span className="g-muted text-xs">{t.period.usePrevNote}</span>
        </div>
      )}

      <div className="g-table-wrap">
        <table className="g-table">
          <thead>
            <tr>
              <th>{t.common.product}</th>
              <th className="num">{t.period.start}</th>
              <th className="num">{t.period.delivered}</th>
              <th className="num">{t.period.end}</th>
              <th className="num">{t.period.out}</th>
              <th className="num">{t.period.price}</th>
              <th className="num">{t.period.revenue}</th>
              <th className="num">{t.period.cost}</th>
              <th className="num">{t.period.earned}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(({ r, out, revenue, cost, earned }) => (
              <tr key={r.id}>
                <td>
                  {r.name}
                  <div className="g-muted text-xs">
                    {r.sku} · {r.unit}
                  </div>
                </td>
                <td className="num">
                  <input
                    inputMode="decimal"
                    className="g-input w-24 text-end tabular-nums"
                    value={counts[r.id].start}
                    onChange={(e) => set(r.id, "start", e.target.value)}
                    placeholder={r.prev_end != null ? String(r.prev_end) : ""}
                    aria-label={`${t.period.start} — ${r.name}`}
                  />
                  {r.prev_end != null && !counts[r.id].start.trim() && (
                    <div className="g-muted mt-0.5 text-xs">{fill(t.period.prevHint, { qty: qty(r.prev_end) })}</div>
                  )}
                </td>
                <td className="num tabular-nums">{r.delivered ? `+${qty(r.delivered)}` : "—"}</td>
                <td className="num">
                  <input
                    inputMode="decimal"
                    className="g-input w-24 text-end tabular-nums"
                    value={counts[r.id].end}
                    onChange={(e) => set(r.id, "end", e.target.value)}
                    aria-label={`${t.period.end} — ${r.name}`}
                  />
                </td>
                <td className={`num tabular-nums ${out != null && out < 0 ? "g-neg" : ""}`} title={out != null && out < 0 ? t.period.negative : undefined}>
                  {qty(out)}
                </td>
                <td className="num tabular-nums">{mad(r.price)}</td>
                <td className="num tabular-nums">{mad(revenue)}</td>
                <td className="num tabular-nums">{mad(cost)}</td>
                <td className={`num font-medium tabular-nums ${earned != null && earned < 0 ? "g-neg" : ""}`}>{mad(earned)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>{t.common.total}</td>
              <td className="num">{mad(totals.revenue)}</td>
              <td className="num">{mad(totals.cost)}</td>
              <td className="num">{mad(totals.earned)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {lines.some((l) => l.out != null && l.out < 0) && <p className="mt-3 text-sm text-[var(--g-bad)]">{t.period.negative}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Submit pending={pending}>{t.period.save}</Submit>
        {dirty && <span className="g-muted text-sm">{t.period.unsaved}</span>}
      </div>
      <Message state={state} />
      <p className="g-muted mt-4 text-xs">{t.period.note}</p>
    </form>
  );
}
