"use client";

import { useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { evaluate } from "@/lib/gestion/control";
import type { CountRow } from "@/lib/gestion/controls";
import { qty } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { saveCount } from "../../../../control-actions";
import { useT } from "../../../../_components/i18n";

type Status = { value: string; at: string | null; state: "idle" | "saving" | "error"; error?: string };

const norm = (s: string) => s.trim().replace(",", ".");
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const signed = (n: number) => `${n > 0 ? "+" : ""}${qty(n)}`;

/** A typed box as a number, or null while it is empty or not a number yet. */
function typed(v: string) {
  const raw = norm(v);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * One box per product, with what the till expects next to it. Each count is
 * saved as soon as the box is left (or Enter is pressed), stamped with that
 * moment, so the rest of the shelf can be counted while the till keeps selling.
 */
export function CountSheet({ controlId, rows }: { controlId: number; rows: CountRow[] }) {
  const t = useT();
  const [lines, setLines] = useState<Record<number, CountRow>>(() => Object.fromEntries(rows.map((r) => [r.product_id, r])));
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.product_id, r.counted_qty == null ? "" : String(r.counted_qty)])),
  );
  const [status, setStatus] = useState<Record<number, Status>>(() =>
    Object.fromEntries(
      rows.map((r) => [r.product_id, { value: r.counted_qty == null ? "" : String(r.counted_qty), at: r.counted_at?.slice(11) ?? null, state: "idle" }]),
    ),
  );
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () => rows.filter((r) => !q || r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)),
    [rows, q],
  );
  const done = rows.filter((r) => status[r.product_id].value !== "").length;

  const save = (productId: number) => {
    const value = values[productId] ?? "";
    if (norm(value) === norm(status[productId].value) && status[productId].state !== "error") return;
    setStatus((s) => ({ ...s, [productId]: { ...s[productId], state: "saving" } }));
    startTransition(async () => {
      const res = await saveCount(controlId, productId, value);
      if (res.ok) {
        const { ok: _ok, counted_at: _at, ...frozen } = res;
        setLines((l) => ({ ...l, [productId]: { ...l[productId], ...frozen, counted_qty: typed(value) } }));
      }
      setStatus((s) => ({
        ...s,
        [productId]: res.ok ? { value: norm(value), at: res.counted_at, state: "idle" } : { ...s[productId], state: "error", error: res.error },
      }));
    });
  };

  /** Enter saves and moves to the next product, as on a paper list. */
  const next = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = [...document.querySelectorAll<HTMLInputElement>("input[data-count]")];
    const i = inputs.indexOf(e.currentTarget);
    if (inputs[i + 1]) inputs[i + 1].focus();
    else e.currentTarget.blur();
  };

  let category: string | null | undefined;

  return (
    <>
      <div className="g-card mb-4 text-sm">
        <p>{t.control.countHelp}</p>
        <p className="g-muted mt-1 text-xs">{t.control.countUnit}</p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          className="g-input w-56"
          placeholder={t.control.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t.control.search}
        />
        <span className="text-sm">{fill(t.control.progress, { n: done, total: rows.length })}</span>
      </div>

      <div className="g-table-wrap">
        <table className="g-table">
          <thead>
            <tr>
              <th>{t.common.product}</th>
              <th className="num">{t.control.expected}<span className="g-th-hint">{t.control.colHint.expected}</span></th>
              <th className="num">{t.control.counted}<span className="g-th-hint">{t.control.colHint.counted}</span></th>
              <th className="num">{t.control.gap}<span className="g-th-hint">{t.control.colHint.gap}</span></th>
              <th>{t.common.status}</th>
            </tr>
          </thead>
          <tbody>
            {visible.flatMap((r) => {
              const s = status[r.product_id];
              const l = lines[r.product_id];
              // Saved: measured against the POS stock at that moment. Being typed: against the stock now.
              const typedQty = typed(values[r.product_id] ?? "");
              const saved = s.state === "idle" && norm(values[r.product_id] ?? "") === s.value ? evaluate(l) : null;
              const live =
                saved ??
                (typedQty == null ? null : evaluate({ ...l, counted_qty: typedQty, system_at_count: l.system_now }));
              const expected = saved?.expected ?? round3(l.start_qty + l.system_now - l.system_start);
              const out = [];
              if (r.category !== category) {
                category = r.category;
                out.push(
                  <tr key={`c-${r.category}`}>
                    <td colSpan={5} className="g-label !mb-0">
                      {r.category ?? t.control.noCategory}
                    </td>
                  </tr>,
                );
              }
              out.push(
                <tr key={r.product_id} className={live?.flagged ? "g-row-flag" : undefined}>
                  <td>
                    {r.name}
                    <div className="g-muted text-xs">
                      {r.sku} · {r.unit}
                    </div>
                  </td>
                  <td className="num tabular-nums">{qty(expected)}</td>
                  <td className="num">
                    <input
                      data-count
                      inputMode="decimal"
                      enterKeyHint="next"
                      className="g-input w-28 text-end tabular-nums"
                      value={values[r.product_id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [r.product_id]: e.target.value }))}
                      onBlur={() => save(r.product_id)}
                      onKeyDown={next}
                      aria-label={`${t.control.counted} — ${r.name}`}
                    />
                  </td>
                  <td className={`num font-medium tabular-nums ${live && live.gap < 0 ? "g-neg" : ""}`} dir="ltr">
                    {live ? (live.gap === 0 ? "✓" : signed(live.gap)) : "—"}
                    {live && live.gap !== 0 && <div className="g-muted text-xs font-normal">± {qty(live.allowed)}</div>}
                  </td>
                  <td className="text-sm">
                    {s.state === "saving" ? (
                      <span className="g-muted">{t.common.saving}</span>
                    ) : s.state === "error" ? (
                      <span className="text-[var(--g-bad)]" role="alert">
                        {s.error}
                      </span>
                    ) : s.value !== "" ? (
                      <span className="text-[var(--g-good)]">{fill(t.control.savedAt, { time: s.at ?? "" })}</span>
                    ) : (
                      <span className="g-muted">{t.control.notCounted}</span>
                    )}
                  </td>
                </tr>,
              );
              return out;
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
