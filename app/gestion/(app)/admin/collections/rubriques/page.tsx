import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/gestion/auth";
import { getCategoryAdmin } from "@/lib/gestion/catalog";
import { getT } from "@/lib/gestion/lang";
import type { Dict } from "@/lib/gestion/i18n";
import type { CategoryRow } from "@/lib/catalog";
import { createCategory, deleteCategory, moveCategory, saveCategory } from "../../../../catalog-actions";
import { ActionButton, ActionForm, Submit } from "../../../../_components/forms";
import { Empty, Field, PageHeader, Section } from "../../../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).catalog.sectionsTitle };
}

const LANGS = [
  { code: "fr", dir: "ltr" },
  { code: "en", dir: "ltr" },
  { code: "ar", dir: "rtl" },
] as const;

const langName = (t: Dict, code: (typeof LANGS)[number]["code"]) =>
  ({ fr: t.catalog.langFr, en: t.catalog.langEn, ar: t.catalog.langAr })[code];

/** The three name inputs; an empty English or Arabic name shows the French one on the site. */
function NameFields({ t, c }: { t: Dict; c?: CategoryRow }) {
  return (
    <div className="grid flex-1 gap-3 sm:grid-cols-3">
      {LANGS.map(({ code, dir }) => (
        <Field key={code} label={`${t.catalog.name} (${langName(t, code)})`}>
          <input
            className="g-input"
            name={`name_${code}`}
            dir={dir}
            defaultValue={c?.[`name_${code}`] ?? ""}
            required={code === "fr"}
            placeholder={code === "fr" ? undefined : c?.name_fr}
          />
        </Field>
      ))}
    </div>
  );
}

export default async function CategoriesAdminPage() {
  await requireAdmin();
  const [rows, t] = await Promise.all([getCategoryAdmin(), getT()]);

  return (
    <>
      <PageHeader title={t.catalog.sectionsTitle} sub={t.catalog.sectionsSub}>
        <Link href="/gestion/admin/collections" className="g-btn g-btn-ghost">
          {t.catalog.back}
        </Link>
        <a href="/fr/collections" target="_blank" rel="noreferrer" className="g-btn g-btn-ghost">
          {t.catalog.viewSite} ↗
        </a>
      </PageHeader>

      {rows.length ? (
        <ol className="space-y-3">
          {rows.map((c, i) => (
            <li key={c.slug} className="g-card">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex gap-1 self-center">
                  <Move slug={c.slug} dir={-1} label={t.catalog.moveUp} hidden={i === 0} />
                  <Move slug={c.slug} dir={1} label={t.catalog.moveDown} hidden={i === rows.length - 1} />
                </div>
                <ActionForm action={saveCategory} keep className="flex min-w-0 flex-1 flex-wrap items-end gap-4">
                  <input type="hidden" name="slug" value={c.slug} />
                  <NameFields t={t} c={c} />
                  <Submit className="g-btn g-btn-ghost">{t.catalog.saveSection}</Submit>
                </ActionForm>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--g-line)] pt-3 text-sm">
                <span className="g-muted">
                  {t.catalog.packsCount} : {c.packs}
                </span>
                <ActionButton
                  action={deleteCategory}
                  fields={{ slug: c.slug }}
                  confirm={t.catalog.confirmDeleteSection}
                  className="g-link-danger"
                >
                  {t.catalog.deleteSection}
                </ActionButton>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <Empty>{t.catalog.sectionsEmpty}</Empty>
      )}

      <Section title={t.catalog.addSectionTitle}>
        <ActionForm action={createCategory} className="g-card">
          <NameFields t={t} />
          <div className="mt-4">
            <Submit>{t.catalog.addSectionBtn}</Submit>
          </div>
        </ActionForm>
      </Section>
    </>
  );
}

function Move({ slug, dir, label, hidden }: { slug: string; dir: -1 | 1; label: string; hidden: boolean }) {
  if (hidden) return <span className="inline-block w-[2.1rem]" aria-hidden />;
  return (
    <ActionButton action={moveCategory} fields={{ slug, dir }}>
      <span aria-hidden>{dir < 0 ? "↑" : "↓"}</span>
      <span className="sr-only">{label}</span>
    </ActionButton>
  );
}
