import type { ReactNode } from "react";
import type { Flavour } from "@/lib/flavours";

/**
 * A painted bonbon, drawn rather than photographed so the range can be shown
 * before the product shots exist. The paint is seeded from the slug, so every
 * render — server or client — throws the same splashes.
 */

/** The bell-shaped shell of the house mould, in a 100 × 92 box. */
const SHELL =
  "M16,82 C15,58 15,36 26,22 C35,11 44,8 50,8 C56,8 65,11 74,22 C85,36 85,58 84,82 C84,86 70,88 50,88 C30,88 16,86 16,82 Z";

function seeded(slug: string) {
  let h = 2166136261;
  for (const ch of slug) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 1 | h);
    h ^= h + Math.imul(h ^ (h >>> 7), 61 | h);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

function paint({ slug, accents, finish }: Flavour): ReactNode[] {
  const rand = seeded(slug);
  const between = (a: number, b: number) => a + rand() * (b - a);
  const pick = () => accents[Math.floor(rand() * accents.length)];

  /** A wandering stroke from one side of the shell to the other. */
  const throwLine = (width: number, key: string) => {
    const y0 = between(14, 80);
    const y1 = between(14, 80);
    const d = `M${between(4, 20)},${y0} C${between(25, 45)},${between(10, 85)} ${between(55, 75)},${between(10, 85)} ${between(80, 96)},${y1}`;
    return (
      <path
        key={key}
        d={d}
        fill="none"
        stroke={pick()}
        strokeWidth={width}
        strokeLinecap="round"
        opacity={between(0.75, 1)}
      />
    );
  };

  switch (finish) {
    case "splatter":
      return [
        ...Array.from({ length: 26 }, (_, i) => (
          <circle
            key={`d${i}`}
            cx={between(14, 86)}
            cy={between(10, 86)}
            r={rand() < 0.15 ? between(3, 5.5) : between(0.7, 2.2)}
            fill={pick()}
          />
        )),
        throwLine(1.1, "l0"),
      ];
    case "drizzle":
      return [
        ...Array.from({ length: 5 }, (_, i) => throwLine(between(0.8, 1.8), `l${i}`)),
        ...Array.from({ length: 8 }, (_, i) => (
          <circle
            key={`d${i}`}
            cx={between(14, 86)}
            cy={between(10, 86)}
            r={between(0.8, 2.4)}
            fill={pick()}
          />
        )),
      ];
    case "marble":
      return Array.from({ length: 4 }, (_, i) => throwLine(between(3, 7), `m${i}`));
    case "leaf":
      // Gold leaf: overlapping flakes catching the light at different angles.
      return Array.from({ length: 34 }, (_, i) => {
        const x = between(8, 92);
        const y = between(6, 90);
        const s = between(5, 11);
        return (
          <polygon
            key={`f${i}`}
            points={`${x},${y - s} ${x + s * 0.9},${y - s * 0.2} ${x + s * 0.4},${y + s} ${x - s * 0.8},${y + s * 0.4}`}
            fill={pick()}
            opacity={between(0.35, 0.8)}
          />
        );
      });
    case "plain":
      return [];
  }
}

export function Bonbon({ flavour, className = "" }: { flavour: Flavour; className?: string }) {
  const id = `bonbon-${flavour.slug}`;

  return (
    <svg viewBox="0 0 100 92" aria-hidden className={className}>
      <defs>
        <clipPath id={`${id}-shell`}>
          <path d={SHELL} />
        </clipPath>
        {/* Light from the upper left, as in the house photographs. */}
        <linearGradient id={`${id}-shade`} x1="0" x2="1" y1="0" y2="0.35">
          <stop offset="0" stopColor="#fff" stopOpacity="0.26" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0.06" />
          <stop offset="1" stopColor="#000" stopOpacity="0.32" />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="50" cy="87" rx="36" ry="4" fill="#000" opacity="0.14" />

      <g clipPath={`url(#${id}-shell)`}>
        <rect width="100" height="92" fill={flavour.base} />
        {paint(flavour)}
        <rect width="100" height="92" fill={`url(#${id}-shade)`} />
        <ellipse
          cx="35"
          cy="28"
          rx="7"
          ry="13"
          transform="rotate(28 35 28)"
          fill={`url(#${id}-shine)`}
        />
      </g>
    </svg>
  );
}
