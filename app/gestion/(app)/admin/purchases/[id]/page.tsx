import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/gestion/auth";
import { dayLabel, today } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { getProductsAdmin, getPurchase, getSuppliers } from "@/lib/gestion/queries";
import { PageHeader } from "../../../../_components/ui";
import { PurchaseForm } from "../purchase-form";

export async function generateMetadata({ params }: PageProps<"/gestion/admin/purchases/[id]">): Promise<Metadata> {
  const purchase = await getPurchase(Number((await params).id));
  return { title: purchase ? fill((await getT()).purchases.editTitle, { date: dayLabel(purchase.date, await getLang()) }) : undefined };
}

export default async function EditPurchasePage({ params }: PageProps<"/gestion/admin/purchases/[id]">) {
  await requireAdmin();
  const purchase = await getPurchase(Number((await params).id));
  if (!purchase) notFound();
  const [products, suppliers, lang, t] = await Promise.all([getProductsAdmin(), getSuppliers(), getLang(), getT()]);
  const used = new Set(purchase.lines.map((l) => l.productId));

  return (
    <>
      <PageHeader title={fill(t.purchases.editTitle, { date: dayLabel(purchase.date, lang) })} sub={purchase.supplier ?? undefined}>
        <Link href="/gestion/admin/purchases" className="g-btn g-btn-ghost">
          {t.purchases.back}
        </Link>
      </PageHeader>
      <PurchaseForm
        // A product retired since stays pickable on the lines that already use it.
        products={products.filter((p) => p.active || used.has(p.id)).map(({ id, sku, name, unit, unit_cost }) => ({ id, sku, name, unit, unit_cost }))}
        suppliers={suppliers}
        today={today()}
        purchase={purchase}
      />
    </>
  );
}
