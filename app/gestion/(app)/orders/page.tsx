import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/gestion/auth";
import { nextDay, parseMonth, today, weekdayLabel } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { getClosedOrders, getOpenOrders, openStatuses, type Order, type OrderStatus } from "@/lib/gestion/queries";
import { Empty, MonthNav, PageHeader, Section, Stat } from "../../_components/ui";
import { OrderCard } from "./order-card";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.orders };
}

/** ?show= one open status, "done" for delivered and cancelled, or nothing for everything still open. */
export default async function OrdersPage({ searchParams }: PageProps<"/gestion/orders">) {
  const user = await requireUser();
  const [lang, t] = await Promise.all([getLang(), getT()]);
  const params = await searchParams;
  const show = typeof params.show === "string" ? params.show : "";
  const done = show === "done";
  const only = openStatuses.find((s) => s === show);
  const month = parseMonth(params.month);
  const isAdmin = user.role === "admin";

  const open = await getOpenOrders();
  const day = today();
  const count = (s: OrderStatus) => open.filter((o) => o.status === s).length;
  const late = open.filter((o) => o.due_date < day);
  const dueToday = open.filter((o) => o.due_date <= day).length;

  const chips = [
    { key: "", label: t.prep.filterActive, n: open.length },
    ...openStatuses.map((s) => ({ key: s, label: t.prep.statuses[s], n: count(s) })),
    { key: "done", label: t.prep.filterDone, n: null },
  ];

  return (
    <>
      <PageHeader title={t.nav.orders} sub={t.prep.sub}>
        <Link href="/gestion/orders/new" className="g-btn">
          {t.prep.newBtn}
        </Link>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.prep.toPrepare} value={count("new") + count("preparing")} />
        <Stat label={t.prep.readyCount} value={count("ready")} />
        <Stat label={t.prep.outCount} value={count("out")} />
        <Stat
          label={t.prep.dueToday}
          value={dueToday}
          tone={late.length ? "bad" : undefined}
          note={late.length ? `${late.length} ${t.prep.late.toLowerCase()}` : undefined}
        />
      </div>

      <nav className="mb-6 flex flex-wrap gap-2" aria-label={t.common.status}>
        {chips.map((c) => (
          <Link
            key={c.key}
            href={c.key ? `/gestion/orders?show=${c.key}` : "/gestion/orders"}
            aria-current={c.key === show ? "page" : undefined}
            className="g-btn g-btn-ghost g-btn-sm"
          >
            {c.label}
            {c.n != null && <span className="g-muted tabular-nums">{c.n}</span>}
          </Link>
        ))}
      </nav>

      {done ? (
        <ClosedOrders month={month} isAdmin={isAdmin} />
      ) : (
        <OpenOrders
          orders={only ? open.filter((o) => o.status === only) : open}
          empty={only ? fill(t.prep.emptyStatus, { status: t.prep.statuses[only] }) : t.prep.emptyActive}
          day={day}
          lang={lang}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}

/** Grouped by the day they're due: late ones first, then today, tomorrow… */
async function OpenOrders({ orders, empty, day, lang, isAdmin }: { orders: Order[]; empty: string; day: string; lang: "fr" | "ar"; isAdmin: boolean }) {
  const t = await getT();
  if (!orders.length) return <Empty>{empty}</Empty>;

  const tomorrow = nextDay(day);
  const groups = new Map<string, Order[]>();
  for (const o of orders) {
    const key = o.due_date < day ? "late" : o.due_date;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  const title = (key: string) =>
    key === "late" ? t.prep.late : key === day ? t.prep.today : key === tomorrow ? t.prep.tomorrow : weekdayLabel(key, lang);

  return [...groups.entries()].map(([key, list], i) => (
    <div key={key} className={i ? "mt-8" : ""}>
      <h2 className={`mb-3 text-lg ${key === "late" ? "text-[var(--g-bad)]" : ""}`}>
        {title(key)} <span className="g-muted text-sm tabular-nums">· {list.length}</span>
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((o) => (
          <OrderCard key={o.id} o={o} late={key === "late"} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
  ));
}

async function ClosedOrders({ month, isAdmin }: { month: string; isAdmin: boolean }) {
  const t = await getT();
  const orders = await getClosedOrders(month);
  return (
    <Section title={t.prep.filterDone} aside={<MonthNav month={month} path="/gestion/orders" params={{ show: "done" }} />}>
      {orders.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {orders.map((o) => (
            <OrderCard key={o.id} o={o} isAdmin={isAdmin} />
          ))}
        </div>
      ) : (
        <Empty>{t.prep.emptyDone}</Empty>
      )}
    </Section>
  );
}
