import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/gestion/auth";
import { today } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getT } from "@/lib/gestion/lang";
import { getCustomers, getLists, getProducts, getOrder } from "@/lib/gestion/queries";
import { saveOrder } from "../../../actions";
import { ActionForm } from "../../../_components/forms";
import { PageHeader } from "../../../_components/ui";
import { OrderFields } from "../order-fields";

export async function generateMetadata({ params }: PageProps<"/gestion/orders/[id]">): Promise<Metadata> {
  const order = await getOrder(Number((await params).id));
  return { title: order ? fill((await getT()).prep.editTitle, { no: order.no }) : undefined };
}

export default async function EditOrderPage({ params }: PageProps<"/gestion/orders/[id]">) {
  await requireUser();
  const order = await getOrder(Number((await params).id));
  if (!order) notFound();
  const [t, customers, lists, products] = await Promise.all([getT(), getCustomers(), getLists(), getProducts({ activeOnly: true })]);

  return (
    <>
      <PageHeader title={fill(t.prep.editTitle, { no: order.no })} sub={`${t.prep.statuses[order.status]} · ${order.created_by ?? "—"}`}>
        <Link href="/gestion/orders" className="g-btn g-btn-ghost">
          {t.prep.back}
        </Link>
      </PageHeader>
      <ActionForm action={saveOrder} keep>
        <OrderFields
          o={order}
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
