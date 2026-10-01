import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/gestion/auth";
import { today } from "@/lib/gestion/format";
import { getT } from "@/lib/gestion/lang";
import { getCustomers, getLists, getProducts } from "@/lib/gestion/queries";
import { saveOrder } from "../../../actions";
import { ActionForm } from "../../../_components/forms";
import { PageHeader } from "../../../_components/ui";
import { OrderFields } from "../order-fields";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).prep.newTitle };
}

export default async function NewOrderPage() {
  await requireUser();
  const t = await getT();
  const [customers, lists, products] = await Promise.all([getCustomers(), getLists(), getProducts({ activeOnly: true })]);

  return (
    <>
      <PageHeader title={t.prep.newTitle} sub={t.prep.newSub}>
        <Link href="/gestion/orders" className="g-btn g-btn-ghost">
          {t.prep.back}
        </Link>
      </PageHeader>
      <ActionForm action={saveOrder} keep>
        <OrderFields
          // Only what the line editor needs: no costs are sent to the browser.
          products={products.map(({ id, sku, name, price, in_stock, unit, alt_unit, alt_factor, alt_price }) => ({ id, sku, name, price, in_stock, unit, alt_unit, alt_factor, alt_price }))}
          customers={customers.map(({ name, phone, city }) => ({ name, phone, city }))}
          channels={lists.channel}
          payments={lists.payment}
          today={today()}
        />
      </ActionForm>
    </>
  );
}
