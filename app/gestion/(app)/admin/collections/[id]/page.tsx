import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/gestion/auth";
import { categoryOptions, getPackAdmin, type AdminVariant } from "@/lib/gestion/catalog";
import { getLang, getT } from "@/lib/gestion/lang";
import type { Dict } from "@/lib/gestion/i18n";
import {
  deleteImage,
  deletePack,
  deleteVariant,
  moveImage,
  moveVariant,
  savePack,
  saveVariant,
} from "../../../../catalog-actions";
import { ActionButton, ActionForm, Submit } from "../../../../_components/forms";
import { Field, PageHeader, Section, Select } from "../../../../_components/ui";
import { PhotoUpload } from "../photo-upload";

export async function generateMetadata({ params }: PageProps<"/gestion/admin/collections/[id]">): Promise<Metadata> {
  const data = await getPackAdmin(Number((await params).id));
  return { title: data?.pack.name_fr ?? (await getT()).nav.collections };
}

const LANGS = [
  { code: "fr", dir: "ltr" },
  { code: "en", dir: "ltr" },
  { code: "ar", dir: "rtl" },
] as const;

const langName = (t: Dict, code: (typeof LANGS)[number]["code"]) =>
  ({ fr: t.catalog.langFr, en: t.catalog.langEn, ar: t.catalog.langAr })[code];

