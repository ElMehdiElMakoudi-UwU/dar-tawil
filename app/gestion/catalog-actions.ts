"use server";

import type { TransactionSql } from "postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/gestion/auth";
import { sql } from "@/lib/gestion/db";
import { checked, handle, id, InputError, number, text, type FormState } from "@/lib/gestion/form";
import { fill } from "@/lib/gestion/i18n";

/*
 * The public Collections page, edited from /gestion/admin/collections.
 * Every action checks the admin role itself: server actions are public
 * endpoints whatever page renders the form.
 */

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Photos are shrunk in the browser first (~300 kB); this only stops strays. */
const MAX_IMAGE_MB = 4;

function refresh() {
  revalidatePath("/gestion", "layout");
  revalidatePath("/[lang]/collections", "page");
}

/** The fr/en/ar versions of one text field; an empty one falls back to French on the site. */
const texts = <K extends string>(fd: FormData, key: K) =>
  Object.fromEntries((["fr", "en", "ar"] as const).map((l) => [`${key}_${l}`, text(fd, `${key}_${l}`)])) as Record<
    `${K}_${"fr" | "en" | "ar"}`,
    string | null
  >;

/** A rubrique's key, checked against the table (the foreign key would also refuse it). */
async function category(fd: FormData, label: string) {
  const slug = String(fd.get("category") ?? "");
  const [row] = slug ? await sql`select 1 from catalog_categories where slug = ${slug}` : [];
  if (!row) throw new InputError("choose", { label });
  return slug;
}

/* ── rubriques ────────────────────────────────────────────────────── */

/** "Boîtes cadeaux" → "boites-cadeaux"; falls back to "rubrique" for a name with no Latin letters. */
function slugify(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "rubrique"
  );
}

export async function createCategory(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const values = { ...texts(fd, "name"), name_fr: text(fd, "name_fr", { required: true, label: t.field.sectionName })! };
    await sql.begin(async (tx) => {
      await tx`lock table catalog_categories in exclusive mode`;
      const base = slugify(values.name_fr);
      const taken = new Set(
        (await tx<{ slug: string }[]>`select slug from catalog_categories where slug like ${base + "%"}`).map((r) => r.slug),
      );
      let slug = base;
      for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
      const [{ position }] = await tx<{ position: number }[]>`
        select coalesce(max(position), 0) + 1 as position from catalog_categories`;
      await tx`insert into catalog_categories ${tx({ slug, position, ...values })}`;
    });
    refresh();
    return t.ok.added;
  });
}

export async function saveCategory(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const slug = String(fd.get("slug") ?? "");
    const values = { ...texts(fd, "name"), name_fr: text(fd, "name_fr", { required: true, label: t.field.sectionName })! };
    const rows = await sql`update catalog_categories set ${sql(values)} where slug = ${slug}`;
    if (!rows.count) throw new InputError("missing");
    refresh();
  });
}

