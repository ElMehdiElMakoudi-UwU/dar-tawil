import Link from "next/link";
import { requireUser } from "@/lib/gestion/auth";
import { getT } from "@/lib/gestion/lang";
import { logout } from "../actions";
import { LangSwitch } from "../_components/lang-switch";
import { Icon } from "../_components/icons";
import { Nav, type NavEntry } from "../_components/nav";

export default async function AppLayout({ children }: LayoutProps<"/gestion">) {
  const user = await requireUser();
  const t = await getT();

  // Daily tools stay one click away; the rest folds into groups.
  const main: NavEntry[] = [
    { href: "/gestion", label: t.nav.today, icon: "today" },
    { href: "/gestion/pos", label: t.nav.till, icon: "till" },
    {
      label: t.nav.groupSales,
      icon: "bag",
      items: [
        { href: "/gestion/orders", label: t.nav.orders, icon: "orders" },
        { href: "/gestion/sales/new", label: t.nav.newSale, icon: "plus" },
        { href: "/gestion/sales", label: t.nav.salesHistory, icon: "receipt" },
      ],
    },
    {
      label: t.nav.groupCatalog,
      icon: "tag",
      items: [
        { href: "/gestion/products", label: t.nav.products, icon: "package" },
        { href: "/gestion/customers", label: t.nav.customers, icon: "users" },
      ],
    },
  ];
  const admin: NavEntry[] | null =
    user.role === "admin"
      ? [
          { href: "/gestion/admin", label: t.nav.dashboard, icon: "dashboard" },
          {
            label: t.nav.groupFinance,
            icon: "wallet",
            items: [
              { href: "/gestion/admin/purchases", label: t.nav.purchases, icon: "cart" },
              { href: "/gestion/admin/expenses", label: t.nav.expenses, icon: "expense" },
              { href: "/gestion/admin/cash", label: t.nav.cash, icon: "bank" },
            ],
          },
          {
            label: t.nav.groupTeam,
            icon: "sliders",
            items: [
              { href: "/gestion/admin/payroll", label: t.nav.payroll, icon: "briefcase" },
              { href: "/gestion/admin/settings", label: t.nav.settings, icon: "userCog" },
            ],
          },
        ]
      : null;

  return (
    <div className="lg:flex">
      <aside className="relative border-b border-[var(--g-line)] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-e lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-4 lg:py-6">
          <Link href="/gestion" className="block">
            <span className="block font-[family-name:var(--font-display)] text-xl">Dar Tawil</span>
            <span className="eyebrow">{t.nav.brand}</span>
          </Link>
          <div className="lg:mt-8">
            <Nav main={main} admin={admin} />
          </div>
        </div>
        <div className="hidden px-4 pt-4 pb-6 lg:mt-auto lg:block">
          <UserBox name={user.name} role={t.roles[user.role]} signOut={t.nav.signOut} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">{children}</main>
        <div className="border-t border-[var(--g-line)] px-4 py-4 lg:hidden">
          <UserBox name={user.name} role={t.roles[user.role]} signOut={t.nav.signOut} />
        </div>
      </div>
    </div>
  );
}

function UserBox({ name, role, signOut }: { name: string; role: string; signOut: string }) {
  return (
    <div className="space-y-3">
      <LangSwitch />
      <div className="flex items-center justify-between gap-2 text-sm">
        <div>
          <p className="font-medium">{name}</p>
          <p className="g-muted text-xs">{role}</p>
        </div>
        <form action={logout}>
          <button className="g-btn g-btn-ghost g-btn-sm">
            <Icon name="signOut" className="size-4 rtl:-scale-x-100" />
            {signOut}
          </button>
        </form>
      </div>
    </div>
  );
}
