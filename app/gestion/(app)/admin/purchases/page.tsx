import type { Metadata } from "next";
import { requireAdmin } from "@/lib/gestion/auth";
import { dayLabel, mad, parseMonth, qty, today } from "@/lib/gestion/format";
import { getProducts, getPurchases, getSuppliers } from "@/lib/gestion/queries";
import { getLang, getT } from "@/lib/gestion/lang";
import { createPurchase, deletePurchase, setPurchasePaid } from "../../../actions";
import { ActionButton, ActionForm, Submit } from "../../../_components/forms";
import { Empty, Field, MonthNav, PageHeader, Paid, Section, Select, Stat } from "../../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.purchases };
}

export default async function PurchasesPage({ searchParams }: PageProps<"/gestion/admin/purchases">) {
  await requireAdmin();
  const month = parseMonth((await searchParams).month);
  const [rows, products, suppliers, lang, t] = await Promise.all([
    getPurchases(month),
    getProducts({ activeOnly: true }),
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
        <ActionForm action={createPurchase} className="g-card">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t.common.date}>
              <input className="g-input" type="date" name="date" defaultValue={today()} required />
            </Field>
            <Field label={t.purchases.supplier}>
              <input className="g-input" name="supplier" list="suppliers" autoComplete="off" />
              <datalist id="suppliers">
                {suppliers.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field label={t.common.product} className="sm:col-span-2">
              <Select name="product_id" required blank={t.common.choose} options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))} />
            </Field>
            <Field label={t.common.quantity}>
              <input className="g-input" name="qty" inputMode="decimal" required />
            </Field>
            <Field label={t.common.unitCostMad}>
              <input className="g-input" name="unit_cost" inputMode="decimal" required />
            </Field>
            <Field label={t.common.notes} className="sm:col-span-2">
              <input className="g-input" name="notes" />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="paid" defaultChecked className="size-4 accent-[var(--color-accent)]" /> {t.common.paid}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="update_cost" defaultChecked className="size-4 accent-[var(--color-accent)]" />{" "}
              {t.purchases.updateCost}
            </label>
            <Submit>{t.purchases.save}</Submit>
          </div>
        </ActionForm>
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
                  <th>{t.common.product}</th>
                  <th className="num">{t.common.qty}</th>
                  <th className="num">{t.common.unitCost}</th>
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
                      {r.notes && <div className="g-muted text-xs">{r.notes}</div>}
                    </td>
                    <td>
                      {r.product} <span className="g-muted text-xs">{r.sku}</span>
                    </td>
                    <td className="num">{qty(r.qty)}</td>
                    <td className="num">{mad(r.unit_cost)}</td>
                    <td className="num font-medium">{mad(r.total)}</td>
                    <td>
                      <Paid paid={r.paid} />
                    </td>
                    <td className="space-x-3 text-end whitespace-nowrap">
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
