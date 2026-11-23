"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { evaluate, gapReasons, type ControlLine, type GapReason } from "@/lib/gestion/control";
import { mad, qty, stampLabel } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { reviewControl } from "../../../control-actions";
import { Message } from "../../../_components/forms";
import { useLang, useT } from "../../../_components/i18n";

type Review = { reason: GapReason | ""; note: string };

const signed = (n: number) => `${n > 0 ? "+" : ""}${qty(n)}`;

/**
 * Every product of the control with its gap. Lines beyond tolerance are red
 * and come first, biggest value first; the owner writes what he found for
 * each, then closes the control.
 */
export function ReviewTable({ controlId, lines, open, corrected }: { controlId: number; lines: ControlLine[]; open: boolean; corrected: boolean }) {
  const t = useT();
  const lang = useLang();
  const [state, run, pending] = useActionState(reviewControl, undefined);
  const [reviews, setReviews] = useState<Record<number, Review>>(() =>
    Object.fromEntries(lines.map((l) => [l.product_id, { reason: l.gap_reason ?? "", note: l.gap_note ?? "" }])),
  );
  const [onlyGaps, setOnlyGaps] = useState(true);

  const rows = lines
    .map((l) => ({ l, e: evaluate(l) }))
    .sort((a, b) => {
      if (!a.e || !b.e) return a.e ? -1 : b.e ? 1 : 0;
      if (a.e.flagged !== b.e.flagged) return a.e.flagged ? -1 : 1;
      return Math.abs(b.e.atCost) - Math.abs(a.e.atCost) || Math.abs(b.e.gap) - Math.abs(a.e.gap);
    });
  // A manual correction during the control can hide a gap: always show it.
  const shown = onlyGaps ? rows.filter((r) => (r.e && r.e.gap !== 0) || r.l.manual_counts !== 0) : rows;
  const counted = rows.filter((r) => r.e);
  const unexplained = counted.filter((r) => r.e!.flagged && !reviews[r.l.product_id].reason).length;
  const totals = counted.reduce((s, r) => ({ cost: s.cost + r.e!.atCost, price: s.price + r.e!.atPrice }), { cost: 0, price: 0 });

  const set = (id: number, patch: Partial<Review>) => setReviews((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const payload = JSON.stringify(
    counted.map(({ l }) => ({ productId: l.product_id, reason: reviews[l.product_id].reason || null, note: reviews[l.product_id].note })),
  );

  // The clicked button says whether to save or to close.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "close" && !window.confirm(t.control.confirmClose)) return;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => run(fd));
  };

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={controlId} />
      <input type="hidden" name="reviews" value={payload} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className={`g-btn g-btn-sm ${onlyGaps ? "" : "g-btn-ghost"}`} onClick={() => setOnlyGaps(true)}>
          {t.control.onlyGaps}
        </button>
        <button type="button" className={`g-btn g-btn-sm ${onlyGaps ? "g-btn-ghost" : ""}`} onClick={() => setOnlyGaps(false)}>
          {fill(t.control.allProducts, { n: rows.length })}
        </button>
      </div>

      {shown.length ? (
        <div className="g-table-wrap">
          <table className="g-table">
            <thead>
              <tr>
                <th>{t.common.product}</th>
                <th className="num">{t.control.startCount}<span className="g-th-hint">{t.control.colHint.start}</span></th>
                <th className="num">{t.control.moved}<span className="g-th-hint">{t.control.colHint.moved}</span></th>
                <th className="num">{t.control.expected}<span className="g-th-hint">{t.control.colHint.expected}</span></th>
                <th className="num">{t.control.counted}<span className="g-th-hint">{t.control.colHint.counted}</span></th>
                <th className="num">{t.control.gap}<span className="g-th-hint">{t.control.colHint.gap}</span></th>
                <th className="num">{t.control.tolerance}<span className="g-th-hint">{t.control.colHint.tolerance}</span></th>
                <th className="num">{t.control.gapCostShort}<span className="g-th-hint">{t.control.colHint.atCost}</span></th>
                <th className="num">{t.control.gapPriceShort}<span className="g-th-hint">{t.control.colHint.atPrice}</span></th>
                <th>{t.control.finding}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map(({ l, e }) => {
                const r = reviews[l.product_id];
                return (
                  <tr key={l.product_id} className={e?.flagged ? "g-row-flag" : undefined}>
                    <td>
                      {l.name}
                      <div className="g-muted text-xs">
                        {l.sku} · {l.unit}
                        {l.counted_at && (
                          <>
                            {" · "}
                            {fill(t.control.countedBy, { time: stampLabel(l.counted_at, lang), name: l.counted_by ?? "—" })}
                          </>
                        )}
                      </div>
                      {l.manual_counts !== 0 && (
                        <span className="g-badge g-badge-warn mt-1" title={t.control.manualCountsHint}>
                          {fill(t.control.manualCounts, { qty: signed(l.manual_counts) })}
                        </span>
                      )}
                    </td>
                    <td className="num tabular-nums">{qty(l.start_qty)}</td>
                    <td className="num tabular-nums" dir="ltr">
                      {e ? signed(e.moved) : "—"}
                    </td>
                    <td className="num tabular-nums">{e ? qty(e.expected) : "—"}</td>
                    <td className="num tabular-nums">{qty(l.counted_qty)}</td>
                    <td className={`num font-medium tabular-nums ${e && e.gap < 0 ? "g-neg" : ""}`} dir="ltr">
                      {e ? (e.gap === 0 ? "✓" : signed(e.gap)) : t.control.notCounted}
                    </td>
                    <td className="num tabular-nums g-muted">{e ? `± ${qty(e.allowed)}` : "—"}</td>
                    <td className={`num tabular-nums ${e && e.atCost < 0 ? "g-neg" : ""}`}>{e ? mad(e.atCost) : "—"}</td>
                    <td className={`num tabular-nums ${e && e.atPrice < 0 ? "g-neg" : ""}`}>{e ? mad(e.atPrice) : "—"}</td>
                    <td className="min-w-52">
                      {e && e.gap !== 0 ? (
                        open ? (
                          <>
                            <select
                              className="g-input"
                              value={r.reason}
                              onChange={(ev) => set(l.product_id, { reason: ev.target.value as GapReason | "" })}
                              aria-label={`${t.control.finding} — ${l.name}`}
                            >
                              <option value="">{e.flagged ? t.control.toExplain : t.control.withinTolerance}</option>
                              {gapReasons.map((g) => (
                                <option key={g} value={g}>
                                  {t.control.reasons[g]}
                                </option>
                              ))}
                            </select>
                            <input
                              className="g-input mt-1"
                              value={r.note}
                              maxLength={500}
                              placeholder={t.control.notePh}
                              onChange={(ev) => set(l.product_id, { note: ev.target.value })}
                              aria-label={`${t.common.notes} — ${l.name}`}
                            />
                          </>
                        ) : (
                          <>
                            {l.gap_reason ? t.control.reasons[l.gap_reason] : e.flagged ? "—" : t.control.withinTolerance}
                            {l.gap_note && <div className="g-muted text-xs">{l.gap_note}</div>}
                          </>
                        )
                      ) : null}
                    </td>
                    <td className="text-end">
                      <Link href={`/gestion/stock-control/${controlId}/product/${l.product_id}`} className="g-btn g-btn-ghost g-btn-sm">
                        {t.control.detail}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7}>{t.common.total}</td>
                <td className="num">{mad(totals.cost)}</td>
                <td className="num">{mad(totals.price)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="g-panel g-muted text-sm">{counted.length ? t.control.noGaps : t.control.nothingCounted}</p>
      )}

      {open ? (
        <div className="g-card mt-6">
          <h2 className="mb-2 text-lg">{t.control.closeTitle}</h2>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="apply" defaultChecked className="mt-1" />
            <span>
              {t.control.apply}
              <span className="g-muted block text-xs">{t.control.applyHint}</span>
            </span>
          </label>
          {unexplained > 0 && <p className="mt-3 text-sm text-[var(--g-bad)]">{fill(t.control.stillToExplain, { n: unexplained })}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" name="intent" value="save" className="g-btn g-btn-ghost" disabled={pending}>
              {pending ? t.common.saving : t.control.saveFindings}
            </button>
            <button type="submit" name="intent" value="close" className="g-btn" disabled={pending || !counted.length}>
              {t.control.close}
            </button>
          </div>
          <Message state={state} />
        </div>
      ) : (
        <p className="g-muted mt-4 text-sm">{corrected ? t.control.correctedNote : t.control.notCorrectedNote}</p>
      )}
    </form>
  );
}