export async function deleteCategory(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const slug = String(fd.get("slug") ?? "");
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from catalog_packs where category = ${slug}`;
    if (n > 0) throw new InputError("sectionNotEmpty", { n });
    await sql`delete from catalog_categories where slug = ${slug}`;
    refresh();
    return t.ok.deleted;
  });
}

export async function moveCategory(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async () => {
    const slug = String(fd.get("slug") ?? "");
    await sql.begin(async (tx) => {
      const rows = await tx<{ slug: string }[]>`select slug from catalog_categories order by position, slug for update`;
      const ids = rows.map((r) => r.slug);
      const from = ids.indexOf(slug);
      const to = from + (Number(fd.get("dir")) < 0 ? -1 : 1);
      if (from < 0) throw new InputError("missing");
      if (to < 0 || to >= ids.length) return;
      [ids[from], ids[to]] = [ids[to], ids[from]];
      await tx`
        update catalog_categories c set position = x.pos
        from (select unnest(${ids}::text[]) as slug, generate_series(1, ${ids.length}) as pos) x
        where c.slug = x.slug`;
    });
    refresh();
  });
}

/* ── packs ────────────────────────────────────────────────────────── */

/** Creates a pack with one size, then opens it to add photos. */
export async function createPack(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  let packId = 0;
  const result = await handle(async (t) => {
    const name_fr = text(fd, "name_fr", { required: true, label: t.field.packName })!;
    const category_ = await category(fd, t.field.category);
    const description_fr = text(fd, "description_fr");
    const price = number(fd, "price", { min: 0, label: t.field.price });
    packId = await sql.begin(async (tx) => {
      const [{ id }] = await tx<{ id: number }[]>`
        insert into catalog_packs (position, category, name_fr, description_fr)
        values ((select coalesce(max(position), 0) + 1 from catalog_packs), ${category_}, ${name_fr}, ${description_fr})
        returning id`;
      await tx`insert into catalog_variants (pack_id, position, price) values (${id}, 1, ${price})`;
      return id;
    });
    refresh();
  });
  if (result?.ok && packId) redirect(`/gestion/admin/collections/${packId}`);
  return result;
}

export async function savePack(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const packId = id(fd);
    const cat = await category(fd, t.field.category);
    const values = {
      ...texts(fd, "name"),
      name_fr: text(fd, "name_fr", { required: true, label: t.field.packName })!,
      ...texts(fd, "description"),
      category: cat,
      featured: checked(fd, "featured"),
      composable: checked(fd, "composable"),
      visible: checked(fd, "visible"),
    };
    const rows = await sql`update catalog_packs set ${sql(values)} where id = ${packId}`;
    if (!rows.count) throw new InputError("missing");
    refresh();
  });
}

export async function deletePack(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const result = await handle(async (t) => {
    await sql`delete from catalog_packs where id = ${id(fd)}`;
    refresh();
    return t.ok.deleted;
  });
  if (result?.ok && fd.get("redirect")) redirect("/gestion/admin/collections");
  return result;
}

export async function movePack(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async () => {
    await sql.begin(async (tx) => {
      const packId = id(fd);
      const rows = await tx<{ id: number }[]>`
        select id from catalog_packs where category = (select category from catalog_packs where id = ${packId})
        order by featured desc, position, id for update`;
      await reorder(tx, "catalog_packs", rows, packId, Number(fd.get("dir")));
    });
    refresh();
  });
}

/* ── sizes ────────────────────────────────────────────────────────── */

export async function saveVariant(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const values = { ...texts(fd, "label"), price: number(fd, "price", { min: 0, label: t.field.price }) };
    const variantId = Number(fd.get("id")) || null;
    if (variantId) {
      const rows = await sql`update catalog_variants set ${sql(values)} where id = ${variantId}`;
      if (!rows.count) throw new InputError("missing");
    } else {
      const packId = id(fd, "pack_id");
      const rows = await sql`
        insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
        select p.id, (select coalesce(max(position), 0) + 1 from catalog_variants where pack_id = p.id),
               ${values.label_fr}, ${values.label_en}, ${values.label_ar}, ${values.price}
        from catalog_packs p where p.id = ${packId}`;
      if (!rows.count) throw new InputError("missing");
    }
    refresh();
    return variantId ? t.ok.saved : t.ok.added;
  });
}

export async function deleteVariant(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const variantId = id(fd);
    await sql.begin(async (tx) => {
      const [v] = await tx<{ n: number }[]>`
        select count(*)::int as n from catalog_variants
        where pack_id = (select pack_id from catalog_variants where id = ${variantId})`;
      if (v.n <= 1) throw new InputError("lastVariant");
      await tx`delete from catalog_variants where id = ${variantId}`;
    });
    refresh();
    return t.ok.deleted;
  });
}

export async function moveVariant(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async () => {
    const variantId = id(fd);
    await sql.begin(async (tx) => {
      const rows = await tx<{ id: number }[]>`
        select id from catalog_variants
        where pack_id = (select pack_id from catalog_variants where id = ${variantId})
        order by position, id for update`;
      await reorder(tx, "catalog_variants", rows, variantId, Number(fd.get("dir")));
    });
    refresh();
  });
}

/* ── photos ───────────────────────────────────────────────────────── */

export async function uploadImages(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const variantId = id(fd, "variant_id");
    const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new InputError("noImage");
    for (const f of files) {
      if (!IMAGE_TYPES.includes(f.type)) throw new InputError("imageType");
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) throw new InputError("imageSize", { mb: MAX_IMAGE_MB });
    }
    const rows = await Promise.all(
      files.map(async (f) => ({ mime: f.type, data: Buffer.from(await f.arrayBuffer()) })),
    );
    await sql.begin(async (tx) => {
      const [v] = await tx`select id from catalog_variants where id = ${variantId} for update`;
      if (!v) throw new InputError("missing");
      const [{ start }] = await tx<{ start: number }[]>`
        select coalesce(max(position), 0) as start from catalog_images where variant_id = ${variantId}`;
      for (const [i, r] of rows.entries()) {
        await tx`insert into catalog_images ${tx({ variant_id: variantId, position: start + i + 1, ...r })}`;
      }
    });
    refresh();
    return fill(t.ok.photosAdded, { n: files.length });
  });
}

export async function deleteImage(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    await sql`delete from catalog_images where id = ${id(fd)}`;
    refresh();
    return t.ok.deleted;
  });
}

export async function moveImage(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async () => {
    const imageId = id(fd);
    await sql.begin(async (tx) => {
      const rows = await tx<{ id: number }[]>`
        select id from catalog_images
        where variant_id = (select variant_id from catalog_images where id = ${imageId})
        order by position, id for update`;
      await reorder(tx, "catalog_images", rows, imageId, Number(fd.get("dir")));
    });
    refresh();
  });
}

/* ── helpers ──────────────────────────────────────────────────────── */

/** Moves one row a step up (-1) or down (+1) and renumbers the list 1…n. */
async function reorder(tx: TransactionSql<any>, table: string, rows: { id: number }[], rowId: number, dir: number) {
  const ids = rows.map((r) => r.id);
  const from = ids.indexOf(rowId);
  const to = from + (dir < 0 ? -1 : 1);
  if (from < 0) throw new InputError("missing");
  if (to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  await tx`
    update ${tx(table)} t set position = x.pos
    from (select unnest(${ids}::int[]) as id, generate_series(1, ${ids.length}) as pos) x
    where t.id = x.id`;
}
