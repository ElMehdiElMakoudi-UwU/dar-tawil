import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { defaultLang, dictionaries, isLang, type Lang } from "./i18n";

/** The back office's language lives in a cookie: one setting per device, French by default. */
export const LANG_COOKIE = "dt_lang";

export const getLang = cache(async (): Promise<Lang> => {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : defaultLang;
});

export const getT = cache(async () => dictionaries[await getLang()]);
