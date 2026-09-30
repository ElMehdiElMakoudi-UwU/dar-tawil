import Link from "next/link";
import type { Dictionary } from "@/content/fr";
import type { Locale } from "@/lib/locales";
import { site, whatsappLink } from "@/lib/site";
import { palette } from "@/lib/theme";
import { Ground } from "./ornament";
import { Mark, Wordmark } from "./mark";

export function Footer({ lang, t }: { lang: Locale; t: Dictionary }) {
  const nav = [
    { href: `/${lang}/maison`, label: t.nav.maison },
    { href: `/${lang}/collections`, label: t.nav.collections },
    { href: `/${lang}/contact`, label: t.nav.contact },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-or/20 bg-noir">
      <Ground
        id="ground-footer"
        className={`pointer-events-none absolute inset-0 ${
          palette === "blanc" ? "text-or/35" : "text-or/[0.05]"
        }`}
        scale={1.5}
        fade="up"
      />

      <div className="relative mx-auto max-w-[82rem] px-5 py-16 md:px-10 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10">
          <div>
            <div className="flex items-center gap-4">
              <Mark className="h-14 w-[2.6rem]" />
              <Wordmark size="md" />
            </div>
            <p className="mt-6 max-w-[34ch] text-sm leading-relaxed text-ivoire/55">
              {t.footer.tagline}
            </p>
          </div>

          <nav aria-label={t.footer.nav}>
            <h2 className="eyebrow">{t.footer.nav}</h2>
            <ul className="mt-5 space-y-3">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-ivoire/70 transition-colors hover:text-or-clair"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="eyebrow">{t.footer.contact}</h2>
            <address className="mt-5 space-y-3 text-sm not-italic text-ivoire/70">
              {t.visit.address.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>
                <a
                  href={site.phoneHref}
                  dir="ltr"
                  className="transition-colors hover:text-or-clair"
                >
                  {site.phoneDisplay}
                </a>
              </p>
              <p>
                <a
                  href={`mailto:${site.email}`}
                  className="transition-colors hover:text-or-clair"
                >
                  {site.email}
                </a>
              </p>
              <p className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                <a
                  href={whatsappLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="text-or transition-colors hover:text-or-clair"
                >
                  {t.contactPage.whatsapp}
                </a>
                <a
                  href={site.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="text-or transition-colors hover:text-or-clair"
                >
                  {t.contactPage.instagram}
                </a>
              </p>
            </address>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-or/12 pt-7 text-xs text-ivoire/35 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name}. {t.footer.rights}
          </p>
          <p>{t.footer.credits}</p>
        </div>
      </div>
    </footer>
  );
}
