"use client";

import { createContext, useContext, type ReactNode } from "react";
import { defaultLang, dictionaries, type Lang } from "@/lib/gestion/i18n";

const LangContext = createContext<Lang>(defaultLang);

/** Hands the cookie's language, read once in the root layout, to client components. */
export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext value={lang}>{children}</LangContext>;
}

export const useLang = () => useContext(LangContext);
export const useT = () => dictionaries[useLang()];
