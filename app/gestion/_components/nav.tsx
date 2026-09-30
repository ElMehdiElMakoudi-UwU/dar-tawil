"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "./i18n";

type Item = { href: string; label: string };

/** Sidebar on wide screens; a collapsible menu under the top bar on phones. */
export function Nav({ main, admin }: { main: Item[]; admin: Item[] | null }) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  // The longest link that prefixes the path wins, so /sales/new lights up
  // "New sale" and not "Sales" as well.
  const current = [...main, ...(admin ?? [])]
    .map((i) => i.href)
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === current;

  const list = (items: Item[]) => (
    <ul className="space-y-0.5">
      {items.map((i) => (
        <li key={i.href}>
          <Link href={i.href} aria-current={isActive(i.href) ? "page" : undefined}>
            {i.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <button
        type="button"
        className="g-btn g-btn-ghost g-btn-sm lg:hidden"
        aria-expanded={open}
        aria-controls="g-nav"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? t.nav.close : t.nav.menu}
      </button>
      <nav
        id="g-nav"
        className={`g-nav ${open ? "block" : "hidden"} absolute inset-x-0 top-full z-20 border-b border-[var(--g-line)] bg-[var(--color-noir)] p-3 lg:static lg:block lg:border-0 lg:p-0`}
      >
        {list(main)}
        {admin && (
          <>
            <p className="eyebrow mt-6 mb-2 px-3">{t.nav.admin}</p>
            {list(admin)}
          </>
        )}
      </nav>
    </>
  );
}
