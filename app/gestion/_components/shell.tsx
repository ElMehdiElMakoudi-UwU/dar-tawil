"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fill } from "@/lib/gestion/i18n";
import { logout } from "../actions";
import { useT } from "./i18n";
import { Icon, type IconName } from "./icons";

/*
 * The back office's frame: a sidebar of sections (with fold-out sub-menus),
 * a top bar with breadcrumbs, search and the account menu, and a Ctrl+K
 * palette to jump anywhere. The menu itself is built on the server (it knows
 * the user's role) and handed in as plain data.
 */

export type NavLink = { href: string; label: string; icon: IconName; badge?: number };
export type NavParent = { id: string; label: string; icon: IconName; children: { href: string; label: string }[] };
export type NavItem = NavLink | NavParent;
export type NavSection = { label: string; items: NavItem[] };
export type QuickAction = { href: string; label: string; icon: IconName };

const isParent = (i: NavItem): i is NavParent => "children" in i;

type Crumb = { label: string; href?: string };
type Entry = { href: string; label: string; icon: IconName; context: string };

/** Every page in the menu, flattened, with where it sits ("Stock › Inventaire"). */
function flatten(sections: NavSection[]): Entry[] {
  return sections.flatMap((s) =>
    s.items.flatMap((i) =>
      isParent(i)
        ? i.children.map((c) => ({ href: c.href, label: c.label, icon: i.icon, context: `${s.label} › ${i.label}` }))
        : [{ href: i.href, label: i.label, icon: i.icon, context: s.label }],
    ),
  );
}

