"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "./i18n";
import { Icon, type IconName } from "./icons";

type Item = { href: string; label: string; icon: IconName };
type Group = { label: string; icon: IconName; items: Item[] };
export type NavEntry = Item | Group;

const isGroup = (e: NavEntry): e is Group => "items" in e;
const hrefs = (entries: NavEntry[]) => entries.flatMap((e) => (isGroup(e) ? e.items : [e])).map((i) => i.href);

/** Sidebar on wide screens; a collapsible menu under the top bar on phones. */
export function Nav({ main, admin }: { main: NavEntry[]; admin: NavEntry[] | null }) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  // The longest link that prefixes the path wins, so /sales/new lights up
  // "New sale" and not "Sales" as well.
  const current = [...hrefs(main), ...hrefs(admin ?? [])]
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === current;
  const holdsCurrent = (g: Group) => g.items.some((i) => isActive(i.href));

  // A group starts open when it holds the current page; clicks override that
  // until the next navigation, so the sidebar folds back to just what matters.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  useEffect(() => setToggled({}), [pathname]);

  const link = (i: Item, nested = false) => (
    <Link
      href={i.href}
      aria-current={isActive(i.href) ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-[7px] px-3 ${nested ? "g-nav-sub py-1.5 text-sm" : "py-2"}`}
    >
      <Icon name={i.icon} className={nested ? "size-4" : ""} />
      <span>{i.label}</span>
    </Link>
  );

  const group = (g: Group) => {
    const id = `g-nav-${g.icon}`;
    const active = holdsCurrent(g);
    const isOpen = toggled[g.label] ?? active;
    return (
      <>
        <button
          type="button"
          className="g-nav-group flex w-full cursor-pointer items-center gap-2.5 rounded-[7px] px-3 py-2"
          aria-expanded={isOpen}
          aria-controls={id}
          data-active={active || undefined}
          onClick={() => setToggled((s) => ({ ...s, [g.label]: !isOpen }))}
        >
          <Icon name={g.icon} />
          <span className="flex-1 text-start">{g.label}</span>
          <Icon name="chevron" className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        <ul id={id} hidden={!isOpen} className="g-nav-children ms-[1.32rem] mt-0.5 mb-1.5 space-y-0.5 border-s border-[var(--g-line)] ps-2">
          {g.items.map((i) => (
            <li key={i.href}>{link(i, true)}</li>
          ))}
        </ul>
      </>
    );
  };

  const list = (entries: NavEntry[]) => (
    <ul className="space-y-0.5">
      {entries.map((e) => (
        <li key={isGroup(e) ? e.label : e.href}>{isGroup(e) ? group(e) : link(e)}</li>
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
        <Icon name={open ? "close" : "menu"} className="size-4" />
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
