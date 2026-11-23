import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/gestion/auth";
import { getClosedControls, getOpenControls, getRecurringGaps } from "@/lib/gestion/controls";
import { dateLabel, mad, qty } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { Empty, PageHeader, Section } from "../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.stockControl };
}

/**
 * Open controls to count (staff too), and for the admin the closed ones
 * and the products that keep coming up short.
 */
export default async function StockControlPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const [open, closed, recurring, lang, t] = await Promise.all([
    getOpenControls(),
    isAdmin ? getClosedControls() : Promise.resolve([]),
    isAdmin ? getRecurringGaps() : Promise.resolve([]),
    getLang(),
    getT(),
  ]);

  return (
    <>
      <PageHeader title={t.nav.stockControl} sub={isAdmin ? t.control.sub : t.control.subStaff}>
        {isAdmin && (
          <>
            <Link href="/gestion/stock-control/tolerances" className="g-btn g-btn-ghost g-btn-sm">
              {t.control.tolerances}
            </Link>
            <Link href="/gestion/stock-control/new" className="g-btn">
              {t.control.newBtn}
            </Link>
          </>
        )}
      </PageHeader>

      <Section title={t.control.openTitle}>
        {open.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {open.map((c) => (
              <div key={c.id} className="g-card">
                <p className="font-medium">{c.label}</p>
                <p className="g-muted text-xs">{fill(t.control.startedOn, { date: dateLabel(c.start_date, lang) })}</p>
                <p className="mt-2 text-sm">{fill(t.control.progress, { n: c.counted, total: c.lines })}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-brou-clair)]">
                  <div className="h-full bg-[var(--color-or)]" style={{ width: `${c.lines ? (100 * c.counted) / c.lines : 0}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/gestion/stock-control/${c.id}/count`} className="g-btn g-btn-sm">
                    {t.control.countBtn}
                  </Link>
                  {isAdmin && (
                    <Link href={`/gestion/stock-control/${c.id}`} className="g-btn g-btn-ghost g-btn-sm">
                      {t.control.resultsBtn}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>{isAdmin ? t.control.noOpen : t.control.noOpenStaff}</Empty>
        )}
      </Section>

      {isAdmin && recurring.length > 0 && (
        <Section title={t.control.recurringTitle}>
          <p className="g-muted mb-3 text-sm">{t.control.recurringSub}</p>
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.common.product}</th>
                  <th className="num">{t.control.timesOffCol}</th>
                  <th className="num">{t.control.totalGap}</th>
                  <th className="num">{t.control.gapCost}</th>
                </tr>
              </thead>
              <tbody>
                {recurring.map((r) => (
                  <tr key={r.product_id}>
                    <td>
                      {r.name}
                      <div className="g-muted text-xs">{r.sku}</div>
                    </td>
                    <td className="num">{fill(t.control.timesOff, { n: r.flagged, of: r.counted })}</td>
                    <td className={`num tabular-nums ${r.gap < 0 ? "g-neg" : ""}`} dir="ltr">
                      {r.gap > 0 ? "+" : ""}
                      {qty(r.gap)} <span className="g-muted text-xs">{r.unit}</span>
                    </td>
                    <td className={`num tabular-nums ${r.at_cost < 0 ? "g-neg" : ""}`}>{mad(r.at_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {isAdmin && (
        <Section title={t.control.closedTitle}>
          {closed.length ? (
            <div className="g-table-wrap">
              <table className="g-table">
                <thead>
                  <tr>
                    <th>{t.control.control}</th>
                    <th>{t.control.period}</th>
                    <th className="num">{t.control.countedCol}</th>
                    <th className="num">{t.control.flaggedCol}</th>
                    <th className="num">{t.control.gapCost}</th>
                    <th className="num">{t.control.missingPrice}</th>
                    <th>{t.control.stockCorrected}</th>
                  </tr>
                </thead>
                <tbody>
                  {closed.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/gestion/stock-control/${c.id}`} className="underline underline-offset-4">
                          {c.label}
                        </Link>
                        <div className="g-muted text-xs">{c.closed_by ?? "—"}</div>
                      </td>
                      <td className="whitespace-nowrap">
                        {dateLabel(c.start_date, lang)} → {c.closed_at ? dateLabel(c.closed_at.slice(0, 10), lang) : "—"}
                      </td>
                      <td className="num">
                        {c.counted} / {c.lines}
                      </td>
                      <td className="num">
                        <span className={`g-badge ${c.flagged ? "g-badge-bad" : "g-badge-good"}`}>{c.flagged}</span>
                      </td>
                      <td className={`num tabular-nums ${c.net_cost < 0 ? "g-neg" : ""}`}>{mad(c.net_cost)}</td>
                      <td className={`num tabular-nums ${c.missing_price < 0 ? "g-neg" : ""}`}>{mad(c.missing_price)}</td>
                      <td>{c.corrected ? t.control.yes : t.control.no}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>{t.control.noClosed}</Empty>
          )}
          <p className="g-muted mt-4 text-xs">{t.control.method}</p>
        </Section>
      )}
    </>
  );
}
