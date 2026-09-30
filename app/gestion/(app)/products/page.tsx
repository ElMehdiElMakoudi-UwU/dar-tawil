import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/gestion/auth";
import { mad, pct, qty } from "@/lib/gestion/format";
import { getLists, getProducts, getProductsAdmin, type StaffProduct } from "@/lib/gestion/queries";
import { getT } from "@/lib/gestion/lang";
import { saveProduct } from "../../actions";
import { ActionForm, Submit } from "../../_components/forms";
import { Empty, PageHeader, Section, Stat } from "../../_components/ui";
import { ProductFields } from "./product-fields";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.products };
}

async function Status({ p }: { p: StaffProduct }) {
  const t = await getT();
  if (!p.active) return <span className="g-badge g-badge-muted">{t.products.archived}</span>;
  return p.in_stock <= p.reorder_level ? (
    <span className="g-badge g-badge-bad">{t.products.reorder}</span>
  ) : (
    <span className="g-badge g-badge-good">{t.products.ok}</span>
  );
}

export default async function ProductsPage() {
  const user = await requireUser();
  return user.role === "admin" ? <AdminProducts /> : <StaffProducts />;
}

async function StaffProducts() {
  const [products, t] = await Promise.all([getProducts(), getT()]);
  return (
    <>
      <PageHeader title={t.nav.products} sub={t.products.staffSub} />
      {products.length ? (
        <div className="g-table-wrap">
          <table className="g-table">
            <thead>
              <tr>
                <th>{t.common.sku}</th>
                <th>{t.common.product}</th>
                <th>{t.common.category}</th>
                <th className="num">{t.common.priceMad}</th>
                <th className="num">{t.common.inStock}</th>
                <th>{t.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={p.active ? "" : "g-muted"}>
                  <td className="font-medium">{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.category ?? "—"}</td>
                  <td className="num">{mad(p.price)}</td>
                  <td className="num">
                    {qty(p.in_stock)} <span className="g-muted text-xs">{p.unit}</span>
                  </td>
                  <td>
                    <Status p={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t.common.noProducts}</Empty>
      )}
    </>
  );
}

async function AdminProducts() {
  const [products, lists, t] = await Promise.all([getProductsAdmin(), getLists(), getT()]);
  const stockValue = products.reduce((s, p) => s + Math.max(p.stock_value, 0), 0);
  const toReorder = products.filter((p) => p.active && p.in_stock <= p.reorder_level).length;

  return (
    <>
      <PageHeader title={t.nav.products} sub={t.products.adminSub} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.common.stockValueMad} value={mad(stockValue)} />
        <Stat label={t.common.toReorder} value={toReorder} tone={toReorder ? "bad" : undefined} />
        <Stat label={t.products.revenueAll} value={mad(products.reduce((s, p) => s + p.revenue, 0))} />
        <Stat label={t.products.grossAll} value={mad(products.reduce((s, p) => s + p.profit, 0))} />
      </div>

      {products.length ? (
        <div className="g-table-wrap">
          <table className="g-table">
            <thead>
              <tr>
                <th>{t.common.sku}</th>
                <th>{t.common.product}</th>
                <th className="num">{t.common.cost}</th>
                <th className="num">{t.common.price}</th>
                <th className="num">{t.common.margin}</th>
                <th className="num">{t.common.inStock}</th>
                <th className="num">{t.products.stockValue}</th>
                <th className="num">{t.products.sold}</th>
                <th className="num">{t.common.revenue}</th>
                <th className="num">{t.common.profit}</th>
                <th>{t.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={p.active ? "" : "g-muted"}>
                  <td>
                    <Link href={`/gestion/products/${p.id}`} className="font-medium underline decoration-[var(--g-line)] underline-offset-4">
                      {p.sku}
                    </Link>
                  </td>
                  <td>
                    {p.name}
                    {p.category && <div className="g-muted text-xs">{p.category}</div>}
                  </td>
                  <td className="num">{mad(p.unit_cost)}</td>
                  <td className="num">{mad(p.price)}</td>
                  <td className="num">{p.price ? pct((p.price - p.unit_cost) / p.price) : "—"}</td>
                  <td className="num">{qty(p.in_stock)}</td>
                  <td className="num">{mad(p.stock_value)}</td>
                  <td className="num">{qty(p.sold)}</td>
                  <td className="num">{mad(p.revenue)}</td>
                  <td className={`num ${p.profit < 0 ? "g-neg" : ""}`}>{mad(p.profit)}</td>
                  <td>
                    <Status p={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t.products.emptyAdmin}</Empty>
      )}

      <Section title={t.products.addTitle}>
        <ActionForm action={saveProduct} className="g-card">
          <ProductFields categories={lists.product_category} />
          <div className="mt-4">
            <Submit>{t.products.addBtn}</Submit>
          </div>
        </ActionForm>
      </Section>
    </>
  );
}
