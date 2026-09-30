import type { Metadata } from "next";
import { requireAdmin } from "@/lib/gestion/auth";
import { dayLabel, mad, monthLabel, parseMonth, today } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { getEmployees, getPayrollMonth, type Employee } from "@/lib/gestion/queries";
import { createPayment, deletePayment, saveEmployee } from "../../../actions";
import { ActionButton, ActionForm, Submit } from "../../../_components/forms";
import { Empty, Field, MonthNav, PageHeader, Section, Select, Stat } from "../../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.payroll };
}

export default async function PayrollPage({ searchParams }: PageProps<"/gestion/admin/payroll">) {
  await requireAdmin();
  const month = parseMonth((await searchParams).month);
  const [employees, { summary, payments }, lang, t] = await Promise.all([getEmployees(), getPayrollMonth(month), getLang(), getT()]);
  const kinds = Object.entries(t.payroll.kinds).map(([value, label]) => ({ value, label }));
  const monthName = monthLabel(month, lang);
  const active = employees.filter((e) => e.active);
  const paidTotal = payments.reduce((s, p) => s + p.amount, 0);
  const due = summary.reduce((s, e) => s + Math.max(e.monthly_salary - e.salary - e.advance, 0), 0);

  return (
    <>
      <PageHeader title={t.nav.payroll} sub={t.payroll.sub}>
        <MonthNav month={month} path="/gestion/admin/payroll" />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={fill(t.payroll.paidFor, { month: monthName })} value={mad(paidTotal)} />
        <Stat label={t.payroll.stillDue} value={mad(due)} tone={due > 0 ? "bad" : undefined} />
        <Stat label={t.payroll.activeStaff} value={active.length} />
      </div>

      <Section title={fill(t.payroll.salariesFor, { month: monthName })}>
        {summary.length ? (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.payroll.employee}</th>
                  <th className="num">{t.payroll.monthlySalary}</th>
                  <th className="num">{t.payroll.advances}</th>
                  <th className="num">{t.payroll.salaryPaid}</th>
                  <th className="num">{t.payroll.bonus}</th>
                  <th className="num">{t.payroll.leftToPay}</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((e) => {
                  const left = e.monthly_salary - e.salary - e.advance;
                  return (
                    <tr key={e.id}>
                      <td>
                        {e.name}
                        {e.position && <div className="g-muted text-xs">{e.position}</div>}
                      </td>
                      <td className="num">{mad(e.monthly_salary)}</td>
                      <td className="num">{mad(e.advance)}</td>
                      <td className="num">{mad(e.salary)}</td>
                      <td className="num">{mad(e.bonus)}</td>
                      <td className={`num font-medium ${left > 0 ? "g-neg" : ""}`}>{left > 0 ? mad(left) : t.payroll.settled}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t.payroll.empty}</Empty>
        )}
      </Section>

      {active.length > 0 && (
        <Section title={t.payroll.recordTitle}>
          <ActionForm action={createPayment} className="g-card">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t.payroll.employee}>
                <Select name="employee_id" required blank={t.common.choose} options={active.map((e) => ({ value: e.id, label: e.name }))} />
              </Field>
              <Field label={t.common.type}>
                <Select name="kind" options={kinds} defaultValue="salary" blank={false} />
              </Field>
              <Field label={t.common.amountMad}>
                <input className="g-input" name="amount" inputMode="decimal" required />
              </Field>
              <Field label={t.payroll.paidOn}>
                <input className="g-input" type="date" name="date" defaultValue={today()} required />
              </Field>
              <Field label={t.payroll.forMonth}>
                <input className="g-input" type="month" name="period" defaultValue={month} required />
              </Field>
              <Field label={t.common.notes}>
                <input className="g-input" name="notes" />
              </Field>
            </div>
            <div className="mt-4">
              <Submit>{t.payroll.save}</Submit>
            </div>
          </ActionForm>
        </Section>
      )}

      {payments.length > 0 && (
        <Section title={t.payroll.paymentsTitle}>
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.payroll.paidOn}</th>
                  <th>{t.payroll.employee}</th>
                  <th>{t.common.type}</th>
                  <th className="num">{t.common.amount}</th>
                  <th>{t.common.notes}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{dayLabel(p.date, lang)}</td>
                    <td>{p.employee}</td>
                    <td>{t.payroll.kinds[p.kind] ?? p.kind}</td>
                    <td className="num">{mad(p.amount)}</td>
                    <td className="g-muted">{p.notes ?? ""}</td>
                    <td className="text-end">
                      <ActionButton action={deletePayment} fields={{ id: p.id }} confirm={t.payroll.confirmDelete} className="g-link-danger">
                        {t.common.delete}
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title={t.payroll.staff}>
        <div className="space-y-2">
          {employees.map((e) => (
            <details key={e.id} className="g-card py-3">
              <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                <span className={e.active ? "font-medium" : "g-muted"}>
                  {e.name}
                  {e.position && <span className="g-muted font-normal"> · {e.position}</span>}
                  {!e.active && t.payroll.left}
                </span>
                <span className="g-muted text-sm tabular-nums">{fill(t.payroll.perMonth, { amount: mad(e.monthly_salary) })}</span>
              </summary>
              <ActionForm action={saveEmployee} keep className="mt-4">
                <EmployeeFields e={e} />
                <div className="mt-4">
                  <Submit>{t.common.save}</Submit>
                </div>
              </ActionForm>
            </details>
          ))}
        </div>
        <ActionForm action={saveEmployee} className="g-card mt-4">
          <h3 className="mb-3 font-medium">{t.payroll.addTitle}</h3>
          <EmployeeFields />
          <div className="mt-4">
            <Submit>{t.payroll.addBtn}</Submit>
          </div>
        </ActionForm>
      </Section>
    </>
  );
}

async function EmployeeFields({ e }: { e?: Employee }) {
  const t = await getT();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {e && <input type="hidden" name="id" value={e.id} />}
      <Field label={t.common.name}>
        <input className="g-input" name="name" defaultValue={e?.name} required />
      </Field>
      <Field label={t.payroll.position}>
        <input className="g-input" name="position" defaultValue={e?.position ?? ""} placeholder={t.payroll.positionPh} />
      </Field>
      <Field label={t.common.phone}>
        <input className="g-input" name="phone" type="tel" defaultValue={e?.phone ?? ""} />
      </Field>
      <Field label={t.payroll.monthlySalaryMad}>
        <input className="g-input" name="monthly_salary" inputMode="decimal" defaultValue={e?.monthly_salary} />
      </Field>
      <Field label={t.payroll.startDate}>
        <input className="g-input" type="date" name="start_date" defaultValue={e?.start_date ?? ""} />
      </Field>
      <Field label={t.common.notes}>
        <input className="g-input" name="notes" defaultValue={e?.notes ?? ""} />
      </Field>
      {e && (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={e.active} className="size-4 accent-[var(--color-accent)]" />
          {t.payroll.stillWorking}
        </label>
      )}
    </div>
  );
}
