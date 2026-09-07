"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { localeShort, locales, type Locale } from "@/lib/locales";
import { Mark, Wordmark } from "./mark";

type NavItem = { href: string; label: string };

export function Header({
  lang,
  items,
  labels,
}: {
  lang: Locale;
  items: NavItem[];
  labels: { menu: string; close: string; language: string };
}) {
  const pathname = usePathname();
  const [lifted, setLifted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  /** Same page, other language. */
  const swap = (next: Locale) => {
    const rest = pathname.split("/").slice(2).join("/");
    return `/${next}${rest ? `/${rest}` : ""}`;
  };

  const isCurrent = (href: string) =>
    href === `/${lang}` ? pathname === href : pathname.startsWith(href);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        lifted || open
          ? "bg-noir/92 backdrop-blur-md border-b border-or/15"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-[82rem] items-center justify-between gap-6 px-5 md:h-20 md:px-10">
        <Link
          href={`/${lang}`}
          className="flex items-center gap-3 py-2"
          aria-label={`${"Dar Tawil"} — accueil`}
        >
          <Mark className="h-9 w-[1.68rem] md:h-10 md:w-[1.86rem]" />
          <Wordmark size="sm" className="hidden sm:inline" />
        </Link>

        <nav className="hidden items-center gap-9 md:flex" aria-label="Principal">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item.href) ? "page" : undefined}
              className={`relative py-1 text-[0.8rem] font-medium uppercase tracking-[0.16em] transition-colors ${
                isCurrent(item.href)
                  ? "text-or-clair"
                  : "text-ivoire/70 hover:text-or-clair"
              }`}
            >
              {item.label}
              <span
                className={`absolute -bottom-0.5 left-0 h-px w-full origin-left bg-or transition-transform duration-500 ${
                  isCurrent(item.href) ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ul className="flex items-center gap-1.5" aria-label={labels.language}>
            {locales.map((code) => (
              <li key={code}>
                <Link
                  href={swap(code)}
                  hrefLang={code}
                  aria-current={code === lang ? "true" : undefined}
                  className={`block px-1.5 py-1 text-[0.72rem] font-medium tracking-[0.14em] transition-colors ${
                    code === lang
                      ? "text-or-clair"
                      : "text-ivoire/45 hover:text-or-clair"
                  }`}
                >
                  {localeShort[code]}
                </Link>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            className="ms-2 inline-flex h-10 w-10 items-center justify-center text-or-clair md:hidden"
          >
            <span className="sr-only">{open ? labels.close : labels.menu}</span>
            <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden>
              <path
                d={open ? "M2 2 L20 12 M20 2 L2 12" : "M0 1 H22 M0 7 H22 M0 13 H22"}
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </svg>
          </button>
        </div>
      </div>

      <div
        id="menu-mobile"
        hidden={!open}
        className="border-t border-or/15 bg-noir md:hidden"
      >
        <nav className="px-5 py-4" aria-label="Principal">
          <ul className="divide-y divide-or/10">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block py-4 font-display text-2xl text-ivoire"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
