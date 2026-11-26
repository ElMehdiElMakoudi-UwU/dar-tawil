import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales } from "@/lib/locales";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return;

  // French is always the default; other languages are reached via the switcher.
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  // Permanent (308): the locale prefix is fixed, so search engines should
  // replace "/" with "/fr" in their index instead of keeping both.
  return NextResponse.redirect(url, 308);
}

export const config = {
  // /gestion is the back office: outside the locale scheme (its FR/AR switch is a cookie).
  matcher: ["/((?!_next|api|gestion|brand|photos|favicon.ico|robots.txt|sitemap.xml).*)"],
};
