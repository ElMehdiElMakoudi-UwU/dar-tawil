import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/gestion/auth";
import { dateLabel, dayLabel, mad, pct, qty } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { getBilanHistory, getBilanPeriods, getPeriodCharges, getPeriodReport } from "@/lib/gestion/queries";
import { Empty, PageHeader, Section, Stat } from "../../_components/ui";
import { BreakEvenChart, HBars, Meter, PeriodColumns, Waterfall } from "./charts";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.dashboard };
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);
const signedPct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

/**
 * The owner's dashboard, built on the period reports (Bilan de période):
 * what the counts say went out, against the expenses and payroll dated in
 * the same period — not on the till or the sales typed in.
 */
export default async function DashboardPage({ searchParams }: PageProps<"/gestion/admin">) {
  await requireAdmin();
  const sp = await searchParams;
  const [periods, lang, t] = await Promise.all([getBilanPeriods(), getLang(), getT()]);

  // ?p=from_to picks a saved bilan; ?from=&to= any period; else the latest.
  const [pFrom, pTo] = typeof sp.p === "string" ? sp.p.split("_") : [];
  let from = isDate(pFrom) ? pFrom : isDate(sp.from) ? sp.from : periods[0]?.from;
  let to = isDate(pTo) ? pTo : isDate(sp.to) ? sp.to : periods[0]?.to;

  if (!from || !to) {
    return (
      <>
        <PageHeader title={t.nav.dashboard} sub={t.bilan.sub} />
        <div className="g-panel max-w-xl">
          <h2 className="text-lg">{t.bilan.noneTitle}</h2>
          <p className="g-muted mt-2 text-sm">{t.bilan.noneText}</p>
          <Link href="/gestion/admin/period" className="g-btn mt-4">
            {t.bilan.noneBtn}
          </Link>
        </div>
      </>
    );
  }
  if (to < from) [from, to] = [to, from];

  const [rows, charges, history] = await Promise.all([getPeriodReport(from, to), getPeriodCharges(from, to), getBilanHistory(24)]);

  /* ── the numbers ─────────────────────────────────────────────── */

  const counted = rows
    .filter((r) => r.start_qty != null && r.end_qty != null)
    .map((r) => {
      const out = r.start_qty! + r.delivered - r.end_qty!;
      return { ...r, out, revenue: out * r.price, cogs: out * r.unit_cost, margin: out * (r.price - r.unit_cost) };
    });
  const missing = rows.length - counted.length;

  const revenue = counted.reduce((s, r) => s + r.revenue, 0);
  const cogs = counted.reduce((s, r) => s + r.cogs, 0);
  const margin = revenue - cogs;
  const rate = revenue > 0 ? margin / revenue : 0;
  const expenses = charges.byExpense.reduce((s, r) => s + r.amount, 0);
  const fixed = expenses + charges.payroll;
  const net = margin - fixed;

  const breakEven = rate > 0 ? fixed / rate : null;
  const safety = breakEven != null ? revenue - breakEven : null;
  const days = daysBetween(from, to);
  // Assuming sales come in evenly: the day the period's sales passed the break-even.
  const breakEvenDay = breakEven != null && revenue > 0 && breakEven <= revenue ? addDays(from, Math.max(0, Math.ceil((breakEven / revenue) * days) - 1)) : null;

  const stockStart = counted.reduce((s, r) => s + r.start_qty! * r.unit_cost, 0);
  const stockEnd = counted.reduce((s, r) => s + r.end_qty! * r.unit_cost, 0);
  const avgStock = (stockStart + stockEnd) / 2;
  const rotation = avgStock > 0 ? cogs / avgStock : null;
  const leverage = net > 0 ? margin / net : null;

  // The bilan just before this one, for the deltas.
  const idx = history.findIndex((h) => h.from === from && h.to === to);
  const prev = idx > 0 ? history[idx - 1] : null;
  const prevNet = prev ? prev.revenue - prev.cogs - prev.expenses - prev.payroll : null;
  const delta = (now: number, before: number | null) =>
    before == null || before === 0 ? undefined : fill(t.bilan.vsPrev, { delta: signedPct((now - before) / Math.abs(before)) });

  const periodLabel = (f: string, tt: string) => `${dayLabel(f, lang)} – ${dayLabel(tt, lang)}`;
  const trend = history.slice(-8).map((h) => ({
    label: periodLabel(h.from, h.to),
    revenue: h.revenue,
    net: h.revenue - h.cogs - h.expenses - h.payroll,
    current: h.from === from && h.to === to,
  }));

  const productBars = counted
    .map((r) => ({ label: r.name, value: r.margin, note: `${qty(r.out)} ${r.unit}` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
  const chargeBars = [...charges.byExpense.map((r) => ({ label: r.label, value: r.amount })), ...(charges.payroll ? [{ label: t.bilan.payrollLabel, value: charges.payroll }] : [])].sort(
    (a, b) => b.value - a.value,
  );

  let pointMort: string;
  if (fixed === 0) pointMort = t.bilan.noCharges;
  else if (breakEven == null) pointMort = t.bilan.noMargin;
  else if (breakEvenDay) pointMort = fill(t.bilan.reachedOn, { date: dateLabel(breakEvenDay, lang) });
  else pointMort = fill(t.bilan.notReached, { amount: mad(breakEven - revenue) });

  const selected = `${from}_${to}`;
  const known = periods.some((p) => `${p.from}_${p.to}` === selected);

  return (
    <>
      <PageHeader title={t.nav.dashboard} sub={t.bilan.sub}>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="bilan-p">
            {t.bilan.period}
          </label>
          <select id="bilan-p" name="p" defaultValue={selected} className="g-input w-auto">
            {!known && <option value={selected}>{periodLabel(from, to)}</option>}
            {periods.map((p) => (
              <option key={`${p.from}_${p.to}`} value={`${p.from}_${p.to}`}>
                {dateLabel(p.from, lang)} – {dateLabel(p.to, lang)}
              </option>
            ))}
          </select>
          <button className="g-btn g-btn-sm">{t.bilan.pick}</button>
        </form>
      </PageHeader>

      <div className="g-muted mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-[var(--color-ivoire)]">
          {dateLabel(from, lang)} – {dateLabel(to, lang)}
        </span>
        <span>{fill(t.bilan.days, { n: days })}</span>
        <span>{fill(t.bilan.counted, { n: counted.length, total: rows.length })}</span>
        <Link href={`/gestion/admin/period?from=${from}&to=${to}`} className="underline underline-offset-4">
          {t.bilan.openBilan}
        </Link>
      </div>
      {missing > 0 && <p className="g-panel mb-4 text-sm">{fill(t.bilan.partial, { n: missing })}</p>}

      {/* Headline figures. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`${t.bilan.kpiRevenue} (${t.cur})`} value={mad(revenue)} note={delta(revenue, prev?.revenue ?? null)} />
        <Stat label={`${t.bilan.kpiMargin} (${t.cur})`} value={mad(margin)} note={fill(t.bilan.kpiMarginNote, { pct: revenue ? pct(rate) : "—" })} />
        <Stat
          label={`${t.bilan.kpiFixed} (${t.cur})`}
          value={mad(fixed)}
          note={fill(t.bilan.kpiFixedNote, { exp: mad(expenses), pay: mad(charges.payroll) })}
        />
        <Stat
          label={`${t.bilan.kpiNet} (${t.cur})`}
          value={mad(net)}
          tone={net < 0 ? "bad" : net > 0 ? "good" : undefined}
          note={
            <>
              {fill(t.bilan.kpiNetNote, { pct: revenue ? pct(net / revenue) : "—" })}
              {delta(net, prevNet) && <span className="block">{delta(net, prevNet)}</span>}
            </>
          }
        />
      </div>

      {/* Break-even block. */}
      <Section title={t.bilan.breakEvenTitle}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="space-y-3">
            <Stat label={`${t.bilan.kpiBreakEven} (${t.cur})`} value={breakEven != null ? mad(breakEven) : "—"} note={t.bilan.kpiBreakEvenNote} />
            <div className="g-card">
              <p className="g-label">{t.bilan.progressTitle}</p>
              <p className="mb-2 text-xl font-medium tabular-nums">{breakEven ? pct(revenue / breakEven) : "—"}</p>
              <Meter value={revenue} target={breakEven ?? 0} />
              <p className="g-muted mt-2 text-xs">{fill(t.bilan.progressText, { done: mad(revenue), target: breakEven != null ? mad(breakEven) : "—" })}</p>
            </div>
            <Stat
              label={`${t.bilan.kpiSafety} (${t.cur})`}
              value={safety != null ? mad(safety) : "—"}
              tone={safety != null ? (safety < 0 ? "bad" : "good") : undefined}
              note={safety != null && revenue ? fill(t.bilan.kpiSafetyNote, { pct: pct(safety / revenue) }) : undefined}
            />
            <Stat label={t.bilan.kpiPointMort} value={<span className="text-base sm:text-lg">{pointMort}</span>} />
          </div>
          <div className="g-card min-w-0 lg:col-span-2">
            <p className="g-muted mb-3 text-sm">{t.bilan.breakEvenSub}</p>
            <BreakEvenChart
              fixed={fixed}
              rate={rate}
              revenue={revenue}
              labels={{
                axis: t.bilan.axisSales,
                revenue: t.bilan.lineRevenue,
                costs: t.bilan.lineCosts,
                fixed: t.bilan.fixedLine,
                breakEven: t.bilan.markBreakEven,
                actual: t.bilan.markActual,
                net: t.bilan.kpiNet,
                cur: t.cur,
              }}
            />
          </div>
        </div>
      </Section>

      {/* Secondary KPIs. */}
      <Section title={t.bilan.moreTitle}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
          <Stat label={`${t.bilan.kpiPerDay} (${t.cur})`} value={mad(revenue / days)} note={fill(t.bilan.kpiPerDayNote, { amount: mad(net / days) })} />
          <Stat
            label={`${t.bilan.kpiDelivered} (${t.cur})`}
            value={mad(charges.purchased)}
            note={charges.purchased_unpaid > 0 ? fill(t.bilan.kpiDeliveredNote, { amount: mad(charges.purchased_unpaid) }) : undefined}
          />
          <Stat label={`${t.bilan.kpiStock} (${t.cur})`} value={mad(stockEnd)} note={fill(t.bilan.kpiStockNote, { start: mad(stockStart), end: mad(stockEnd) })} />
          <Stat label={t.bilan.kpiRotation} value={rotation != null ? `${rotation.toFixed(2)}×` : "—"} note={t.bilan.kpiRotationNote} />
          <Stat
            label={t.bilan.kpiLeverage}
            value={leverage != null ? `${leverage.toFixed(2)}×` : "—"}
            note={leverage != null ? fill(t.bilan.kpiLeverageNote, { pct: `${leverage.toFixed(1)}%` }) : undefined}
          />
          <Stat label={`${t.bilan.kpiLosses} (${t.cur})`} value={mad(charges.losses)} tone={charges.losses > 0 ? "bad" : undefined} note={t.bilan.kpiLossesNote} />
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <Section title={t.bilan.waterfallTitle}>
          <div className="g-card">
            <Waterfall
              cur={t.cur}
              steps={[
                { label: t.bilan.wfRevenue, value: revenue, kind: "total" },
                { label: t.bilan.wfCogs, value: -cogs, kind: "delta" },
                { label: t.bilan.wfMargin, value: margin, kind: "total" },
                { label: t.bilan.wfExpenses, value: -expenses, kind: "delta" },
                { label: t.bilan.wfPayroll, value: -charges.payroll, kind: "delta" },
                { label: t.bilan.wfNet, value: net, kind: "total" },
              ]}
            />
          </div>
        </Section>

        <Section title={t.bilan.historyTitle}>
          <div className="g-card">
            <p className="g-muted mb-3 text-sm">{t.bilan.historySub}</p>
            {trend.length > 1 ? (
              <PeriodColumns periods={trend} labels={{ revenue: t.bilan.lineRevenue, net: t.bilan.kpiNet }} cur={t.cur} />
            ) : (
              <p className="g-muted text-sm">{t.bilan.historyOne}</p>
            )}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <Section title={t.bilan.productsTitle}>
          <div className="g-card">
            <p className="g-muted mb-3 text-sm">{t.bilan.productsSub}</p>
            {productBars.length ? <HBars rows={productBars} cur={t.cur} /> : <p className="g-muted text-sm">{t.common.nothingYet}</p>}
            <details className="mt-4">
              <summary className="g-muted cursor-pointer text-sm">{t.bilan.tableView}</summary>
              <div className="g-table-wrap mt-3">
                <table className="g-table">
                  <thead>
                    <tr>
                      <th>{t.common.product}</th>
                      <th className="num">{t.period.out}</th>
                      <th className="num">{t.period.revenue}</th>
                      <th className="num">{t.period.cost}</th>
                      <th className="num">{t.period.earned}</th>
                      <th className="num">{t.common.margin}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...counted]
                      .sort((a, b) => b.margin - a.margin)
                      .map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td className="num">
                            {qty(r.out)} <span className="g-muted text-xs">{r.unit}</span>
                          </td>
                          <td className="num">{mad(r.revenue)}</td>
                          <td className="num">{mad(r.cogs)}</td>
                          <td className={`num ${r.margin < 0 ? "g-neg" : ""}`}>{mad(r.margin)}</td>
                          <td className="num">{r.revenue ? pct(r.margin / r.revenue) : "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </Section>

        <Section title={t.bilan.chargesTitle}>
          <div className="g-card">
            {chargeBars.length ? (
              <>
                <HBars rows={chargeBars} cur={t.cur} color="var(--g-c2)" />
                <details className="mt-4">
                  <summary className="g-muted cursor-pointer text-sm">{t.bilan.tableView}</summary>
                  <div className="g-table-wrap mt-3">
                    <table className="g-table">
                      <thead>
                        <tr>
                          <th>{t.common.category}</th>
                          <th className="num">{t.common.amountMad}</th>
                          <th className="num">{t.bilan.colShare}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chargeBars.map((c) => (
                          <tr key={c.label}>
                            <td>{c.label}</td>
                            <td className="num">{mad(c.value)}</td>
                            <td className="num">{fixed ? pct(c.value / fixed) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            ) : (
              <Empty>{t.bilan.noCharges}</Empty>
            )}
          </div>
        </Section>
      </div>

      <p className="g-muted mt-8 max-w-3xl text-xs">{t.bilan.method}</p>
    </>
  );
}
