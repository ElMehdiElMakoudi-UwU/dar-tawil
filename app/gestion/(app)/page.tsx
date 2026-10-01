import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/gestion/auth";
import { dateLabel, mad, monthOf, qty, today } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { getOpenOrders, getProducts, getSales, getTodaySummary } from "@/lib/gestion/queries";
import { Empty, PageHeader, Section, Stat } from "../_components/ui";
import { OrderCard } from "./orders/order-card";
import { OrdersTable } from "./sales/orders-table";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.today };
}

export default async function TodayPage() {
  const user = await requireUser();
  const [lang, t] = await Promise.all([getLang(), getT()]);
  const day = today();
  const [summary, sales, products, open] = await Promise.all([
    getTodaySummary(),
    getSales(monthOf(day)),
    getProducts({ activeOnly: true }),
    getOpenOrders(),
  ]);
  const todays = sales.filter((s) => s.date === day);
  const low = products.filter((p) => p.in_stock <= p.reorder_level);
  // Includes late ones: still to be handed over.
  const dueOrders = open.filter((o) => o.due_date <= day);

  return (
    <>
      <PageHeader title={fill(t.today.hello, { name: user.name.split(" ")[0] })} sub={dateLabel(day, lang)}>
        <Link href="/gestion/sales/new" className="g-btn">
          {t.common.newSaleBtn}
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.today.salesToday} value={`${mad(summary.total)}`} note={t.cur} />
        <Stat label={t.common.orders} value={summary.orders} note={fill(t.today.lines, { n: summary.lines })} />
        <Stat label={t.today.unpaidToday} value={mad(summary.unpaid)} tone={summary.unpaid > 0 ? "bad" : undefined} note={t.cur} />
        <Stat label={t.common.toReorder} value={low.length} tone={low.length ? "bad" : undefined} />
      </div>

      {dueOrders.length > 0 && (
        <Section
          title={t.prep.todayTitle}
          aside={
            <Link href="/gestion/orders" className="text-sm underline-offset-2 hover:underline">
              {t.prep.seeAll}
            </Link>
          }
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {dueOrders.map((o) => (
              <OrderCard key={o.id} o={o} late={o.due_date < day} isAdmin={user.role === "admin"} />
            ))}
          </div>
        </Section>
      )}

      <Section title={t.today.todaysOrders}>
        {todays.length ? <OrdersTable rows={todays} isAdmin={user.role === "admin"} /> : <Empty>{t.today.noSales}</Empty>}
      </Section>

      {low.length > 0 && (
        <Section title={t.today.runningLow}>
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.common.product}</th>
                  <th className="num">{t.common.inStock}</th>
                  <th className="num">{t.common.reorderAt}</th>
                </tr>
              </thead>
              <tbody>
                {low.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name} <span className="g-muted">· {p.sku}</span>
                    </td>
                    <td className="num g-neg">{qty(p.in_stock)}</td>
                    <td className="num">{qty(p.reorder_level)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
}
