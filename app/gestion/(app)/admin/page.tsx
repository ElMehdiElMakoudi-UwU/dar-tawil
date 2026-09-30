import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/gestion/auth";
import { mad, monthName, pct, qty, today } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { getDashboard } from "@/lib/gestion/queries";
import { Empty, PageHeader, Section, Stat } from "../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.dashboard };
}

export default async function DashboardPage({ searchParams }: PageProps<"/gestion/admin">) {
  await requireAdmin();
  const raw = Number((await searchParams).year);
  const thisYear = Number(today().slice(0, 4));
  const year = Number.isInteger(raw) && raw > 2000 && raw < 2100 ? raw : thisYear;
  const [d, lang, t] = await Promise.all([getDashboard(year), getLang(), getT()]);

  const sum = (k: "revenue" | "cogs" | "expenses" | "payroll" | "items") => d.months.reduce((s, m) => s + m[k], 0);
  const revenue = sum("revenue");
  const gross = revenue - sum("cogs");
  const costs = sum("expenses") + sum("payroll");
  const net = gross - costs;
  const items = sum("items");

  return (
    <>
      <PageHeader title={t.nav.dashboard} sub={t.dash.sub}>
        <nav className="flex flex-wrap gap-1" aria-label={t.common.year}>
          {d.years.map((y) => (
            <Link
              key={y}
              href={`/gestion/admin?year=${y}`}
              className={`g-btn g-btn-sm ${y === year ? "" : "g-btn-ghost"}`}
              aria-current={y === year ? "page" : undefined}
            >
              {y}
            </Link>
          ))}
        </nav>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label={t.common.revenueMad} value={mad(revenue)} />
        <Stat label={t.common.grossProfitMad} value={mad(gross)} note={fill(t.dash.marginNote, { pct: revenue ? pct(gross / revenue) : "—" })} />
        <Stat label={t.dash.expensesMad} value={mad(sum("expenses"))} />
        <Stat label={t.dash.payrollMad} value={mad(sum("payroll"))} />
        <Stat
          label={t.dash.netMad}
          value={mad(net)}
          tone={net < 0 ? "bad" : "good"}
          note={fill(t.dash.marginNote, { pct: revenue ? pct(net / revenue) : "—" })}
        />
        <Stat label={t.dash.itemsSold} value={qty(items)} note={items ? fill(t.dash.avgPerItem, { amount: mad(revenue / items) }) : undefined} />
      </div>

      <Section title={t.dash.rightNow}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t.common.stockValueMad} value={mad(d.now.stock_value)} />
          <Stat label={t.dash.customersOwe} value={mad(d.now.customers_owe)} tone={d.now.customers_owe > 0 ? "bad" : undefined} />
          <Stat label={t.dash.oweSuppliers} value={mad(d.now.owe_suppliers)} tone={d.now.owe_suppliers > 0 ? "bad" : undefined} />
          <Stat label={t.common.toReorder} value={d.now.to_reorder} tone={d.now.to_reorder ? "bad" : undefined} />
        </div>
      </Section>

      <Section title={fill(t.dash.byMonth, { year })}>
        <div className="g-table-wrap">
          <table className="g-table">
            <thead>
              <tr>
                <th>{t.common.month}</th>
                <th className="num">{t.common.revenue}</th>
                <th className="num">{t.dash.cogs}</th>
                <th className="num">{t.dash.grossProfit}</th>
                <th className="num">{t.dash.expenses}</th>
                <th className="num">{t.dash.payroll}</th>
                <th className="num">{t.dash.netProfit}</th>
                <th className="num">{t.dash.items}</th>
              </tr>
            </thead>
            <tbody>
              {d.months.map((m) => {
                const mNet = m.revenue - m.cogs - m.expenses - m.payroll;
                const empty = !m.revenue && !m.expenses && !m.payroll;
                return (
                  <tr key={m.m} className={empty ? "g-muted" : ""}>
                    <td>{monthName(m.m, lang)}</td>
                    <td className="num">{mad(m.revenue)}</td>
                    <td className="num">{mad(m.cogs)}</td>
                    <td className="num">{mad(m.revenue - m.cogs)}</td>
                    <td className="num">{mad(m.expenses)}</td>
                    <td className="num">{mad(m.payroll)}</td>
                    <td className={`num font-medium ${mNet < 0 ? "g-neg" : ""}`}>{mad(mNet)}</td>
                    <td className="num">{qty(m.items)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>{t.common.total}</td>
                <td className="num">{mad(revenue)}</td>
                <td className="num">{mad(sum("cogs"))}</td>
                <td className="num">{mad(gross)}</td>
                <td className="num">{mad(sum("expenses"))}</td>
                <td className="num">{mad(sum("payroll"))}</td>
                <td className={`num ${net < 0 ? "g-neg" : ""}`}>{mad(net)}</td>
                <td className="num">{qty(items)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      <div className="grid gap-x-6 lg:grid-cols-3">
        <Breakdown title={t.dash.byChannel} rows={d.byChannel} />
        <Breakdown title={t.dash.byCategory} rows={d.byCategory} />
        <Breakdown title={t.dash.expByCategory} rows={d.byExpense} />
      </div>

      <Section title={t.dash.bestSellers}>
        {d.topProducts.length ? (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.common.product}</th>
                  <th className="num">{t.common.qty}</th>
                  <th className="num">{t.common.revenue}</th>
                  <th className="num">{t.common.profit}</th>
                  <th className="num">{t.common.margin}</th>
                </tr>
              </thead>
              <tbody>
                {d.topProducts.map((p) => (
                  <tr key={p.label}>
                    <td>{p.label}</td>
                    <td className="num">
                      {qty(p.qty)} <span className="g-muted text-xs">{p.unit}</span>
                    </td>
                    <td className="num">{mad(p.revenue)}</td>
                    <td className={`num ${p.profit < 0 ? "g-neg" : ""}`}>{mad(p.profit)}</td>
                    <td className="num">{p.revenue ? pct(p.profit / p.revenue) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{fill(t.dash.noSalesIn, { year })}</Empty>
        )}
      </Section>
    </>
  );
}

/** Amount and share per label, with a one-colour bar for the share. */
async function Breakdown({ title, rows }: { title: string; rows: { label: string; amount: number }[] }) {
  const t = await getT();
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <Section title={title}>
      {rows.length ? (
        <ul className="g-card space-y-3">
          {rows.map((r) => {
            const share = total ? r.amount / total : 0;
            return (
              <li key={r.label} title={`${r.label}: ${mad(r.amount)} ${t.cur} (${pct(share)})`}>
                <div className="flex justify-between gap-2 text-sm">
                  <span>{r.label}</span>
                  <span className="tabular-nums">
                    {mad(r.amount)} <span className="g-muted text-xs">{pct(share)}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[var(--color-brou-clair)]">
                  <div className="h-full rounded-full bg-[var(--color-or)]" style={{ width: `${share * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>{t.common.nothingYet}</Empty>
      )}
    </Section>
  );
}
