import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/gestion/auth";
import { getStartSheet } from "@/lib/gestion/controls";
import { today } from "@/lib/gestion/format";
import { getT } from "@/lib/gestion/lang";
import { Empty, PageHeader } from "../../../_components/ui";
import { NewControlForm } from "./new-control-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).control.newTitle };
}

export default async function NewControlPage() {
  await requireAdmin();
  const [rows, t] = await Promise.all([getStartSheet(), getT()]);
  return (
    <>
      <PageHeader title={t.control.newTitle} sub={t.control.newSub}>
        <Link href="/gestion/stock-control" className="g-btn g-btn-ghost g-btn-sm">
          {t.control.back}
        </Link>
      </PageHeader>
      {rows.length ? <NewControlForm rows={rows} today={today()} /> : <Empty>{t.period.empty}</Empty>}
    </>
  );
}
