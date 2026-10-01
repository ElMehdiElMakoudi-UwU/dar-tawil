import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/gestion/auth";
import { mad, parseMonth } from "@/lib/gestion/format";
import { getSales } from "@/lib/gestion/queries";
import { getT } from "@/lib/gestion/lang";
import { Empty, MonthNav, PageHeader, Stat } from "../../_components/ui";
import { OrdersTable } from "./orders-table";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.sales };
}

export default async function SalesPage({ searchParams }: PageProps<"/gestion/sales">) {
  const user = await requireUser();
  const t = await getT();
  const month = parseMonth((await searchParams).month);
  const rows = await getSales(month);
  const isAdmin = user.role === "admin";

  const revenue = rows.reduce((s, r) => s + r.total, 0);
  // Less what came in on those sales already (deposits), counted once per sale.
  const unpaidSales = new Map<string, { total: number; received: number }>();
  for (const r of rows.filter((r) => !r.paid)) {
    const o = unpaidSales.get(r.order_no) ?? { total: 0, received: r.received };
    o.total += r.total;
    unpaidSales.set(r.order_no, o);
  }
  const unpaid = [...unpaidSales.values()].reduce((s, o) => s + Math.max(o.total - o.received, 0), 0);
  const profit = rows.reduce((s, r) => s + (r.profit ?? 0), 0);

  return (
    <>
      <PageHeader title={t.nav.sales}>
        <MonthNav month={month} path="/gestion/sales" />
        <Link href="/gestion/sales/new" className="g-btn">
          {t.common.newSaleBtn}
        </Link>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.common.revenueMad} value={mad(revenue)} />
        <Stat label={t.common.orders} value={new Set(rows.map((r) => r.order_no)).size} />
        <Stat label={t.sales.unpaidMad} value={mad(unpaid)} tone={unpaid > 0 ? "bad" : undefined} />
        {isAdmin && <Stat label={t.common.grossProfitMad} value={mad(profit)} tone={profit < 0 ? "bad" : "good"} />}
      </div>

      {rows.length ? <OrdersTable rows={rows} isAdmin={isAdmin} /> : <Empty>{t.sales.noSales}</Empty>}
    </>
  );
}
