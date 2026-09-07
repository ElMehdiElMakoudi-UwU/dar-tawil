import Link from "next/link";
import type { ReactNode } from "react";

export function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`px-5 py-24 md:px-10 md:py-32 ${className}`}>
      <div className="mx-auto max-w-[82rem]">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function Title({
  children,
  className = "",
  as: Tag = "h2",
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <Tag
      className={`monument text-[clamp(2rem,4.6vw,3.4rem)] text-ivoire ${className}`}
    >
      {children}
    </Tag>
  );
}

export function Lede({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`max-w-[54ch] text-[1.02rem] leading-[1.75] text-pretty text-ivoire/65 ${className}`}
    >
      {children}
    </p>
  );
}

/** Filled gold button — one per screen, reserved for the primary move. */
export function CtaPrimary({
  href,
  children,
  external,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  const className =
    "cta-primary group inline-flex items-center gap-3 bg-or px-8 py-4 text-[0.78rem] font-medium uppercase tracking-[0.2em] text-noir transition-colors duration-300 hover:bg-or-clair";
  const inner = (
    <>
      {children}
      <span
        aria-hidden
        className="transition-transform duration-300 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180"
      >
        →
      </span>
    </>
  );

  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

/** Outlined companion. */
export function CtaGhost({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-3 border border-or/45 px-8 py-4 text-[0.78rem] font-medium uppercase tracking-[0.2em] text-or-clair transition-colors duration-300 hover:border-or hover:bg-or/10"
    >
      {children}
    </Link>
  );
}

/** Section intro block, used by every inner page. */
export function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <header className="border-b border-or/15 px-5 pb-16 pt-36 md:px-10 md:pb-24 md:pt-48">
      <div className="mx-auto max-w-[82rem]">
        <div data-reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
          <Title as="h1" className="mt-5 max-w-[18ch]">
            {title}
          </Title>
          <Lede className="mt-7">{lede}</Lede>
        </div>
      </div>
    </header>
  );
}
