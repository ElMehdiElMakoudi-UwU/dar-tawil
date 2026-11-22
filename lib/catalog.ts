import "server-only";
import { sql } from "@/lib/gestion/db";
import type { Locale } from "@/lib/locales";

/**
 * The packs on the public Collections page, read from the database and
 * edited in /gestion/admin/collections (db/migrations/007_catalog.sql).
 */

/** A section's key (catalog_categories.slug), edited in /gestion/admin/collections/rubriques. */
export type Category = string;

export type CategoryRow = { slug: string; position: number } & Record<`name_${Locale}`, string | null> & { name_fr: string };

/** The page's sections, in the order set in the back office. */
export const getCategoryRows = () =>
  sql<CategoryRow[]>`select slug, position, name_fr, name_en, name_ar from catalog_categories order by position, slug`;

export type PackVariant = {
  id: number;
  /** Empty for a pack's only size. */
  label: string;
  /** In MAD; null shows "price on request". */
  price: number | null;
  images: string[];
};

export type Pack = {
  id: number;
  category: Category;
  featured: boolean;
  /** The visitor sets a quantity per variant (macarons) instead of picking one. */
  composable: boolean;
  name: string;
  description: string;
  variants: PackVariant[];
};

type Texts = Record<`${"name" | "description"}_${Locale}`, string | null>;
type LabelTexts = Record<`label_${Locale}`, string | null>;

/** The text in this language, or the French one when it was left empty. */
export function localized<K extends string>(row: Record<`${K}_${Locale}`, string | null>, key: K, lang: Locale) {
  return row[`${key}_${lang}`]?.trim() || row[`${key}_fr`]?.trim() || "";
}

/** Where a catalog photo is served from: a file in /public, or an upload. */
export const imageUrl = (img: { id: number; src: string | null }) => img.src ?? `/api/catalog/image/${img.id}`;

/**
 * Visible packs, featured first, then in the order set in the back office.
 * A size without photos is left out, and so is a pack left with no size.
 */
export async function getCatalog(lang: Locale): Promise<Pack[]> {
  const [packs, variants, images] = await Promise.all([
    sql<({ id: number; category: Category; featured: boolean; composable: boolean } & Texts)[]>`
      select * from catalog_packs where visible order by featured desc, position, id`,
    sql<({ id: number; pack_id: number; price: number | null } & LabelTexts)[]>`
      select v.* from catalog_variants v join catalog_packs p on p.id = v.pack_id
      where p.visible order by v.position, v.id`,
    sql<{ id: number; variant_id: number; src: string | null }[]>`
      select i.id, i.variant_id, i.src from catalog_images i
      join catalog_variants v on v.id = i.variant_id join catalog_packs p on p.id = v.pack_id
      where p.visible order by i.position, i.id`,
  ]);

  const imagesOf = Map.groupBy(images, (i) => i.variant_id);
  const variantsOf = Map.groupBy(variants, (v) => v.pack_id);

  return packs
    .map((p) => ({
      id: p.id,
      category: p.category,
      featured: p.featured,
      composable: p.composable,
      name: localized(p, "name", lang),
      description: localized(p, "description", lang),
      variants: (variantsOf.get(p.id) ?? [])
        .map((v) => ({
          id: v.id,
          label: localized(v, "label", lang),
          price: v.price,
          images: (imagesOf.get(v.id) ?? []).map(imageUrl),
        }))
        .filter((v) => v.images.length > 0),
    }))
    .filter((p) => p.variants.length > 0);
}

/** The visible packs grouped by section, in section order. Empty sections are left out. */
export async function getCatalogSections(lang: Locale) {
  const [packs, cats] = await Promise.all([getCatalog(lang), getCategoryRows()]);
  return cats
    .map((c) => ({ category: c.slug, name: localized(c, "name", lang), packs: packs.filter((p) => p.category === c.slug) }))
    .filter((s) => s.packs.length > 0);
}
