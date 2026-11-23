import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/gestion/auth";
import { getControl, getCountSheet } from "@/lib/gestion/controls";
import { dateLabel } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { Empty, PageHeader } from "../../../../_components/ui";
import { CountSheet } from "./count-sheet";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).control.countTitle };
}

/** The count, next to what the till expects: only the owner counts. */
export default async function CountPage({ params }: PageProps<"/gestion/stock-control/[id]/count">) {
  await requireAdmin();
  const controlId = Number((await params).id);
  if (!Number.isInteger(controlId)) notFound();
  const control = await getControl(controlId);
  if (!control) notFound();
  const [lang, t] = await Promise.all([getLang(), getT()]);

  return (
    <>
      <PageHeader title={`${t.control.countTitle} — ${control.label}`} sub={fill(t.control.startedOn, { date: dateLabel(control.start_date, lang) })}>
        <Link href="/gestion/stock-control" className="g-btn g-btn-ghost g-btn-sm">
          {t.control.back}
        </Link>
        <Link href={`/gestion/stock-control/${control.id}`} className="g-btn g-btn-ghost g-btn-sm">
          {t.control.resultsBtn}
        </Link>
      </PageHeader>
      {control.status === "open" ? (
        <CountSheet controlId={control.id} rows={await getCountSheet(control.id)} />
      ) : (
        <Empty>{t.control.closedNote}</Empty>
      )}
    </>
  );
}
