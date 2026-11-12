import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/gestion/auth";
import { categoryOptions, getPackRows, type PackRow } from "@/lib/gestion/catalog";
import { getLang, getT } from "@/lib/gestion/lang";
import { mad } from "@/lib/gestion/format";
import type { Dict } from "@/lib/gestion/i18n";
import { createPack, deletePack, movePack } from "../../../catalog-actions";
import { ActionButton, ActionForm, Submit } from "../../../_components/forms";
import { Empty, Field, PageHeader, Section, Select } from "../../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.collections };
}

function priceRange(p: Pick<PackRow, "min_price" | "max_price">, t: Dict) {
  if (p.min_price == null) return t.catalog.onRequest;
  return p.min_price === p.max_price ? mad(p.min_price) : `${mad(p.min_price)} – ${mad(p.max_price!)}`;
}

export default async function CollectionsAdminPage() {
  await requireAdmin();
  const [packs, t, lang] = await Promise.all([getPackRows(), getT(), getLang()]);
  const options = categoryOptions(lang);
  const sectionName = Object.fromEntries(options.map((o) => [o.value, o.label]));
  // Packs move up and down within their own section.
  const first = (i: number) => i === 0 || packs[i - 1].category !== packs[i].category;
  const last = (i: number) => i === packs.length - 1 || packs[i + 1].category !== packs[i].category;

  return (
    <>
      <PageHeader title={t.nav.collections} sub={t.catalog.sub}>
        <a href="/fr/collections" target="_blank" rel="noreferrer" className="g-btn g-btn-ghost">
          {t.catalog.viewSite} ↗
        </a>
      </PageHeader>

      {packs.length ? (
        <div className="g-table-wrap">
          <table className="g-table">
            <thead>
              <tr>
                <th>{t.catalog.photo}</th>
                <th>{t.catalog.pack}</th>
                <th>{t.catalog.section}</th>
                <th className="num">{t.catalog.sizes}</th>
                <th className="num">{t.catalog.price}</th>
                <th>{t.catalog.status}</th>
                <th>{t.catalog.order}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {packs.map((p, i) => (
                <tr key={p.id} className={p.visible ? "" : "g-muted"}>
                  <td className="w-16">
                    <Link href={`/gestion/admin/collections/${p.id}`} className="block size-12 overflow-hidden rounded-md bg-white">
                      {p.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.cover} alt="" className="size-full object-contain" loading="lazy" />
                      ) : null}
                    </Link>
                  </td>
                  <td>
                    <Link
                      href={`/gestion/admin/collections/${p.id}`}
                      className="font-medium underline decoration-[var(--g-line)] underline-offset-4"
                    >
                      {p.name_fr}
                    </Link>
                    {p.name_ar && <div className="g-muted text-xs" dir="rtl">{p.name_ar}</div>}
                  </td>
                  <td>{sectionName[p.category]}</td>
                  <td className="num">{p.variants}</td>
                  <td className="num whitespace-nowrap">{priceRange(p, t)}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {!p.visible ? (
                        <span className="g-badge g-badge-muted">{t.catalog.hidden}</span>
                      ) : p.images === 0 ? (
                        <span className="g-badge g-badge-bad">{t.catalog.noPhoto}</span>
                      ) : (
                        <span className="g-badge g-badge-good">{t.catalog.online}</span>
                      )}
                      {p.featured && <span className="g-badge g-badge-gold">{t.catalog.featured}</span>}
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Move dir={-1} id={p.id} label={t.catalog.moveUp} hidden={first(i)} />
                      <Move dir={1} id={p.id} label={t.catalog.moveDown} hidden={last(i)} />
                    </div>
                  </td>
                  <td className="text-end whitespace-nowrap">
                    <Link href={`/gestion/admin/collections/${p.id}`} className="g-btn g-btn-ghost g-btn-sm">
                      {t.common.edit}
                    </Link>{" "}
                    <ActionButton action={deletePack} fields={{ id: p.id }} confirm={t.catalog.confirmDeletePack} className="g-link-danger ms-2">
                      {t.common.delete}
                    </ActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t.catalog.empty}</Empty>
      )}

      <Section title={t.catalog.addTitle}>
        <ActionForm action={createPack} className="g-card">
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <Field label={`${t.catalog.name} (${t.catalog.langFr})`}>
              <input className="g-input" name="name_fr" required />
            </Field>
            <Field label={t.catalog.section}>
              <Select name="category" options={options} required blank={t.common.choose} />
            </Field>
            <Field label={t.catalog.priceMad}>
              <input className="g-input" name="price" inputMode="decimal" placeholder={t.catalog.pricePh} />
            </Field>
            <Field label={`${t.catalog.description} (${t.catalog.langFr})`} className="sm:col-span-3">
              <textarea className="g-input" name="description_fr" rows={2} />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Submit>{t.catalog.addBtn}</Submit>
            <p className="g-muted text-sm">{t.catalog.addHint}</p>
          </div>
        </ActionForm>
      </Section>
    </>
  );
}

function Move({ id, dir, label, hidden }: { id: number; dir: -1 | 1; label: string; hidden: boolean }) {
  if (hidden) return <span className="inline-block w-[2.1rem]" aria-hidden />;
  return (
    <ActionButton action={movePack} fields={{ id, dir }}>
      <span aria-hidden>{dir < 0 ? "↑" : "↓"}</span>
      <span className="sr-only">{label}</span>
    </ActionButton>
  );
}
