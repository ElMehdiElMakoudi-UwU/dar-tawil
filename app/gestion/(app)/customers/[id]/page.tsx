import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/gestion/auth";
import { dateLabel, mad, today, whatsappLink } from "@/lib/gestion/format";
import { getLang, getT } from "@/lib/gestion/lang";
import { getCustomer, getLists } from "@/lib/gestion/queries";
import { receivePayment, saveCustomer } from "../../../actions";
import { ActionForm, Submit } from "../../../_components/forms";
import { Empty, Field, PageHeader, Paid, Section, Select, Stat } from "../../../_components/ui";

export async function generateMetadata({ params }: PageProps<"/gestion/customers/[id]">): Promise<Metadata> {
  const c = await getCustomer(Number((await params).id));
  return { title: c?.name };
}

export default async function CustomerPage({ params }: PageProps<"/gestion/customers/[id]">) {
  const user = await requireUser();
  const c = await getCustomer(Number((await params).id));
  if (!c) notFound();
  const [lists, lang, t] = await Promise.all([getLists(), getLang(), getT()]);
  const owed = c.sales.reduce((s, x) => s + x.owed, 0);
  const spent = c.sales.reduce((s, x) => s + x.total, 0);
  const wa = whatsappLink(c.phone);

  return (
    <>
      <PageHeader title={c.name} sub={[c.type, c.city, c.phone].filter(Boolean).join(" · ") || undefined}>
        <Link href="/gestion/customers" className="g-btn g-btn-ghost">
          {t.customer.back}
        </Link>
        {wa && (
          <a href={wa} target="_blank" rel="noopener" className="g-btn g-btn-ghost">
            {t.prep.whatsapp}
          </a>
        )}
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.customers.spent} value={mad(spent)} note={t.cur} />
        <Stat label={t.customer.salesCount} value={c.sales.filter((s) => !s.is_return).length} />
        <Stat label={t.customer.owesMad} value={mad(owed)} tone={owed > 0 ? "bad" : undefined} />
      </div>

      {owed > 0 && (
        <Section title={t.customer.payTitle}>
          <ActionForm action={receivePayment} className="g-card">
            <input type="hidden" name="customer_id" value={c.id} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.common.amountMad}>
                <input className="g-input" name="amount" inputMode="decimal" defaultValue={owed.toFixed(2)} required />
              </Field>
              <Field label={t.common.payment}>
                <Select name="payment" options={lists.payment} blank={false} />
              </Field>
              <Field label={t.common.date}>
                <input className="g-input" type="date" name="date" defaultValue={today()} required />
              </Field>
            </div>
            <p className="g-muted mt-3 text-xs">{t.customer.payHint}</p>
            <div className="mt-4">
              <Submit>{t.sale.savePayment}</Submit>
            </div>
          </ActionForm>
        </Section>
      )}

      <Section title={t.customer.historyTitle}>
        {c.sales.length ? (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.orders.order}</th>
                  <th>{t.orders.items}</th>
                  <th className="num">{t.common.totalMad}</th>
                  <th>{t.common.payment}</th>
                  <th className="num">{t.customer.leftMad}</th>
                </tr>
              </thead>
              <tbody>
                {c.sales.map((s) => (
                  <tr key={s.no}>
                    <td className="whitespace-nowrap">
                      <Link href={`/gestion/sales/${s.no}`} className="font-medium underline decoration-[var(--g-line)] underline-offset-4">
                        {s.no}
                      </Link>
                      <div className="g-muted text-xs">{dateLabel(s.date, lang)}</div>
                    </td>
                    <td className="text-sm">{s.items}</td>
                    <td className={`num ${s.total < 0 ? "g-neg" : ""}`}>{mad(s.total)}</td>
                    <td>{s.is_return ? <span className="g-badge g-badge-warn">{t.sale.creditNote}</span> : <Paid paid={s.paid} />}</td>
                    <td className={`num ${s.owed > 0 ? "g-neg" : ""}`}>{s.owed > 0 ? mad(s.owed) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t.customer.noSales}</Empty>
        )}
      </Section>

      <Section title={t.customer.detailsTitle}>
        {user.role === "admin" ? (
          <ActionForm action={saveCustomer} keep className="g-card">
            <input type="hidden" name="id" value={c.id} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={t.common.name}>
                <input className="g-input" name="name" defaultValue={c.name} required />
              </Field>
              <Field label={t.common.phone}>
                <input className="g-input" name="phone" type="tel" defaultValue={c.phone ?? ""} />
              </Field>
              <Field label={t.common.city}>
                <input className="g-input" name="city" defaultValue={c.city ?? ""} />
              </Field>
              <Field label={t.common.type}>
                <Select name="type" options={lists.customer_type} defaultValue={c.type} />
              </Field>
              <Field label={t.sale.ice}>
                <input className="g-input" name="ice" defaultValue={c.ice ?? ""} inputMode="numeric" />
              </Field>
              <Field label={t.sale.address} className="lg:col-span-3">
                <input className="g-input" name="address" defaultValue={c.address ?? ""} />
              </Field>
              <Field label={t.common.notes} className="sm:col-span-2 lg:col-span-4">
                <input className="g-input" name="notes" defaultValue={c.notes ?? ""} />
              </Field>
            </div>
            <div className="mt-4">
              <Submit>{t.common.save}</Submit>
            </div>
          </ActionForm>
        ) : (
          <dl className="g-card grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="g-label">{t.sale.ice}</dt>
              <dd>{c.ice ?? "—"}</dd>
            </div>
            <div>
              <dt className="g-label">{t.sale.address}</dt>
              <dd>{c.address ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="g-label">{t.common.notes}</dt>
              <dd>{c.notes ?? "—"}</dd>
            </div>
          </dl>
        )}
      </Section>
    </>
  );
}
