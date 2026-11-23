import Link from "next/link";
import type { ReactNode } from "react";
import { monthLabel, shiftMonth } from "@/lib/gestion/format";
import { getLang, getT } from "@/lib/gestion/lang";

export function PageHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="g-page-head flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-[1.7rem]">{title}</h1>
        {sub && <p className="g-muted mt-1 max-w-3xl text-sm">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base sm:text-lg">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "bad" | "good" }) {
  return (
    <div className="g-card g-stat" data-tone={tone}>
      <p className="g-label">{label}</p>
      <p
        className={`text-xl font-semibold tracking-tight tabular-nums sm:text-2xl ${tone === "bad" ? "text-[var(--g-bad)]" : tone === "good" ? "text-[var(--g-good)]" : ""}`}
      >
        {/* Amounts read left to right in Arabic too, so "-72.00" keeps its minus in front. */}
        <bdi dir="ltr">{value}</bdi>
      </p>
      {note && <p className="g-muted mt-0.5 text-xs">{note}</p>}
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="g-label">{label}</span>
      {children}
    </label>
  );
}

export function Select({
  name,
  options,
  defaultValue,
  required,
  blank = "—",
}: {
  name: string;
  options: readonly (string | { value: string | number; label: string })[];
  defaultValue?: string | number | null;
  required?: boolean;
  blank?: string | false;
}) {
  return (
    <select name={name} className="g-input" defaultValue={defaultValue ?? ""} required={required}>
      {blank !== false && <option value="">{blank}</option>}
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}

/** ‹ September 2026 › — prev/next month links that keep the page's path (and any other `params`). */
export async function MonthNav({ month, path, params = {} }: { month: string; path: string; params?: Record<string, string> }) {
  const [lang, t] = await Promise.all([getLang(), getT()]);
  const href = (m: string) => `${path}?${new URLSearchParams({ ...params, month: m })}`;
  return (
    <nav className="flex items-center gap-1" aria-label={t.common.month}>
      <Link className="g-btn g-btn-ghost g-btn-sm" href={href(shiftMonth(month, -1))} aria-label={t.common.prevMonth}>
        ‹
      </Link>
      <span className="min-w-36 text-center font-medium">{monthLabel(month, lang)}</span>
      <Link className="g-btn g-btn-ghost g-btn-sm" href={href(shiftMonth(month, 1))} aria-label={t.common.nextMonth}>
        ›
      </Link>
    </nav>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="g-empty">{children}</p>;
}

export async function Paid({ paid }: { paid: boolean }) {
  const t = await getT();
  return <span className={`g-badge ${paid ? "g-badge-good" : "g-badge-bad"}`}>{paid ? t.common.paid : t.common.unpaid}</span>;
}
