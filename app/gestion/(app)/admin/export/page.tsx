import type { Metadata } from "next";
import { requireAdmin } from "@/lib/gestion/auth";
import { sql } from "@/lib/gestion/db";
import { today } from "@/lib/gestion/format";
import { getT } from "@/lib/gestion/lang";
import { PageHeader, Section } from "../../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.export };
}

export default async function ExportPage() {
  await requireAdmin();
  const t = await getT();
  const thisYear = Number(today().slice(0, 4));
  const rows = await sql<{ y: number }[]>`
    select distinct extract(year from date)::int as y from sales
    union select ${thisYear} order by 1 desc
  `;

  return (
    <>
      <PageHeader title={t.nav.export} sub={t.exp.sub} />

      <Section title={t.exp.booksTitle}>
        <div className="g-card">
          <p className="g-muted mb-4 text-sm">{t.exp.booksText}</p>
          <div className="flex flex-wrap gap-2">
            {rows.map(({ y }) => (
              // A plain link: the browser downloads the file.
              <a key={y} href={`/gestion/export/xlsx?year=${y}`} className={`g-btn ${y === thisYear ? "" : "g-btn-ghost"}`} download>
                {y} · Excel
              </a>
            ))}
          </div>
        </div>
      </Section>

      <Section title={t.exp.backupTitle}>
        <div className="g-card">
          <p className="g-muted mb-4 text-sm">{t.exp.backupText}</p>
          <a href="/gestion/export/backup" className="g-btn" download>
            {t.exp.backupBtn}
          </a>
          <p className="g-muted mt-4 text-xs">{t.exp.backupNote}</p>
        </div>
      </Section>
    </>
  );
}
