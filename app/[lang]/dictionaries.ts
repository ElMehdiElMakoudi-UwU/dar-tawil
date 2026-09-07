import { notFound } from "next/navigation";
import type { Dictionary } from "@/content/fr";
import { isLocale } from "@/lib/locales";

const dictionaries = {
  fr: () => import("@/content/fr").then((m) => m.fr),
  en: () => import("@/content/en").then((m) => m.en),
  ar: () => import("@/content/ar").then((m) => m.ar),
} as const;

export async function getDictionary(lang: string): Promise<Dictionary> {
  if (!isLocale(lang)) notFound();
  return dictionaries[lang]();
}