/** The longest menu link that prefixes the path wins, so /sales/new lights "New sale", not "Sales". */
function currentHref(pathname: string, entries: Entry[]) {
  return entries
    .map((e) => e.href)
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function AppShell({
  sections,
  quick,
  user,
  langSwitch,
  initialCollapsed,
  children,
}: {
  sections: NavSection[];
  quick: QuickAction[];
  user: { name: string; email: string; role: string };
  langSwitch: ReactNode;
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const pathname = usePathname();
  const entries = useMemo(() => flatten(sections), [sections]);
  const current = currentHref(pathname, entries);

  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `dt_nav=${next ? "1" : "0"}; path=/gestion; max-age=${365 * 86_400}; samesite=lax`;
      return next;
    });
  };

  // Ctrl/Cmd+K opens the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const crumbs = useMemo<Crumb[]>(() => {
    if (!current || current === "/gestion") return [{ label: t.nav.today }];
    for (const s of sections) {
      for (const i of s.items) {
        if (isParent(i)) {
          const c = i.children.find((c) => c.href === current);
          if (c) return [{ label: s.label }, { label: i.label }, { label: c.label, href: pathname === c.href ? undefined : c.href }];
        } else if (i.href === current) {
          return [{ label: s.label }, { label: i.label, href: pathname === i.href ? undefined : i.href }];
        }
      }
    }
    return [];
  }, [current, pathname, sections, t]);

  return (
    <div className="g-app" data-collapsed={collapsed || undefined} data-drawer={drawer || undefined}>
      <aside className="g-side" aria-label={t.nav.menu}>
        <div className="g-side-brand">
          <Link href="/gestion" className="g-side-logo" title="Dar Tawil">
            <span className="g-side-mark" aria-hidden>
              DT
            </span>
            <span className="g-side-name">
              <span className="g-side-title">Dar Tawil</span>
              <span className="g-side-tagline">{t.nav.brand}</span>
            </span>
          </Link>
          <button type="button" className="g-icon-btn lg:hidden" onClick={() => setDrawer(false)} aria-label={t.nav.close}>
            <Icon name="close" />
          </button>
        </div>

        <button type="button" className="g-side-search" onClick={() => setPalette(true)} title={t.nav.search}>
          <Icon name="search" className="size-4" />
          <span className="g-side-label flex-1 text-start">{t.nav.search}</span>
          <kbd className="g-side-label">Ctrl K</kbd>
        </button>

        <nav className="g-side-nav">
          {sections.map((s) => (
            <div key={s.label} className="g-side-section">
              <p className="g-side-heading">{s.label}</p>
              <ul>
                {s.items.map((i) => (
                  <li key={isParent(i) ? i.id : i.href}>
                    {isParent(i) ? (
                      <ParentItem item={i} current={current} pathname={pathname} />
                    ) : (
                      <Link
                        href={i.href}
                        className="g-side-link"
                        aria-current={i.href === current ? "page" : undefined}
                        title={collapsed ? i.label : undefined}
                      >
                        <Icon name={i.icon} />
                        <span className="g-side-label flex-1">{i.label}</span>
                        {!!i.badge && (
                          <span className="g-side-badge" title={fill(t.nav.dueBadge, { n: i.badge })}>
                            {i.badge}
                          </span>
                        )}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="g-side-foot">
          <button type="button" className="g-side-link g-side-collapse" onClick={toggleCollapsed} title={collapsed ? t.nav.expand : t.nav.collapse}>
            <Icon name="panel" className={collapsed ? "-scale-x-100 rtl:scale-x-100" : "rtl:-scale-x-100"} />
            <span className="g-side-label">{t.nav.collapse}</span>
          </button>
        </div>
      </aside>

      <div className="g-backdrop" onClick={() => setDrawer(false)} aria-hidden />

      <div className="g-main">
        <header className="g-top">
          <button type="button" className="g-icon-btn lg:hidden" onClick={() => setDrawer(true)} aria-label={t.nav.menu}>
            <Icon name="menu" />
          </button>
          <nav aria-label="Breadcrumb" className="g-crumbs">
            <Link href="/gestion" className="g-crumb-home" aria-label={t.nav.home}>
              <Icon name="today" className="size-4" />
            </Link>
            {crumbs.map((c, n) => (
              <span key={n} className="g-crumb">
                <Icon name="chevronRight" className="size-3.5 opacity-50 rtl:-scale-x-100" />
                {c.href ? (
                  <Link href={c.href}>{c.label}</Link>
                ) : (
                  <span aria-current={n === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
                )}
              </span>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-2">
            <button type="button" className="g-top-search" onClick={() => setPalette(true)}>
              <Icon name="search" className="size-4" />
              <span className="hidden md:inline">{t.nav.search}</span>
              <kbd className="hidden md:inline">Ctrl K</kbd>
            </button>
            {quick[0] && (
              <Link href={quick[0].href} className="g-btn g-btn-sm hidden sm:inline-flex">
                <Icon name="plus" className="size-4" />
                {quick[0].label}
              </Link>
            )}
            <UserMenu user={user} langSwitch={langSwitch} />
          </div>
        </header>

        <main className="g-content">{children}</main>
      </div>

      {palette && <Palette entries={entries} quick={quick} onClose={() => setPalette(false)} />}
    </div>
  );
}

function ParentItem({ item, current, pathname }: { item: NavParent; current?: string; pathname: string }) {
  const active = item.children.some((c) => c.href === current);
  const [open, setOpen] = useState(active);
  // Navigating into a group opens it; leaving does not close it.
  useEffect(() => {
    if (active) setOpen(true);
  }, [active, pathname]);
  const id = `g-sub-${item.id}`;
  return (
    <div className="g-side-parent" data-active={active || undefined}>
      <button
        type="button"
        className="g-side-link"
        aria-expanded={open}
        aria-controls={id}
        data-active={active || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={item.icon} />
        <span className="g-side-label flex-1 text-start">{item.label}</span>
        <Icon name="chevron" className={`g-side-label size-4 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <ul id={id} className="g-side-sub" data-open={open || undefined}>
        <li className="g-side-flyhead">{item.label}</li>
        {item.children.map((c) => (
          <li key={c.href}>
            <Link href={c.href} aria-current={c.href === current ? "page" : undefined}>
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function UserMenu({ user, langSwitch }: { user: { name: string; email: string; role: string }; langSwitch: ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="g-user-btn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <span className="g-avatar">{initials(user.name)}</span>
        <span className="hidden text-start leading-tight md:block">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="g-muted block text-xs">{user.role}</span>
        </span>
        <Icon name="chevron" className="hidden size-4 opacity-60 md:block" />
      </button>
      {open && (
        <div className="g-menu" role="menu">
          <div className="flex items-center gap-3 px-3 pt-2 pb-3">
            <span className="g-avatar g-avatar-lg">{initials(user.name)}</span>
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name}</p>
              <p className="g-muted truncate text-xs">{user.email}</p>
              <span className="g-badge g-badge-gold mt-1">{user.role}</span>
            </div>
          </div>
          <div className="g-menu-sep" />
          <div className="px-3 py-2">
            <p className="g-label">{t.lang}</p>
            {langSwitch}
          </div>
          <div className="g-menu-sep" />
          <form action={logout}>
            <button className="g-menu-item text-[var(--g-bad)]" role="menuitem">
              <Icon name="signOut" className="size-4 rtl:-scale-x-100" />
              {t.nav.signOut}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Palette({ entries, quick, onClose }: { entries: Entry[]; quick: QuickAction[]; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const groups = useMemo(() => {
    const f = fold(q.trim());
    const match = (s: string) => !f || fold(s).includes(f);
    const qa = quick.filter((a) => match(a.label)).map((a) => ({ ...a, context: t.nav.quick }));
    const pg = entries.filter((e) => match(e.label) || match(e.context));
    return [
      { title: t.nav.quick, items: qa },
      { title: t.nav.pages, items: pg },
    ].filter((g) => g.items.length);
  }, [q, entries, quick, t]);
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  let idx = -1;
  return (
    <div className="g-palette-wrap" onMouseDown={onClose}>
      <div className="g-palette" role="dialog" aria-modal aria-label={t.nav.search} onMouseDown={(e) => e.stopPropagation()}>
        <div className="g-palette-input">
          <Icon name="search" className="g-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.nav.searchPlaceholder}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, flat.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && flat[sel]) {
                e.preventDefault();
                go(flat[sel].href);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul ref={listRef} className="g-palette-list">
          {groups.map((g) => (
            <li key={g.title}>
              <p className="g-palette-group">{g.title}</p>
              <ul>
                {g.items.map((it) => {
                  idx++;
                  const i = idx;
                  return (
                    <li key={g.title + it.href}>
                      <button
                        type="button"
                        data-idx={i}
                        data-selected={i === sel || undefined}
                        className="g-palette-item"
                        onMouseMove={() => setSel(i)}
                        onClick={() => go(it.href)}
                      >
                        <span className="g-palette-icon">
                          <Icon name={it.icon} className="size-4" />
                        </span>
                        <span className="flex-1 text-start">{it.label}</span>
                        <span className="g-muted text-xs">{it.context}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {!flat.length && <li className="g-muted px-4 py-8 text-center text-sm">{t.nav.noResults}</li>}
        </ul>
        <div className="g-palette-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> {t.nav.navigate}
          </span>
          <span>
            <kbd>↵</kbd> {t.nav.open}
          </span>
        </div>
      </div>
    </div>
  );
}
