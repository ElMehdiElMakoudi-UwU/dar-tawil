import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/gestion/auth";
import { dayLabel, mad, parseMonth, qty, today } from "@/lib/gestion/format";
import { getProductsAdmin, getPurchases, getSuppliers } from "@/lib/gestion/queries";
import { getLang, getT } from "@/lib/gestion/lang";
import { deletePurchase, setPurchasePaid } from "../../../actions";
import { ActionButton } from "../../../_components/forms";
import { Empty, MonthNav, PageHeader, Paid, Section, Stat } from "../../../_components/ui";
import { PurchaseForm } from "./purchase-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.purchases };
}

export default async function PurchasesPage({ searchParams }: PageProps<"/gestion/admin/purchases">) {
  await requireAdmin();
  const month = parseMonth((await searchParams).month);
  const [rows, products, suppliers, lang, t] = await Promise.all([
    getPurchases(month),
    getProductsAdmin(),
    getSuppliers(),
    getLang(),
    getT(),
  ]);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const unpaid = rows.filter((r) => !r.paid).reduce((s, r) => s + r.total, 0);

  return (
    <>
      <PageHeader title={t.nav.purchases} sub={t.purchases.sub}>
        <MonthNav month={month} path="/gestion/admin/purchases" />
      </PageHeader>

      <Section title={t.purchases.logTitle}>
        <PurchaseForm
          products={products.filter((p) => p.active).map(({ id, sku, name, unit, unit_cost }) => ({ id, sku, name, unit, unit_cost }))}
          suppliers={suppliers}
          today={today()}
        />
      </Section>

      <Section title={t.common.thisMonth}>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t.purchases.bought} value={mad(total)} />
          <Stat label={t.purchases.stillToPay} value={mad(unpaid)} tone={unpaid > 0 ? "bad" : undefined} />
        </div>
        {rows.length ? (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.common.date}</th>
                  <th>{t.purchases.supplier}</th>
                  <th>{t.purchases.products}</th>
                  <th className="num">{t.common.total}</th>
                  <th>{t.common.status}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{dayLabel(r.date, lang)}</td>
                    <td>
                      {r.supplier ?? "—"}
                      {r.ref && <div className="g-muted text-xs">{r.ref}</div>}
                      {r.notes && <div className="g-muted text-xs">{r.notes}</div>}
                    </td>
                    <td>
                      <ul className="space-y-0.5">
                        {r.lines.map((l, i) => (
                          <li key={i}>
                            {l.product} <span className="g-muted text-xs tabular-nums">× {qty(l.qty)}{l.unit !== "U" ? ` ${l.unit}` : ""} · {mad(l.unitCost)}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="num font-medium">{mad(r.total)}</td>
                    <td>
                      <Paid paid={r.paid} />
                    </td>
                    <td className="space-x-3 text-end whitespace-nowrap">
                      <Link href={`/gestion/admin/purchases/${r.id}`} className="g-btn g-btn-ghost g-btn-sm">
                        {t.common.edit}
                      </Link>
                      <ActionButton action={setPurchasePaid} fields={{ id: r.id, paid: String(!r.paid) }}>
                        {r.paid ? t.common.unpay : t.common.markPaid}
                      </ActionButton>
                      <ActionButton action={deletePurchase} fields={{ id: r.id }} confirm={t.purchases.confirmDelete} className="g-link-danger">
                        {t.common.delete}
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t.purchases.empty}</Empty>
        )}
      </Section>
    </>
  );
}
