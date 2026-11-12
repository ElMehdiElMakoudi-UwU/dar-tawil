import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/gestion/auth";
import { dayLabel, mad, parseMonth, qty, today } from "@/lib/gestion/format";
import { getLang, getT } from "@/lib/gestion/lang";
import { getAdjustments, getProducts } from "@/lib/gestion/queries";
import { deleteAdjustment } from "../../actions";
import { ActionButton } from "../../_components/forms";
import { Empty, MonthNav, PageHeader, Section, Stat } from "../../_components/ui";
import { AdjustForm } from "./adjust-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.stock };
}

export default async function StockPage({ searchParams }: PageProps<"/gestion/stock">) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const month = parseMonth((await searchParams).month);
  const [rows, products, lang, t] = await Promise.all([getAdjustments(month), getProducts({ activeOnly: true }), getLang(), getT()]);
  const lost = rows.reduce((s, r) => s + Math.min(r.value ?? 0, 0), 0);

  return (
    <>
      <PageHeader title={t.nav.stock} sub={t.adjust.sub}>
        <MonthNav month={month} path="/gestion/stock" />
      </PageHeader>

      {isAdmin && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t.adjust.lostMad} value={mad(Math.abs(lost))} tone={lost < 0 ? "bad" : undefined} note={t.adjust.atCost} />
          <Stat label={t.adjust.entries} value={rows.length} />
        </div>
      )}

      <AdjustForm
        products={products.map(({ id, sku, name, unit, in_stock }) => ({ id, sku, name, unit, in_stock }))}
        today={today()}
      />

      <Section title={t.adjust.historyTitle}>
        {rows.length ? (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>{t.common.date}</th>
                  <th>{t.common.product}</th>
                  <th>{t.adjust.reason}</th>
                  <th className="num">{t.common.qty}</th>
                  {isAdmin && <th className="num">{t.adjust.valueMad}</th>}
                  <th>{t.common.notes}</th>
                  {isAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      {dayLabel(r.date, lang)}
                      <div className="g-muted text-xs">{r.created_by ?? "—"}</div>
                    </td>
                    <td>
                      {r.product}
                      <div className="g-muted text-xs">{r.sku}</div>
                    </td>
                    <td>{t.adjust.reasons[r.reason]}</td>
                    <td className={`num ${r.qty < 0 ? "g-neg" : ""}`} dir="ltr">
                      {r.qty > 0 ? "+" : ""}
                      {qty(r.qty)} <span className="g-muted text-xs">{r.unit}</span>
                    </td>
                    {isAdmin && <td className={`num ${(r.value ?? 0) < 0 ? "g-neg" : ""}`}>{mad(r.value)}</td>}
                    <td>
                      {r.from_return ? (
                        <Link href={`/gestion/sales/${r.from_return}`} className="underline underline-offset-4">
                          {r.notes ?? r.from_return}
                        </Link>
                      ) : (
                        (r.notes ?? "—")
                      )}
                    </td>
                    {isAdmin && (
                      <td className="text-end">
                        {!r.from_return && (
                          <ActionButton action={deleteAdjustment} fields={{ id: r.id }} confirm={t.adjust.confirmDelete} className="g-link-danger">
                            {t.common.delete}
                          </ActionButton>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t.adjust.empty}</Empty>
        )}
      </Section>
    </>
  );
}