export default async function EditPackPage({ params }: PageProps<"/gestion/admin/collections/[id]">) {
  await requireAdmin();
  const data = await getPackAdmin(Number((await params).id));
  if (!data) notFound();
  const { pack, variants } = data;
  const [t, lang] = await Promise.all([getT(), getLang()]);

  return (
    <>
      <PageHeader title={pack.name_fr} sub={t.catalog.editSub}>
        <Link href="/gestion/admin/collections" className="g-btn g-btn-ghost">
          {t.catalog.back}
        </Link>
        <a href="/fr/collections" target="_blank" rel="noreferrer" className="g-btn g-btn-ghost">
          {t.catalog.viewSite} ↗
        </a>
      </PageHeader>

      <Section title={t.catalog.textsTitle} aside={<span className="g-muted text-sm">{t.catalog.fallback}</span>}>
        <ActionForm action={savePack} keep className="g-card">
          <input type="hidden" name="id" value={pack.id} />
          <div className="grid gap-5 lg:grid-cols-3">
            {LANGS.map(({ code, dir }) => (
              <fieldset key={code} className="space-y-3" dir={dir}>
                <legend className="eyebrow mb-2">{langName(t, code)}</legend>
                <Field label={t.catalog.name}>
                  <input
                    className="g-input"
                    name={`name_${code}`}
                    defaultValue={pack[`name_${code}`] ?? ""}
                    required={code === "fr"}
                    placeholder={code === "fr" ? undefined : pack.name_fr}
                  />
                </Field>
                <Field label={t.catalog.description}>
                  <textarea
                    className="g-input"
                    name={`description_${code}`}
                    rows={4}
                    defaultValue={pack[`description_${code}`] ?? ""}
                  />
                </Field>
              </fieldset>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-[var(--g-line)] pt-4">
            <Field label={t.catalog.section} className="w-full sm:w-56">
              <Select name="category" options={await categoryOptions(lang)} defaultValue={pack.category} required blank={false} />
            </Field>
            <label className="flex min-h-10 items-center gap-2">
              <input type="checkbox" name="visible" defaultChecked={pack.visible} className="size-4 accent-[var(--color-accent)]" />
              {t.catalog.showVisible}
            </label>
            <label className="flex min-h-10 items-center gap-2">
              <input type="checkbox" name="featured" defaultChecked={pack.featured} className="size-4 accent-[var(--color-accent)]" />
              {t.catalog.showFeatured}
            </label>
            <label className="flex min-h-10 items-center gap-2">
              <input type="checkbox" name="composable" defaultChecked={pack.composable} className="size-4 accent-[var(--color-accent)]" />
              {t.catalog.showComposable}
            </label>
          </div>
          <div className="mt-4">
            <Submit>{t.common.save}</Submit>
          </div>
        </ActionForm>
      </Section>

      <Section title={t.catalog.variantsTitle}>
        <p className="g-muted mb-4 text-sm">{t.catalog.variantsHint}</p>
        <div className="space-y-4">
          {variants.map((v, i) => (
            <VariantCard key={v.id} v={v} n={i + 1} count={variants.length} t={t} />
          ))}
        </div>

        <ActionForm action={saveVariant} className="g-panel mt-4">
          <input type="hidden" name="pack_id" value={pack.id} />
          <p className="mb-3 font-medium">{t.catalog.addVariant}</p>
          <VariantFields t={t} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Submit className="g-btn g-btn-ghost">{t.catalog.addVariant}</Submit>
            <p className="g-muted text-sm">{t.catalog.addVariantHint}</p>
          </div>
        </ActionForm>
      </Section>

      <div className="mt-10 border-t border-[var(--g-line)] pt-5">
        <ActionButton
          action={deletePack}
          fields={{ id: pack.id, redirect: 1 }}
          confirm={t.catalog.confirmDeletePack}
          className="g-link-danger"
        >
          {t.catalog.deletePack}
        </ActionButton>
      </div>
    </>
  );
}

function VariantFields({ v, t }: { v?: AdminVariant; t: Dict }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {v && <input type="hidden" name="id" value={v.id} />}
      {LANGS.map(({ code, dir }) => (
        <Field key={code} label={`${t.catalog.sizeName} (${langName(t, code)})`}>
          <input
            className="g-input"
            name={`label_${code}`}
            dir={dir}
            defaultValue={v?.[`label_${code}`] ?? ""}
            placeholder={code === "fr" ? undefined : (v?.label_fr ?? undefined)}
          />
        </Field>
      ))}
      <Field label={t.catalog.priceMad}>
        <input
          className="g-input"
          name="price"
          inputMode="decimal"
          defaultValue={v?.price ?? ""}
          placeholder={t.catalog.pricePh}
        />
      </Field>
    </div>
  );
}

function VariantCard({ v, n, count, t }: { v: AdminVariant; n: number; count: number; t: Dict }) {
  const title = v.label_fr ? `${t.catalog.variant.replace("{n}", String(n))} · ${v.label_fr}` : t.catalog.variant.replace("{n}", String(n));
  return (
    <article className="g-card">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        {count > 1 && (
          <div className="flex items-center gap-1">
            {n > 1 && (
              <ActionButton action={moveVariant} fields={{ id: v.id, dir: -1 }}>
                ↑ <span className="sr-only">{t.catalog.moveUp}</span>
              </ActionButton>
            )}
            {n < count && (
              <ActionButton action={moveVariant} fields={{ id: v.id, dir: 1 }}>
                ↓ <span className="sr-only">{t.catalog.moveDown}</span>
              </ActionButton>
            )}
            <ActionButton
              action={deleteVariant}
              fields={{ id: v.id }}
              confirm={t.catalog.confirmDeleteVariant}
              className="g-link-danger ms-3"
            >
              {t.catalog.deleteVariant}
            </ActionButton>
          </div>
        )}
      </header>

      <ActionForm action={saveVariant} keep>
        <VariantFields v={v} t={t} />
        <div className="mt-3">
          <Submit className="g-btn g-btn-sm">{t.catalog.saveVariant}</Submit>
        </div>
      </ActionForm>

      <div className="mt-5 border-t border-[var(--g-line)] pt-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="g-label !mb-0">{t.catalog.photos}</p>
          <p className="g-muted text-xs">{t.catalog.photosHint}</p>
        </div>
        {v.images.length ? (
          <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {v.images.map((img, i) => (
              <li key={img.id} className="overflow-hidden rounded-lg border border-[var(--g-line)]">
                <div className="relative aspect-[4/5] bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" loading="lazy" className="absolute inset-0 size-full object-contain" />
                  {i === 0 && <span className="g-badge g-badge-gold absolute start-1.5 top-1.5">1</span>}
                </div>
                <div className="flex items-center justify-between gap-1 px-1.5 py-1.5">
                  <span className="flex gap-1">
                    {i > 0 && (
                      <ActionButton action={moveImage} fields={{ id: img.id, dir: -1 }}>
                        <span aria-hidden className="inline-block rtl:rotate-180">←</span>
                        <span className="sr-only">{t.catalog.moveBefore}</span>
                      </ActionButton>
                    )}
                    {i < v.images.length - 1 && (
                      <ActionButton action={moveImage} fields={{ id: img.id, dir: 1 }}>
                        <span aria-hidden className="inline-block rtl:rotate-180">→</span>
                        <span className="sr-only">{t.catalog.moveAfter}</span>
                      </ActionButton>
                    )}
                  </span>
                  <ActionButton action={deleteImage} fields={{ id: img.id }} confirm={t.catalog.confirmDeletePhoto} className="g-link-danger">
                    {t.catalog.deletePhoto}
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="g-badge g-badge-warn mb-4 !whitespace-normal">{t.catalog.noPhotos}</p>
        )}
        <PhotoUpload variantId={v.id} />
      </div>
    </article>
  );
}
