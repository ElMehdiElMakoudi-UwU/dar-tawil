import type { Metadata } from "next";
import { requireAdmin } from "@/lib/gestion/auth";
import { dayLabel, mad, parseMonth, today } from "@/lib/gestion/format";
import { getExpenses, getLists } from "@/lib/gestion/queries";
import { getLang, getT } from "@/lib/gestion/lang";
import { createExpense, deleteExpense } from "../../../actions";
import { ActionButton, ActionForm, Submit } from "../../../_components/forms";
import { Empty, Field, MonthNav, PageHeader, Section, Select, Stat } from "../../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.expenses };
}

export default async function ExpensesPage({ searchParams }: PageProps<"/gestion/admin/expenses">) {
  await requireAdmin();
  const month = parseMonth((await searchParams).month);
  const [rows, lists, lang, t] = await Promise.all([getExpenses(month), getLists(), getLang(), getT()]);
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <PageHeader title={t.nav.expenses} sub={t.expenses.sub}>
        <MonthNav month={month} path="/gestion/admin/expenses" />
      </PageHeader>

      <Section title={t.expenses.logTitle}>
        <ActionForm action={createExpense} className="g-card">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t.common.date}>
              <input className="g-input" type="date" name="date" defaultValue={today()} required />
            </Field>
            <Field label={t.common.category}>
              <Select name="category" options={lists.expense_category} required blank={t.common.choose} />
            </Field>
            <Field label={t.common.amountMad}>
              <input className="g-input" name="amount" inputMode="decimal" required />
            </Field>
            <Field label={t.expenses.paidBy}>
              <Select name="payment" options={lists.payment} />
            </Field>
            <Field label={t.common.description} className="sm:col-span-2">
              <input className="g-input" name="description" />
            </Field>
            <Field label={t.common.notes} className="sm:col-span-2">
              <input className="g-input" name="notes" />
            </Field>
          </div>
          <div className="mt-4">
            <Submit>{t.expenses.save}</Submit>
          </div>
        </ActionForm>
      </Section>

      <Section title={t.common.thisMonth}>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t.common.totalMad} value={mad(total)} />
        </div>
        {rows.length ? (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.common.date}</th>
                  <th>{t.common.category}</th>
                  <th>{t.common.description}</th>
                  <th>{t.expenses.paidBy}</th>
                  <th className="num">{t.common.amount}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{dayLabel(r.date, lang)}</td>
                    <td>{r.category}</td>
                    <td>
                      {r.description ?? "—"}
                      {r.notes && <div className="g-muted text-xs">{r.notes}</div>}
                    </td>
                    <td>{r.payment ?? "—"}</td>
                    <td className="num font-medium">{mad(r.amount)}</td>
                    <td className="text-end">
                      <ActionButton action={deleteExpense} fields={{ id: r.id }} confirm={t.expenses.confirmDelete} className="g-link-danger">
                        {t.common.delete}
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t.expenses.empty}</Empty>
        )}
      </Section>
    </>
  );
}
