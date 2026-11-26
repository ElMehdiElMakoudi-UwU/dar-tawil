export const locales = ["fr", "en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

export const localeNames: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  ar: "العربية",
};

/** Short label for the switcher. */
export const localeShort: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
  ar: "ع",
};

export const localeDir: Record<Locale, "ltr" | "rtl"> = {
  fr: "ltr",
  en: "ltr",
  ar: "rtl",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Canonical + hreflang links for one page. Each page must pass its own path:
 * a canonical inherited from the layout would point every page at the home
 * page, and Google would drop the others as duplicates of it.
 */
export function pageAlternates(lang: string, path = "") {
  return {
    canonical: `/${lang}${path}`,
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, `/${l}${path}`])),
      "x-default": `/${defaultLocale}${path}`,
    },
  };
}
