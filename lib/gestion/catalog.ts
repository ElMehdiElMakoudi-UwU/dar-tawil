import "server-only";
import { getCategoryRows, imageUrl, localized, type Category, type CategoryRow } from "@/lib/catalog";
import { requireAdmin } from "./auth";
import { sql } from "./db";
import type { Lang } from "./i18n";

/** The page sections, with the titles the site gives them, for a <Select>. */
export async function categoryOptions(lang: Lang) {
  const rows = await getCategoryRows();
  return rows.map((c) => ({ value: c.slug, label: localized(c, "name", lang) }));
}

/** Every rubrique with how many packs it holds, for /gestion/admin/collections/rubriques. */
export async function getCategoryAdmin() {
  await requireAdmin();
  return sql<(CategoryRow & { packs: number })[]>`
    select c.slug, c.position, c.name_fr, c.name_en, c.name_ar,
      (select count(*)::int from catalog_packs p where p.category = c.slug) as packs
    from catalog_categories c order by c.position, c.slug`;
}

/* Back-office reads for /gestion/admin/collections. Admin only. */

export type AdminPack = {
  id: number;
  position: number;
  category: Category;
  featured: boolean;
  composable: boolean;
  visible: boolean;
  name_fr: string;
  name_en: string | null;
  name_ar: string | null;
  description_fr: string | null;
  description_en: string | null;
  description_ar: string | null;
};

export type AdminVariant = {
  id: number;
  label_fr: string | null;
  label_en: string | null;
  label_ar: string | null;
  price: number | null;
  images: { id: number; url: string }[];
};

export type PackRow = AdminPack & {
  variants: number;
  min_price: number | null;
  max_price: number | null;
  images: number;
  cover: string | null;
};

/** Every pack, in the order the site shows them (featured first). */
export async function getPackRows(): Promise<PackRow[]> {
  await requireAdmin();
  const rows = await sql<(AdminPack & Omit<PackRow, keyof AdminPack | "cover"> & { cover_id: number | null; cover_src: string | null })[]>`
    select p.*,
      (select count(*)::int from catalog_variants v where v.pack_id = p.id) as variants,
      (select min(price) from catalog_variants v where v.pack_id = p.id) as min_price,
      (select max(price) from catalog_variants v where v.pack_id = p.id) as max_price,
      (select count(*)::int from catalog_images i join catalog_variants v on v.id = i.variant_id where v.pack_id = p.id) as images,
      c.id as cover_id, c.src as cover_src
    from catalog_packs p
    left join lateral (
      select i.id, i.src from catalog_images i join catalog_variants v on v.id = i.variant_id
      where v.pack_id = p.id order by v.position, v.id, i.position, i.id limit 1
    ) c on true
    join catalog_categories cat on cat.slug = p.category
    order by cat.position, cat.slug, p.featured desc, p.position, p.id
  `;
  return rows.map(({ cover_id, cover_src, ...r }) => ({
    ...r,
    cover: cover_id ? imageUrl({ id: cover_id, src: cover_src }) : null,
  }));
}

export async function getPackAdmin(id: number) {
  await requireAdmin();
  const [pack] = await sql<AdminPack[]>`select * from catalog_packs where id = ${id}`;
  if (!pack) return null;
  const variants = await sql<Omit<AdminVariant, "images">[]>`
    select id, label_fr, label_en, label_ar, price from catalog_variants
    where pack_id = ${id} order by position, id`;
  const images = variants.length
    ? await sql<{ id: number; variant_id: number; src: string | null }[]>`
        select id, variant_id, src from catalog_images
        where variant_id in ${sql(variants.map((v) => v.id))} order by position, id`
    : [];
  const byVariant = Map.groupBy(images, (i) => i.variant_id);
  return {
    pack,
    variants: variants.map((v) => ({
      ...v,
      images: (byVariant.get(v.id) ?? []).map((i) => ({ id: i.id, url: imageUrl(i) })),
    })) satisfies AdminVariant[],
  };
}
