import type { Metadata } from "next";
import { requireAdmin } from "@/lib/gestion/auth";
import { monthOf, today } from "@/lib/gestion/format";
import { getT } from "@/lib/gestion/lang";
import { getPeriodReport } from "@/lib/gestion/queries";
import { Empty, Field, PageHeader } from "../../../_components/ui";
import { PeriodTable } from "./period-table";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.period };
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/**
 * Pick two dates, count each product at both ends: with the deliveries
 * logged in between, start + deliveries − end is what left the shop, and at
 * each product's price and cost that is what the period earned.
 */
export default async function PeriodPage({ searchParams }: PageProps<"/gestion/admin/period">) {
  await requireAdmin();
  const sp = await searchParams;
  let from = isDate(sp.from) ? sp.from : `${monthOf()}-01`;
  let to = isDate(sp.to) ? sp.to : today();
  if (to < from) [from, to] = [to, from];

  const [rows, t] = await Promise.all([getPeriodReport(from, to), getT()]);

  return (
    <>
      <PageHeader title={t.nav.period} sub={t.period.sub} />

      <form method="get" className="g-panel mb-6 flex flex-wrap items-end gap-3">
        <Field label={t.period.from}>
          <input type="date" name="from" defaultValue={from} className="g-input" required />
        </Field>
        <Field label={t.period.to}>
          <input type="date" name="to" defaultValue={to} className="g-input" required />
        </Field>
        <button type="submit" className="g-btn">
          {t.period.show}
        </button>
      </form>

      {rows.length ? (
        // Keyed on the period so switching dates starts from that period's saved counts.
        <PeriodTable key={`${from}_${to}`} from={from} to={to} rows={rows} />
      ) : (
        <Empty>{t.period.empty}</Empty>
      )}
    </>
  );
}
