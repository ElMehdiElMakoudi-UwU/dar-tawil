import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/gestion/auth";
import { getLists, getProductAdmin } from "@/lib/gestion/queries";
import { getT } from "@/lib/gestion/lang";
import { saveProduct } from "../../../actions";
import { ActionForm, Submit } from "../../../_components/forms";
import { PageHeader } from "../../../_components/ui";
import { ProductFields } from "../product-fields";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).products.editTitle };
}

export default async function EditProductPage({ params }: PageProps<"/gestion/products/[id]">) {
  await requireAdmin();
  const product = await getProductAdmin(Number((await params).id));
  if (!product) notFound();
  const [lists, t] = await Promise.all([getLists(), getT()]);

  return (
    <>
      <PageHeader title={product.name} sub={t.products.editSub}>
        <Link href="/gestion/products" className="g-btn g-btn-ghost">
          {t.products.back}
        </Link>
      </PageHeader>
      <ActionForm action={saveProduct} keep className="g-card">
        <ProductFields p={product} categories={lists.product_category} />
        <div className="mt-4">
          <Submit>{t.products.saveChanges}</Submit>
        </div>
      </ActionForm>
    </>
  );
}
