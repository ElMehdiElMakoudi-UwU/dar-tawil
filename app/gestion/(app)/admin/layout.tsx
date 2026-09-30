import { requireAdmin } from "@/lib/gestion/auth";

/** Bounces staff out of every /gestion/admin page (each page and action checks again). */
export default async function AdminLayout({ children }: LayoutProps<"/gestion/admin">) {
  await requireAdmin();
  return children;
}
