import type { Metadata } from "next";
import { requireUser } from "@/lib/gestion/auth";
import { dateLabel, mad } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { getCustomers, getLists } from "@/lib/gestion/queries";
import { deleteCustomer, saveCustomer } from "../../actions";
import { ActionButton, ActionForm, Submit } from "../../_components/forms";
import { Empty, Field, PageHeader, Section, Select, Stat } from "../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.customers };
}

export default async function CustomersPage() {
  const user = await requireUser();
  const [lang, t] = await Promise.all([getLang(), getT()]);
  const isAdmin = user.role === "admin";
  const [customers, lists] = await Promise.all([getCustomers(), getLists()]);
  const owed = customers.reduce((s, c) => s + c.unpaid, 0);

  return (
    <>
      <PageHeader title={t.nav.customers} sub={t.customers.sub} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.nav.customers} value={customers.length} />
        <Stat label={t.customers.owe} value={mad(owed)} tone={owed > 0 ? "bad" : undefined} />
      </div>

      {customers.length ? (
        <div className="g-table-wrap">
          <table className="g-table">
            <thead>
              <tr>
                <th>{t.common.customer}</th>
                <th>{t.customers.contact}</th>
                <th>{t.common.type}</th>
                <th className="num">{t.customers.saleLines}</th>
                <th className="num">{t.customers.spent}</th>
                <th>{t.customers.lastOrder}</th>
                <th className="num">{t.common.unpaid}</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">
                    {c.name}
                    {c.notes && <div className="g-muted text-xs font-normal">{c.notes}</div>}
                  </td>
                  <td>
                    {c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : "—"}
                    {c.city && <div className="g-muted text-xs">{c.city}</div>}
                  </td>
                  <td>{c.type ?? "—"}</td>
                  <td className="num">{c.lines}</td>
                  <td className="num">{mad(c.spent)}</td>
                  <td>{c.last_order ? dateLabel(c.last_order, lang) : "—"}</td>
                  <td className={`num ${c.unpaid > 0 ? "g-neg" : ""}`}>{mad(c.unpaid)}</td>
                  {isAdmin && (
                    <td className="text-end">
                      <ActionButton
                        action={deleteCustomer}
                        fields={{ id: c.id }}
                        confirm={fill(t.customers.confirmDelete, { name: c.name })}
                        className="g-link-danger"
                      >
                        {t.common.delete}
                      </ActionButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t.customers.empty}</Empty>
      )}

      <Section title={t.customers.addTitle}>
        <ActionForm action={saveCustomer} className="g-card">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t.common.name}>
              <input className="g-input" name="name" required />
            </Field>
            <Field label={t.common.phone}>
              <input className="g-input" name="phone" type="tel" />
            </Field>
            <Field label={t.common.city}>
              <input className="g-input" name="city" />
            </Field>
            <Field label={t.common.type}>
              <Select name="type" options={lists.customer_type} />
            </Field>
            <Field label={t.common.notes} className="sm:col-span-2 lg:col-span-4">
              <input className="g-input" name="notes" />
            </Field>
          </div>
          <div className="mt-4">
            <Submit>{t.customers.addBtn}</Submit>
          </div>
        </ActionForm>
      </Section>
    </>
  );
}
