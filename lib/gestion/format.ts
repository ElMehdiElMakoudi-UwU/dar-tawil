/** Formatting and date helpers shared by server pages and client forms. */

import type { Lang } from "./i18n";

const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

export const mad = (n: number | null | undefined) => (n == null ? "—" : money.format(n));
export const qty = (n: number | null | undefined) => (n == null ? "—" : whole.format(n));
export const pct = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(1)}%`;

/** Today's date in Morocco, as YYYY-MM-DD. */
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date());
}

/** "2026-09" style month key; defaults to the current month. */
export function monthOf(date = today()) {
  return date.slice(0, 7);
}

/** Accepts a ?month=YYYY-MM search param, falling back to this month. */
export function parseMonth(value: string | string[] | undefined) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : monthOf();
}

/** First and last day of a YYYY-MM month. */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Moroccan Arabic month names (يناير، ماي، يوليوز، غشت…) with Latin digits,
// as on the shop's receipts.
const dateLocale: Record<Lang, string> = { fr: "fr-FR", ar: "ar-MA-u-nu-latn" };

function utc(date: string) {
  const [y, m, d = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function monthLabel(month: string, lang: Lang) {
  return utc(month).toLocaleDateString(dateLocale[lang], { month: "long", year: "numeric", timeZone: "UTC" });
}

/** "28 sept." — a day within the month or year on screen. */
export function dayLabel(date: string, lang: Lang) {
  return utc(date).toLocaleDateString(dateLocale[lang], { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "28 sept. 2026" */
export function dateLabel(date: string, lang: Lang) {
  return utc(date).toLocaleDateString(dateLocale[lang], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Short month name for 1–12. */
export function monthName(m: number, lang: Lang) {
  return utc(`2000-${String(m).padStart(2, "0")}`).toLocaleDateString(dateLocale[lang], { month: "short", timeZone: "UTC" });
}
