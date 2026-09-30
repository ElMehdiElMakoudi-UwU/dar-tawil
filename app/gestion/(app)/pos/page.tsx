import type { Metadata } from "next";
import { requireUser } from "@/lib/gestion/auth";
import { today } from "@/lib/gestion/format";
import { getCustomers, getLists, getProducts } from "@/lib/gestion/queries";
import { getT } from "@/lib/gestion/lang";
import { Empty, PageHeader } from "../../_components/ui";
import { Till } from "./till";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).nav.till };
}

export default async function PosPage() {
  const user = await requireUser();
  const t = await getT();
  const [products, customers, lists] = await Promise.all([getProducts({ activeOnly: true }), getCustomers(), getLists()]);
  // Counter sales are "Shop" when that channel exists; otherwise the first one.
  const channel = lists.channel.find((c) => /shop|boutique|store|magasin|متجر|محل/i.test(c)) ?? lists.channel[0] ?? "";

  return (
    <>
      <PageHeader title={t.nav.till} sub={t.pos.sub} />
      {products.length ? (
        <Till
          // Only what the till needs: no costs are sent to the browser.
          products={products.map(({ id, sku, name, category, price, in_stock, unit, alt_unit, alt_factor, alt_price }) => ({ id, sku, name, category, price, in_stock, unit, alt_unit, alt_factor, alt_price }))}
          customers={customers.map((c) => c.name)}
          channel={channel}
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
