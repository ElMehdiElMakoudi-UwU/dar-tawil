import { getT } from "@/lib/gestion/lang";
import { Field, Select } from "../../_components/ui";

type P = {
  id?: number; sku?: string; name?: string; category?: string | null; unit?: string; unit_cost?: number;
  price?: number; opening_stock?: number; reorder_level?: number; active?: boolean;
  alt_unit?: string | null; alt_factor?: number | null; alt_price?: number | null;
};

/** Shared by "add product" and the edit page. */
export async function ProductFields({ p = {}, categories }: { p?: P; categories: string[] }) {
  const t = await getT();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <Field label={t.products.skuShort}>
        <input className="g-input uppercase" name="sku" defaultValue={p.sku} required />
      </Field>
      <Field label={t.products.productName} className="sm:col-span-2">
        <input className="g-input" name="name" defaultValue={p.name} required />
      </Field>
      <Field label={t.common.category}>
        <Select name="category" options={categories} defaultValue={p.category} />
      </Field>
      <Field label={t.products.costPerUnit}>
        <input className="g-input" name="unit_cost" inputMode="decimal" defaultValue={p.unit_cost} placeholder="0" />
      </Field>
      <Field label={t.products.pricePerUnit}>
        <input className="g-input" name="price" inputMode="decimal" defaultValue={p.price} required />
      </Field>
      <Field label={t.products.openingStock}>
        <input className="g-input" name="opening_stock" inputMode="decimal" defaultValue={p.opening_stock} placeholder="0" />
      </Field>
      <Field label={t.common.reorderAt}>
        <input className="g-input" name="reorder_level" inputMode="decimal" defaultValue={p.reorder_level} placeholder="0" />
      </Field>
      <Field label={t.products.stockUnit}>
        <input className="g-input" name="unit" defaultValue={p.unit ?? "U"} placeholder={t.products.unitPh} />
      </Field>
      <fieldset className="grid gap-4 border-t border-[var(--g-line)] pt-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-4">
        <legend className="g-muted pe-2 text-sm">
          {t.products.altLegend}
        </legend>
        <Field label={t.products.secondUnit}>
          <input className="g-input" name="alt_unit" defaultValue={p.alt_unit ?? ""} placeholder="pc" />
        </Field>
        <Field label={t.products.altFactor}>
          <input className="g-input" name="alt_factor" inputMode="decimal" defaultValue={p.alt_factor ?? ""} placeholder={t.products.altFactorPh} />
        </Field>
        <Field label={t.products.altPrice}>
          <input className="g-input" name="alt_price" inputMode="decimal" defaultValue={p.alt_price ?? ""} />
        </Field>
      </fieldset>
      {p.id && (
        <label className="flex items-center gap-2 self-end pb-2">
          <input type="checkbox" name="active" defaultChecked={p.active} className="size-4 accent-[var(--color-accent)]" />
          {t.products.stillSold}
        </label>
      )}
    </div>
  );
}
