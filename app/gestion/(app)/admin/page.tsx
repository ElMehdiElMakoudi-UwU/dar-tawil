import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/gestion/auth";
import { addDays, combineBilans, daysBetween } from "@/lib/gestion/bilan";
import { dateLabel, dayLabel, mad, monthOf, monthRange, pct, qty, shiftMonth, today } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { getBilanHistory, getBilanLines, getBilanPeriods, getPeriodCharges } from "@/lib/gestion/queries";
import { Empty, Field, PageHeader, Section, Stat } from "../../_components/ui";
import { BreakEvenChart, HBars, Meter, PeriodColumns, Waterfall } from "./charts";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.dashboard };
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const signedPct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

/**
 * The owner's dashboard, built on the period reports (Bilan de période):
 * what the counts say went out, against the expenses and payroll dated in
 * the same range — not on the till or the sales typed in. Any range can be
 * picked; the saved bilans that fall in it are combined (see lib/gestion/bilan).
 */
export default async function DashboardPage({ searchParams }: PageProps<"/gestion/admin">) {
  await requireAdmin();
  const sp = await searchParams;
  const [periods, lang, t] = await Promise.all([getBilanPeriods(), getLang(), getT()]);

  if (!periods.length) {
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

  // Any ?from=&to= range; with none, the latest saved bilan.
  let from = isDate(sp.from) ? sp.from : periods[0].from;
  let to = isDate(sp.to) ? sp.to : periods[0].to;
  if (to < from) [from, to] = [to, from];
  const days = daysBetween(from, to);
  // The same number of days just before, for the deltas.
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(from, -days);

  const [lines, charges, prevCharges, history] = await Promise.all([
    getBilanLines(prevFrom, to),
    getPeriodCharges(from, to),
    getPeriodCharges(prevFrom, prevTo),
    getBilanHistory(24),
  ]);

  /* ── the numbers ─────────────────────────────────────────────── */

  const c = combineBilans(lines, from, to);
  const p = combineBilans(lines, prevFrom, prevTo);

  const revenue = c.revenue;
  const cogs = c.cogs;
  const margin = revenue - cogs;
  const rate = revenue > 0 ? margin / revenue : 0;
  const expenses = charges.byExpense.reduce((s, r) => s + r.amount, 0);
  const fixed = expenses + charges.payroll;
  const net = margin - fixed;

  const breakEven = rate > 0 ? fixed / rate : null;
  const safety = breakEven != null ? revenue - breakEven : null;
  // Assuming sales come in evenly: the day the range's sales passed the break-even.
  const breakEvenDay = breakEven != null && revenue > 0 && breakEven <= revenue ? addDays(from, Math.max(0, Math.ceil((breakEven / revenue) * days) - 1)) : null;

  const stockStart = c.stockStart;
  const stockEnd = c.stockEnd;
  const avgStock = (stockStart + stockEnd) / 2;
  const rotation = avgStock > 0 ? cogs / avgStock : null;
  const leverage = net > 0 ? margin / net : null;

  // Deltas against the same number of days just before, only when bilans
  // cover that stretch about as well as this one (else the % means nothing).
  const prev = p.covered > 0 && p.covered / days >= c.covered / days - 0.1 ? { revenue: p.revenue, net: p.revenue - p.cogs - prevCharges.byExpense.reduce((s, r) => s + r.amount, 0) - prevCharges.payroll } : null;
  const delta = (now: number, before: number | null | undefined) =>
    before == null || before === 0 ? undefined : fill(t.bilan.vsPrev, { delta: signedPct((now - before) / Math.abs(before)), n: days });

  const periodLabel = (f: string, tt: string) => `${dayLabel(f, lang)} – ${dayLabel(tt, lang)}`;
  const usedKeys = new Set(c.bilans.map((b) => `${b.from}_${b.to}`));
  const trend = history.slice(-8).map((h) => ({
    label: periodLabel(h.from, h.to),
    revenue: h.revenue,
    net: h.revenue - h.cogs - h.expenses - h.payroll,
    current: usedKeys.has(`${h.from}_${h.to}`),
  }));

  const counted = [...c.products].sort((a, b) => b.margin - a.margin);
  const productBars = counted.map((r) => ({ label: r.name, value: r.margin, note: `${qty(r.out)} ${r.unit}` })).slice(0, 12);
  const chargeBars = [...charges.byExpense.map((r) => ({ label: r.label, value: r.amount })), ...(charges.payroll ? [{ label: t.bilan.payrollLabel, value: charges.payroll }] : [])].sort(
    (a, b) => b.value - a.value,
  );

  let pointMort: string;
  if (fixed === 0) pointMort = t.bilan.noCharges;
  else if (breakEven == null) pointMort = t.bilan.noMargin;
  else if (breakEvenDay) pointMort = fill(t.bilan.reachedOn, { date: dateLabel(breakEvenDay, lang) });
  else pointMort = fill(t.bilan.notReached, { amount: mad(breakEven - revenue) });

  // Quick picks: calendar ranges, then the latest saved bilans.
  const month = monthOf();
  const lastMonth = monthRange(shiftMonth(month, -1));
  const presets = [
    { label: t.bilan.thisMonth, from: monthRange(month).from, to: today() },
    { label: t.bilan.lastMonth, from: lastMonth.from, to: lastMonth.to },
    { label: t.bilan.last3Months, from: monthRange(shiftMonth(month, -2)).from, to: today() },
    { label: t.bilan.thisYear, from: `${today().slice(0, 4)}-01-01`, to: today() },
  ];
  const href = (f: string, tt: string) => `/gestion/admin?from=${f}&to=${tt}`;
  const isCurrent = (f: string, tt: string) => f === from && tt === to;
  const coverage = c.covered / days;

  return (
    <>
      <PageHeader title={t.nav.dashboard} sub={t.bilan.sub} />

      <div className="g-panel mb-6 space-y-3">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label={t.period.from}>
            <input type="date" name="from" defaultValue={from} className="g-input" required />
          </Field>
          <Field label={t.period.to}>
            <input type="date" name="to" defaultValue={to} className="g-input" required />
          </Field>
          <button type="submit" className="g-btn">
            {t.period.show}
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {presets.map((r) => (
            <Link key={r.label} href={href(r.from, r.to)} className={`g-btn g-btn-sm ${isCurrent(r.from, r.to) ? "" : "g-btn-ghost"}`}>
              {r.label}
            </Link>
          ))}
          <span className="g-muted ms-2 me-1 text-xs">{t.bilan.savedBilans}</span>
          {periods.slice(0, 4).map((b) => (
            <Link key={`${b.from}_${b.to}`} href={href(b.from, b.to)} className={`g-btn g-btn-sm ${isCurrent(b.from, b.to) ? "" : "g-btn-ghost"}`}>
              {periodLabel(b.from, b.to)}
            </Link>
          ))}
        </div>
      </div>

      <div className="g-muted mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-[var(--color-ivoire)]">
          {dateLabel(from, lang)} – {dateLabel(to, lang)}
        </span>
        <span>{fill(t.bilan.days, { n: days })}</span>
        <span>{fill(t.bilan.coverage, { covered: c.covered, days, n: c.bilans.length })}</span>
      </div>
      {c.gaps.length > 0 && (
        <p className="g-panel mb-4 text-sm">
          {c.covered === 0 ? t.bilan.noCoverage : fill(t.bilan.gaps, { pct: pct(1 - coverage) })}{" "}
          <span className="g-muted">{c.gaps.map((g) => (g.from === g.to ? dayLabel(g.from, lang) : periodLabel(g.from, g.to))).join(" · ")}</span>{" "}
          <Link href={`/gestion/admin/period?from=${c.gaps[0].from}&to=${c.gaps[0].to}`} className="underline underline-offset-4">
            {t.bilan.fillGap}
          </Link>
        </p>
      )}

      {/* Headline figures. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`${t.bilan.kpiRevenue} (${t.cur})`} value={mad(revenue)} note={delta(revenue, prev?.revenue)} />
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
              {delta(net, prev?.net) && <span className="block">{delta(net, prev?.net)}</span>}
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

      <Section title={t.bilan.usedTitle}>
        {c.bilans.length ? (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.bilan.colPeriod}</th>
                  <th className="num">{t.bilan.colDays}</th>
                  <th className="num">{t.bilan.colShare}</th>
                  <th className="num">{t.bilan.colProducts}</th>
                  <th className="num">{t.period.revenue}</th>
                  <th className="num">{t.period.earned}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {c.bilans.map((b) => (
                  <tr key={`${b.from}_${b.to}`}>
                    <td className="whitespace-nowrap">
                      {dateLabel(b.from, lang)} – {dateLabel(b.to, lang)}
                    </td>
                    <td className="num">
                      {b.used} / {b.days}
                    </td>
                    <td className="num">{pct(b.share)}</td>
                    <td className="num">{b.products}</td>
                    <td className="num">{mad(b.revenue)}</td>
                    <td className={`num ${b.revenue - b.cogs < 0 ? "g-neg" : ""}`}>{mad(b.revenue - b.cogs)}</td>
                    <td className="text-end">
                      <Link href={`/gestion/admin/period?from=${b.from}&to=${b.to}`} className="g-btn g-btn-ghost g-btn-sm">
                        {t.bilan.openBilan}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t.common.total}</td>
                  <td className="num">
                    {c.covered} / {days}
                  </td>
                  <td />
                  <td />
                  <td className="num">{mad(revenue)}</td>
                  <td className="num">{mad(margin)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <Empty>{t.bilan.noCoverage}</Empty>
        )}
        <p className="g-muted mt-2 text-xs">{t.bilan.usedNote}</p>
      </Section>

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
                    {counted.map((r) => (
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
