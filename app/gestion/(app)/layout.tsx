import { cookies } from "next/headers";
import { requireUser } from "@/lib/gestion/auth";
import { getT } from "@/lib/gestion/lang";
import { getDueOrderCount } from "@/lib/gestion/queries";
import { LangSwitch } from "../_components/lang-switch";
import { AppShell, type NavSection, type QuickAction } from "../_components/shell";

export default async function AppLayout({ children }: LayoutProps<"/gestion">) {
  const user = await requireUser();
  const [t, due, jar] = await Promise.all([getT(), getDueOrderCount(), cookies()]);
  const isAdmin = user.role === "admin";

  // Daily work first, then stock; the admin-only sections follow. Sub-menus
  // gather pages that belong to one job, so the top level stays short.
  const sections: NavSection[] = [
    {
      label: t.nav.secDaily,
      items: [
        { href: "/gestion", label: t.nav.today, icon: "today" },
        { href: "/gestion/pos", label: t.nav.till, icon: "till" },
        { href: "/gestion/orders", label: t.nav.orders, icon: "orders", badge: due },
        {
          id: "sales",
          label: t.nav.groupSales,
          icon: "receipt",
          children: [
            { href: "/gestion/sales/new", label: t.nav.newSale },
            { href: "/gestion/orders/new", label: t.nav.newOrder },
            { href: "/gestion/sales", label: t.nav.salesHistory },
          ],
        },
        { href: "/gestion/customers", label: t.nav.customers, icon: "users" },
      ],
    },
    {
      label: t.nav.secStock,
      items: [
        { href: "/gestion/products", label: t.nav.catalogProducts, icon: "package" },
        {
          id: "inventory",
          label: t.nav.inventory,
          icon: "boxes",
          children: [
            { href: "/gestion/stock", label: t.nav.stock },
            ...(isAdmin
              ? [
                  { href: "/gestion/stock-control", label: t.nav.stockControl },
                  { href: "/gestion/stock-control/tolerances", label: t.control.tolerances },
                ]
              : []),
          ],
        },
      ],
    },
  ];

  if (isAdmin) {
    sections.push(
      {
        label: t.nav.secManage,
        items: [
          { href: "/gestion/admin", label: t.nav.dashboard, icon: "dashboard" },
          {
            id: "reports",
            label: t.nav.reports,
            icon: "chart",
            children: [
              { href: "/gestion/admin/sales-report", label: t.nav.salesReport },
              { href: "/gestion/admin/period", label: t.nav.period },
            ],
          },
          {
            id: "finance",
            label: t.nav.groupFinance,
            icon: "wallet",
            children: [
              { href: "/gestion/admin/purchases", label: t.nav.purchases },
              { href: "/gestion/admin/expenses", label: t.nav.expenses },
              { href: "/gestion/admin/cash", label: t.nav.cash },
            ],
          },
        ],
      },
      {
        label: t.nav.secAdmin,
        items: [
          { href: "/gestion/admin/payroll", label: t.nav.payroll, icon: "briefcase" },
          {
            id: "website",
            label: t.nav.website,
            icon: "globe",
            children: [
              { href: "/gestion/admin/collections", label: t.nav.collections },
              { href: "/gestion/admin/collections/rubriques", label: t.catalog.sectionsTitle },
            ],
          },
          { href: "/gestion/admin/settings", label: t.nav.settings, icon: "settings" },
          { href: "/gestion/admin/export", label: t.nav.export, icon: "download" },
        ],
      },
    );
  }

  const quick: QuickAction[] = [
    { href: "/gestion/sales/new", label: t.nav.newSale, icon: "plus" },
    { href: "/gestion/pos", label: t.nav.till, icon: "till" },
    { href: "/gestion/orders/new", label: t.nav.newOrder, icon: "orders" },
  ];

  return (
    <AppShell
      sections={sections}
      quick={quick}
      user={{ name: user.name, email: user.email, role: t.roles[user.role] ?? user.role }}
      langSwitch={<LangSwitch />}
      initialCollapsed={jar.get("dt_nav")?.value === "1"}
    >
      {children}
    </AppShell>
  );
}
