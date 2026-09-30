import type { Metadata } from "next";
import { Amiri, IBM_Plex_Sans_Arabic, Jost, Marcellus } from "next/font/google";
import { langDir } from "@/lib/gestion/i18n";
import { getLang } from "@/lib/gestion/lang";
import { LangProvider } from "./_components/i18n";
import "../globals.css";
import "./gestion.css";

/*
 * Its own root layout: the back office shares the site's fonts and colour
 * tokens but none of its chrome, locales or static rendering. Always the
 * "blanc" palette, whatever the public site runs in — tables of numbers need
 * the light ground. French or Arabic, from the dt_lang cookie; lang="ar"
 * swaps in the site's Arabic faces through globals.css.
 */

const marcellus = Marcellus({ subsets: ["latin"], weight: "400", variable: "--font-marcellus", display: "swap" });
const jost = Jost({ subsets: ["latin"], variable: "--font-jost", display: "swap" });
const amiri = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-amiri", display: "swap", preload: false });
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Gestion", template: "%s — Dar Tawil gestion" },
  robots: { index: false, follow: false },
  icons: { icon: "/brand/icon.png" },
};

export default async function GestionRootLayout({ children }: LayoutProps<"/gestion">) {
  const lang = await getLang();
  return (
    <html
      lang={lang}
      dir={langDir[lang]}
      data-palette="blanc"
      className={`${marcellus.variable} ${jost.variable} ${amiri.variable} ${plexArabic.variable}`}
    >
      <body className="g-shell min-h-dvh antialiased">
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
