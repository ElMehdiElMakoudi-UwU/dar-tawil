import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/gestion/auth";
import { evaluate } from "@/lib/gestion/control";
import { getControl, getControlLines, getProductGapHistory, getProductMovements } from "@/lib/gestion/controls";
import { dateLabel, mad, qty, stampLabel } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { Empty, PageHeader, Section, Stat } from "../../../../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).control.detailTitle };
}

const signed = (n: number) => `${n > 0 ? "+" : ""}${qty(n)}`;

/**
 * Where a gap comes from: everything recorded for the product between the
 * start and the count, with who recorded it, and how it did in past controls.
 */
export default async function ControlProductPage({ params }: PageProps<"/gestion/stock-control/[id]/product/[productId]">) {
  await requireAdmin();
  const p = await params;
  const controlId = Number(p.id);
  const productId = Number(p.productId);
  if (!Number.isInteger(controlId) || !Number.isInteger(productId)) notFound();
  const control = await getControl(controlId);
  if (!control) notFound();
  const [lines, movements, history, lang, t] = await Promise.all([
    getControlLines(controlId),
    getProductMovements(controlId, productId),
    getProductGapHistory(productId),
    getLang(),
    getT(),
  ]);
  const line = lines.find((l) => l.product_id === productId);
  if (!line) notFound();
  const e = evaluate(line);
  const sum = Math.round(movements.reduce((s, m) => s + m.qty, 0) * 1000) / 1000;
  const mismatch = e ? Math.round((e.moved - sum) * 1000) / 1000 : 0;
  const past = history.filter((h) => h.control_id !== controlId);

  return (
    <>
      <PageHeader title={line.name} sub={`${control.label} · ${line.sku} · ${line.unit}`}>
        <Link href={`/gestion/stock-control/${controlId}`} className="g-btn g-btn-ghost g-btn-sm">
          {t.control.backToResults}
        </Link>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.control.startCount} value={qty(line.start_qty)} note={fill(t.control.startedOn, { date: dateLabel(control.start_date, lang) })} />
        <Stat label={t.control.expected} value={e ? qty(e.expected) : "—"} note={e ? fill(t.control.movedNote, { qty: signed(e.moved) }) : undefined} />
        <Stat
          label={t.control.counted}
          value={qty(line.counted_qty)}
          note={line.counted_at ? fill(t.control.countedBy, { time: stampLabel(line.counted_at, lang), name: line.counted_by ?? "—" }) : t.control.notCounted}
        />
        <Stat
          label={t.control.gap}
          value={e ? signed(e.gap) : "—"}
          tone={e?.flagged ? "bad" : e ? "good" : undefined}
          note={e ? `${mad(e.atCost)} ${t.cur} · ± ${qty(e.allowed)}` : undefined}
        />
      </div>

      {line.manual_counts !== 0 && (
        <p className="g-panel mb-4 text-sm">
          <span className="g-badge g-badge-warn me-2">{fill(t.control.manualCounts, { qty: signed(line.manual_counts) })}</span>
          {t.control.manualCountsHint}
        </p>
      )}

      <Section title={t.control.movementsTitle} aside={<span className="g-muted text-sm">{t.control.movementsSub}</span>}>
        {movements.length ? (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.control.when}</th>
                  <th>{t.common.type}</th>
                  <th>{t.control.ref}</th>
                  <th>{t.common.description}</th>
                  <th>{t.control.by}</th>
                  <th className="num">{t.common.qty}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap tabular-nums">{stampLabel(m.at, lang)}</td>
                    <td>{t.control.kinds[m.kind]}</td>
                    <td>
                      {m.kind === "sale" || m.kind === "return" ? (
                        <Link href={`/gestion/sales/${m.ref}`} className="underline underline-offset-4">
                          {m.ref}
                        </Link>
                      ) : m.kind === "delivery" ? (
                        <Link href={`/gestion/admin/purchases/${m.ref_id}`} className="underline underline-offset-4">
                          {m.ref ?? `#${m.ref_id}`}
                        </Link>
                      ) : (
                        (t.adjust.reasons[m.ref ?? ""] ?? m.ref)
                      )}
                    </td>
                    <td>{m.detail ?? "—"}</td>
                    <td>{m.by ?? "—"}</td>
                    <td className={`num tabular-nums ${m.qty < 0 ? "g-neg" : ""}`} dir="ltr">
                      {signed(m.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>{t.common.total}</td>
                  <td className="num" dir="ltr">
                    {signed(sum)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <Empty>{t.control.noMovements}</Empty>
        )}
        {mismatch !== 0 && <p className="mt-3 text-sm text-[var(--g-bad)]">{fill(t.control.mismatch, { qty: signed(mismatch) })}</p>}
      </Section>

      <Section title={t.control.historyTitle}>
        {past.length ? (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.control.control}</th>
                  <th>{t.common.date}</th>
                  <th className="num">{t.control.expected}</th>
                  <th className="num">{t.control.counted}</th>
                  <th className="num">{t.control.gap}</th>
                  <th className="num">{t.control.gapCostShort}</th>
                  <th>{t.control.finding}</th>
                </tr>
              </thead>
              <tbody>
                {past.map((h) => (
                  <tr key={h.control_id} className={h.flagged ? "g-row-flag" : undefined}>
                    <td>
                      <Link href={`/gestion/stock-control/${h.control_id}`} className="underline underline-offset-4">
                        {h.label}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{dateLabel(h.date, lang)}</td>
                    <td className="num tabular-nums">{qty(h.expected)}</td>
                    <td className="num tabular-nums">{qty(h.counted)}</td>
                    <td className={`num tabular-nums ${h.gap < 0 ? "g-neg" : ""}`} dir="ltr">
                      {h.gap === 0 ? "✓" : signed(h.gap)}
                    </td>
                    <td className={`num tabular-nums ${h.at_cost < 0 ? "g-neg" : ""}`}>{mad(h.at_cost)}</td>
                    <td>
                      {h.reason ? t.control.reasons[h.reason] : "—"}
                      {h.note && <div className="g-muted text-xs">{h.note}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t.control.noHistory}</Empty>
        )}
      </Section>
    </>
  );
}
