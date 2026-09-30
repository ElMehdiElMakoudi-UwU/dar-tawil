import type { Metadata } from "next";
import { requireAdmin } from "@/lib/gestion/auth";
import { dayLabel, mad, parseMonth, today } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { getCash } from "@/lib/gestion/queries";
import { createMovement, deleteMovement, saveCount } from "../../../actions";
import { ActionButton, ActionForm, Submit } from "../../../_components/forms";
import { Empty, Field, MonthNav, PageHeader, Section, Select, Stat } from "../../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.cash };
}

export default async function CashPage({ searchParams }: PageProps<"/gestion/admin/cash">) {
  await requireAdmin();
  const month = parseMonth((await searchParams).month);
  const [{ movements, days }, lang, t] = await Promise.all([getCash(month), getLang(), getT()]);

  const net = (account: "cash" | "bank") =>
    movements.filter((m) => m.account === account).reduce((s, m) => s + (m.direction === "in" ? m.amount : -m.amount), 0);
  const counted = days.filter((d) => d.counted != null);
  const gap = counted.reduce((s, d) => s + (d.counted! - d.cash_sales), 0);

  return (
    <>
      <PageHeader title={t.nav.cash} sub={t.cash.sub}>
        <MonthNav month={month} path="/gestion/admin/cash" />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t.cash.tillDiff}
          value={mad(gap)}
          tone={gap < 0 ? "bad" : undefined}
          note={fill(t.cash.daysCounted, { n: counted.length })}
        />
        <Stat label={t.cash.otherNet} value={mad(net("cash"))} />
        <Stat label={t.cash.bankNet} value={mad(net("bank"))} />
      </div>

      <Section title={t.cash.closeTill}>
        <ActionForm action={saveCount} className="g-card">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t.common.date}>
              <input className="g-input" type="date" name="date" defaultValue={today()} required />
            </Field>
            <Field label={t.cash.countedLabel}>
              <input className="g-input" name="counted" inputMode="decimal" required />
            </Field>
            <Field label={t.common.notes}>
              <input className="g-input" name="notes" />
            </Field>
          </div>
          <p className="g-muted mt-3 text-xs">{t.cash.countHint}</p>
          <div className="mt-4">
            <Submit>{t.cash.saveCount}</Submit>
          </div>
        </ActionForm>

        {days.length > 0 && (
          <div className="g-table-wrap mt-4">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.cash.day}</th>
                  <th className="num">{t.cash.cashSales}</th>
                  <th className="num">{t.cash.counted}</th>
                  <th className="num">{t.cash.difference}</th>
                  <th>{t.common.notes}</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const diff = d.counted == null ? null : d.counted - d.cash_sales;
                  return (
                    <tr key={d.date}>
                      <td>{dayLabel(d.date, lang)}</td>
                      <td className="num">{mad(d.cash_sales)}</td>
                      <td className="num">{d.counted == null ? <span className="g-muted">{t.cash.notCounted}</span> : mad(d.counted)}</td>
                      <td className={`num font-medium ${diff != null && diff < 0 ? "g-neg" : ""}`}>
                        {diff == null ? "—" : Math.abs(diff) < 0.005 ? t.cash.matches : `${diff > 0 ? "+" : ""}${mad(diff)}`}
                      </td>
                      <td className="g-muted">{d.notes ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={t.cash.logTitle}>
        <ActionForm action={createMovement} className="g-card">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t.common.date}>
              <input className="g-input" type="date" name="date" defaultValue={today()} required />
            </Field>
            <Field label={t.cash.account}>
              <Select name="account" blank={false} options={[
                  { value: "cash", label: t.cash.accountCash },
                  { value: "bank", label: t.cash.accountBank },
                ]} />
            </Field>
            <Field label={t.cash.direction}>
              <Select name="direction" blank={false} options={[
                  { value: "in", label: t.cash.moneyIn },
                  { value: "out", label: t.cash.moneyOut },
                ]} />
            </Field>
            <Field label={t.cash.whatFor}>
              <input className="g-input" name="category" list="cash-categories" required autoComplete="off" />
              <datalist id="cash-categories">
                {t.cash.categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label={t.common.amountMad}>
              <input className="g-input" name="amount" inputMode="decimal" required />
            </Field>
            <Field label={t.common.notes}>
              <input className="g-input" name="notes" />
            </Field>
          </div>
          <p className="g-muted mt-3 text-xs">{t.cash.moveHint}</p>
          <div className="mt-4">
            <Submit>{t.cash.saveMovement}</Submit>
          </div>
        </ActionForm>

        <div className="mt-4">
          {movements.length ? (
            <div className="g-table-wrap">
              <table className="g-table">
                <thead>
                  <tr>
                    <th>{t.common.date}</th>
                    <th>{t.cash.account}</th>
                    <th>{t.cash.whatFor}</th>
                    <th className="num">{t.cash.in}</th>
                    <th className="num">{t.cash.out}</th>
                    <th>{t.common.notes}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td>{dayLabel(m.date, lang)}</td>
                      <td>{t.cash.accounts[m.account]}</td>
                      <td>{m.category}</td>
                      <td className="num">{m.direction === "in" ? mad(m.amount) : ""}</td>
                      <td className="num">{m.direction === "out" ? mad(m.amount) : ""}</td>
                      <td className="g-muted">{m.notes ?? ""}</td>
                      <td className="text-end">
                        <ActionButton action={deleteMovement} fields={{ id: m.id }} confirm={t.cash.confirmDelete} className="g-link-danger">
                          {t.common.delete}
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>{t.cash.empty}</Empty>
          )}
        </div>
      </Section>
    </>
  );
}
