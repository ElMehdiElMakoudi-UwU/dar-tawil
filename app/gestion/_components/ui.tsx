import Link from "next/link";
import type { ReactNode } from "react";
import { monthLabel, shiftMonth } from "@/lib/gestion/format";
import { getLang, getT } from "@/lib/gestion/lang";

export function PageHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        {sub && <p className="g-muted mt-1 text-sm">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "bad" | "good" }) {
  return (
    <div className="g-card">
      <p className="g-label">{label}</p>
      <p
        className={`text-xl font-medium tabular-nums sm:text-2xl ${tone === "bad" ? "text-[var(--g-bad)]" : tone === "good" ? "text-[var(--g-good)]" : ""}`}
      >
        {value}
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

/** ‹ September 2026 › — prev/next month links that keep the page's path. */
export async function MonthNav({ month, path }: { month: string; path: string }) {
  const [lang, t] = await Promise.all([getLang(), getT()]);
  return (
    <nav className="flex items-center gap-1" aria-label={t.common.month}>
      <Link className="g-btn g-btn-ghost g-btn-sm" href={`${path}?month=${shiftMonth(month, -1)}`} aria-label={t.common.prevMonth}>
        ‹
      </Link>
      <span className="min-w-36 text-center font-medium">{monthLabel(month, lang)}</span>
      <Link className="g-btn g-btn-ghost g-btn-sm" href={`${path}?month=${shiftMonth(month, 1)}`} aria-label={t.common.nextMonth}>
        ›
      </Link>
    </nav>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="g-panel g-muted text-sm">{children}</p>;
}

export async function Paid({ paid }: { paid: boolean }) {
  const t = await getT();
  return <span className={`g-badge ${paid ? "g-badge-good" : "g-badge-bad"}`}>{paid ? t.common.paid : t.common.unpaid}</span>;
}
