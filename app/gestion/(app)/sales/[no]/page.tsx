import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/gestion/auth";
import { dateLabel, mad, qty, today } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { getLists, getSale } from "@/lib/gestion/queries";
import { createReturn, issueInvoice, receivePayment } from "../../../actions";
import { ActionForm, Submit } from "../../../_components/forms";
import { Field, PageHeader, Paid, Section, Select, Stat } from "../../../_components/ui";

export async function generateMetadata({ params }: PageProps<"/gestion/sales/[no]">): Promise<Metadata> {
  return { title: decodeURIComponent((await params).no) };
}

export default async function SalePage({ params }: PageProps<"/gestion/sales/[no]">) {
  const user = await requireUser();
  const sale = await getSale(decodeURIComponent((await params).no));
  if (!sale) notFound();
  const [lists, lang, t] = await Promise.all([getLists(), getLang(), getT()]);
  const isAdmin = user.role === "admin";
  const isReturn = !!sale.return_of_no;
  const cogs = sale.lines.reduce((s, l) => s + (l.cogs ?? 0), 0);
  const returnable = sale.lines.filter((l) => l.qty - l.returned > 0.0005);

  // Mirrors updateSale's rules, so the button only shows when the save would work.
  const editable =
    !isReturn && !sale.returns.length && !sale.invoice && !sale.order &&
    (isAdmin || (sale.created_by_id === user.id && sale.date === today()));

  return (
    <>
      <PageHeader
        title={fill(isReturn ? t.sale.returnTitle : t.sale.title, { no: sale.no })}
        sub={`${dateLabel(sale.date, lang)} · ${sale.created_by ?? "—"}${sale.channel ? ` · ${sale.channel}` : ""}`}
      >
        <Link href="/gestion/sales" className="g-btn g-btn-ghost">
          {t.sale.back}
        </Link>
        {editable && (
          <Link href={`/gestion/sales/${sale.no}/edit`} className="g-btn g-btn-ghost">
            {t.common.edit}
          </Link>
        )}
        <a href={`/gestion/print/receipt/${sale.no}`} target="_blank" rel="noopener" className="g-btn">
          {t.sale.printReceipt}
        </a>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        {isReturn ? <span className="g-badge g-badge-muted">{t.sale.refunded}</span> : <Paid paid={sale.paid} />}
        {sale.payment && <span className="g-badge g-badge-muted">{sale.payment}</span>}
        {sale.return_of_no && (
          <Link href={`/gestion/sales/${sale.return_of_no}`} className="g-badge g-badge-warn">
            {fill(t.sale.returnOf, { no: sale.return_of_no })}
          </Link>
        )}
        {sale.order && (
          <Link href={`/gestion/orders/${sale.order.id}`} className="g-badge g-badge-gold">
            {fill(t.sale.fromOrder, { no: sale.order.no })}
          </Link>
        )}
        {sale.invoice && <span className="g-badge g-badge-good">{fill(t.sale.invoiceNo, { no: sale.invoice.no })}</span>}
        <span className="g-muted">
          {sale.customer_id ? (
            <Link href={`/gestion/customers/${sale.customer_id}`} className="underline underline-offset-4">
              {sale.customer}
            </Link>
          ) : (
            t.common.walkIn
          )}
        </span>
      </div>

      <div className="g-table-wrap">
        <table className="g-table">
          <thead>
            <tr>
              <th>{t.common.product}</th>
              <th className="num">{t.common.qty}</th>
              <th className="num">{t.common.priceMad}</th>
              <th className="num">{t.common.discountPct}</th>
              <th className="num">{t.common.totalMad}</th>
              {isAdmin && <th className="num">{t.common.profit}</th>}
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.product}
                  <div className="g-muted text-xs">
                    {l.sku}
                    {l.returned > 0 && ` · ${fill(t.sale.returnedQty, { qty: qty(l.returned), unit: l.unit })}`}
                  </div>
                </td>
                <td className="num" dir="ltr">
                  {qty(l.qty)} {l.unit !== "U" && <span className="g-muted text-xs">{l.unit}</span>}
                </td>
                <td className="num">{mad(l.unit_price)}</td>
                <td className="num">{l.discount_pct ? qty(l.discount_pct) : "—"}</td>
                <td className={`num ${l.total < 0 ? "g-neg" : ""}`}>{mad(l.total)}</td>
                {isAdmin && <td className="num">{mad(l.total - (l.cogs ?? 0))}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>{t.common.total}</td>
              <td className="num">{mad(sale.total)}</td>
              {isAdmin && <td className="num">{mad(sale.total - cogs)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>

      {!isReturn && (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t.sale.receivedMad} value={mad(sale.paid ? sale.total : sale.received)} />
          <Stat label={t.sale.owedMad} value={mad(sale.owed)} tone={sale.owed > 0 ? "bad" : undefined} />
          {sale.returns.length > 0 && (
            <Stat label={t.sale.refundedMad} value={mad(-sale.returns.reduce((s, r) => s + r.total, 0))} />
          )}
        </div>
      )}

      {sale.owed > 0 && (
        <Section title={t.sale.recordPayment}>
          <ActionForm action={receivePayment} className="g-card">
            <input type="hidden" name="order_no" value={sale.no} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.common.amountMad}>
                <input className="g-input" name="amount" inputMode="decimal" defaultValue={sale.owed.toFixed(2)} required />
              </Field>
              <Field label={t.common.payment}>
                <Select name="payment" options={lists.payment} defaultValue={sale.payment} blank={false} />
              </Field>
              <Field label={t.common.date}>
                <input className="g-input" type="date" name="date" defaultValue={today()} required />
              </Field>
            </div>
            <div className="mt-4">
              <Submit>{t.sale.savePayment}</Submit>
            </div>
          </ActionForm>
        </Section>
      )}

      {sale.payments.length > 0 && (
        <Section title={t.sale.paymentsTitle}>
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.common.date}</th>
                  <th>{t.common.payment}</th>
                  <th className="num">{t.common.amountMad}</th>
                  <th>{t.sale.by}</th>
                </tr>
              </thead>
              <tbody>
                {sale.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{dateLabel(p.date, lang)}</td>
                    <td>{p.payment ?? "—"}</td>
                    <td className="num">{mad(p.amount)}</td>
                    <td>{p.by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {sale.returns.length > 0 && (
        <Section title={t.sale.returnsTitle}>
          <ul className="g-card space-y-1 text-sm">
            {sale.returns.map((r) => (
              <li key={r.no} className="flex justify-between gap-3">
                <Link href={`/gestion/sales/${r.no}`} className="underline underline-offset-4">
                  {r.no} · {dateLabel(r.date, lang)}
                </Link>
                <span className="g-neg tabular-nums">{mad(r.total)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={isReturn ? t.sale.creditInvoiceTitle : t.sale.invoiceTitle}>
        {sale.invoice ? (
          <div className="g-card flex flex-wrap items-center justify-between gap-3">
            <p>
              <span className="font-medium">{sale.invoice.no}</span>
              <span className="g-muted">
                {" "}
                · {dateLabel(sale.invoice.date, lang)} · {sale.invoice.customer_name}
                {sale.invoice.customer_ice && ` · ICE ${sale.invoice.customer_ice}`}
              </span>
            </p>
            <a href={`/gestion/print/invoice/${sale.no}`} target="_blank" rel="noopener" className="g-btn">
              {t.sale.printInvoice}
            </a>
          </div>
        ) : (
          <ActionForm action={issueInvoice} keep className="g-card">
            <input type="hidden" name="order_no" value={sale.no} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={t.sale.invoiceCustomer}>
                <input className="g-input" name="customer_name" defaultValue={sale.customer ?? ""} required />
              </Field>
              <Field label={t.sale.ice}>
                <input className="g-input" name="customer_ice" defaultValue={sale.ice ?? ""} inputMode="numeric" placeholder="000000000000000" />
              </Field>
              <Field label={t.common.date}>
                <input className="g-input" type="date" name="date" defaultValue={today()} required />
              </Field>
              <Field label={t.sale.address} className="sm:col-span-2 lg:col-span-4">
                <input className="g-input" name="customer_address" defaultValue={sale.address ?? ""} />
              </Field>
            </div>
            <p className="g-muted mt-3 text-xs">{t.sale.invoiceHint}</p>
            <div className="mt-4">
              <Submit>{t.sale.issueInvoice}</Submit>
            </div>
          </ActionForm>
        )}
      </Section>

      {isAdmin && !isReturn && returnable.length > 0 && (
        <Section title={t.sale.returnTitleForm}>
          {sale.paid ? (
            <details className="g-card">
              <summary className="cursor-pointer font-medium">{t.sale.returnOpen}</summary>
              <ActionForm action={createReturn} keep className="mt-4">
                <input type="hidden" name="order_no" value={sale.no} />
                <div className="space-y-3">
                  {returnable.map((l) => (
                    <label key={l.id} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3">
                      <span>
                        {l.product}
                        <span className="g-muted text-xs">
                          {" "}
                          · {fill(t.sale.canReturn, { qty: qty(l.qty - l.returned), unit: l.unit })}
                        </span>
                      </span>
                      <input className="g-input" name={`qty_${l.id}`} inputMode="decimal" placeholder="0" aria-label={fill(t.sale.qtyBack, { name: l.product })} />
                    </label>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Field label={t.sale.refundBy}>
                    <Select name="payment" options={lists.payment} defaultValue={sale.payment} blank={false} />
                  </Field>
                  <Field label={t.common.date}>
                    <input className="g-input" type="date" name="date" defaultValue={today()} required />
                  </Field>
                  <label className="flex items-center gap-2 self-end pb-2">
                    <input type="checkbox" name="restock" defaultChecked className="size-4 accent-[var(--color-accent)]" />
                    {t.sale.restock}
                  </label>
                </div>
                <p className="g-muted mt-3 text-xs">{t.sale.returnHint}</p>
                <div className="mt-4">
                  <Submit>{t.sale.saveReturn}</Submit>
                </div>
              </ActionForm>
            </details>
          ) : (
            <p className="g-panel g-muted text-sm">{t.sale.returnNeedsPaid}</p>
          )}
        </Section>
      )}
    </>
  );
}
