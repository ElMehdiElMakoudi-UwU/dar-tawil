import type { Metadata } from "next";
import { Amiri, Great_Vibes, IBM_Plex_Sans_Arabic, Jost, Marcellus } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Intro } from "@/components/intro";
import { ArchClipDefs } from "@/components/ornament";
import { RevealOnScroll } from "@/components/reveal";
import { locales, localeDir, type Locale } from "@/lib/locales";
import { site } from "@/lib/site";
import { indexable } from "@/lib/env";
import { palette } from "@/lib/theme";
import { getDictionary } from "./dictionaries";
import "../globals.css";

/* Inscriptional Roman caps against a geometric deco sans — the carved arch and
   the painted deco shopfront, which is the register this brand sits in. */
const marcellus = Marcellus({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-marcellus",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});

/* The script the name is printed in on the boxes — wordmark only. */
const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
  preload: false,
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const t = await getDictionary(lang);

  return {
    metadataBase: new URL(site.url),
    title: { default: t.meta.title, template: `%s — ${site.name}` },
    description: t.meta.description,
    alternates: {
      canonical: `/${lang}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
    icons: { icon: "/brand/icon.png", apple: "/brand/icon.png" },
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: site.name,
      title: t.meta.title,
      description: t.meta.description,
      locale: lang,
      images: [{ url: "/brand/logo-gold.png", alt: t.meta.ogAlt }],
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  const t = await getDictionary(lang);
  const locale = lang as Locale;

  const nav = [
    { href: `/${locale}/maison`, label: t.nav.maison },
    { href: `/${locale}/collections`, label: t.nav.collections },
    { href: `/${locale}/contact`, label: t.nav.contact },
  ];

  return (
    <html
      lang={locale}
      dir={localeDir[locale]}
      data-palette={palette}
      // the intro's inline script adds `intro` to the class list before hydration
      suppressHydrationWarning
      className={`${marcellus.variable} ${jost.variable} ${greatVibes.variable} ${amiri.variable} ${plexArabic.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <ArchClipDefs />
        <Intro />
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:bg-ivoire focus:px-4 focus:py-2 focus:text-noir"
        >
          {t.ui.skip}
        </a>
        <Header
          lang={locale}
          items={nav}
          labels={{ menu: t.nav.menu, close: t.nav.close, language: t.nav.language }}
        />
        <main id="contenu">{children}</main>
        <Footer lang={locale} t={t} />
        <RevealOnScroll />
      </body>
    </html>
  );
}
