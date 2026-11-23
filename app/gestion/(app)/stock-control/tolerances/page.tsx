import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/gestion/auth";
import { getTolerances } from "@/lib/gestion/controls";
import { getT } from "@/lib/gestion/lang";
import { Empty, PageHeader } from "../../../_components/ui";
import { TolerancesForm } from "./tolerances-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).control.tolerances };
}

export default async function TolerancesPage() {
  await requireAdmin();
  const [rows, t] = await Promise.all([getTolerances(), getT()]);
  return (
    <>
      <PageHeader title={t.control.tolerances} sub={t.control.tolerancesSub}>
        <Link href="/gestion/stock-control" className="g-btn g-btn-ghost g-btn-sm">
          {t.control.back}
        </Link>
      </PageHeader>
      {rows.length ? <TolerancesForm rows={rows} /> : <Empty>{t.period.empty}</Empty>}
    </>
  );
}
