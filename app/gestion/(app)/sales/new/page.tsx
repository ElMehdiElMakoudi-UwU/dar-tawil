import type { Metadata } from "next";
import { requireUser } from "@/lib/gestion/auth";
import { today } from "@/lib/gestion/format";
import { getCustomers, getLists, getProducts } from "@/lib/gestion/queries";
import { getT } from "@/lib/gestion/lang";
import { Empty, PageHeader } from "../../../_components/ui";
import { SaleForm } from "./sale-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.newSale };
}

export default async function NewSalePage() {
  const user = await requireUser();
  const t = await getT();
  const [products, customers, lists] = await Promise.all([getProducts({ activeOnly: true }), getCustomers(), getLists()]);

  return (
    <>
      <PageHeader title={t.nav.newSale} sub={t.sales.newSub} />
      {products.length ? (
        <SaleForm
          // Only what the till needs: no costs are sent to the browser.
          products={products.map(({ id, sku, name, price, in_stock, unit, alt_unit, alt_factor, alt_price }) => ({ id, sku, name, price, in_stock, unit, alt_unit, alt_factor, alt_price }))}
          customers={customers.map((c) => c.name)}
          channels={lists.channel}
          payments={lists.payment}
          today={today()}
        />
      ) : (
        <Empty>
          {t.common.noProducts} {user.role === "admin" ? t.common.addProductsFirst : t.common.askAdmin}
        </Empty>
      )}
    </>
  );
}
