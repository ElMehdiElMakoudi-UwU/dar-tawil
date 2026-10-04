import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/gestion/auth";
import { fill } from "@/lib/gestion/i18n";
import { getT } from "@/lib/gestion/lang";
import { getCustomers, getLists, getProducts, getSale } from "@/lib/gestion/queries";
import { PageHeader } from "../../../../_components/ui";
import { SaleForm } from "../../new/sale-form";

export async function generateMetadata({ params }: PageProps<"/gestion/sales/[no]/edit">): Promise<Metadata> {
  return { title: fill((await getT()).sale.editTitle, { no: decodeURIComponent((await params).no) }) };
}

/** The save re-checks who may edit what (updateSale); this page just offers the form. */
export default async function EditSalePage({ params }: PageProps<"/gestion/sales/[no]/edit">) {
  await requireUser();
  const sale = await getSale(decodeURIComponent((await params).no));
  if (!sale || sale.return_of_no) notFound();
  const [t, products, customers, lists] = await Promise.all([getT(), getProducts(), getCustomers(), getLists()]);
  // Archived products stay pickable only when the sale already has them.
  const used = new Set(sale.lines.map((l) => l.product_id));

  return (
    <>
      <PageHeader title={fill(t.sale.editTitle, { no: sale.no })} sub={t.sale.editSub}>
        <Link href={`/gestion/sales/${sale.no}`} className="g-btn g-btn-ghost">
          {t.sale.backToSale}
        </Link>
      </PageHeader>
      <SaleForm
        // Only what the form needs: no costs are sent to the browser.
        products={products
          .filter((p) => p.active || used.has(p.id))
          .map(({ id, sku, name, price, in_stock, unit, alt_unit, alt_factor, alt_price }) => ({ id, sku, name, price, in_stock, unit, alt_unit, alt_factor, alt_price }))}
        customers={customers.map((c) => c.name)}
        channels={lists.channel}
        payments={lists.payment}
        today={sale.date}
        sale={{
          no: sale.no,
          customer: sale.customer,
          channel: sale.channel,
          payment: sale.payment,
          paid: sale.paid,
          lines: sale.lines.map((l) => ({ productId: l.product_id, qty: l.qty, unitPrice: l.unit_price, discount: l.discount_pct, alt: l.alt })),
        }}
      />
    </>
  );
}
