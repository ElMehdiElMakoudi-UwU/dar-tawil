import { palette } from "@/lib/theme";

/**
 * Shape primitives lifted straight off the logo: the multifoil arch that frames
 * the monogram, and the star lattice carved inside it. Everything visual on the
 * site is one of these two at a different scale.
 */

/* ── The arch ──────────────────────────────────────────────────────── */

/** Traced from the arch in the mark, in objectBoundingBox units so it scales. */
export const ARCH_PATH =
  "M0,1 L0,0.42 C0,0.19 0.14,0.055 0.325,0.018 C0.42,0 0.462,0 0.5,0 C0.538,0 0.58,0 0.675,0.018 C0.86,0.055 1,0.19 1,0.42 L1,1 Z";

/** Rendered once in the root layout; every arch on the site clips to it. */
export function ArchClipDefs() {
  return (
    <svg aria-hidden className="pointer-events-none absolute h-0 w-0">
      <defs>
        <clipPath id="dt-arch" clipPathUnits="objectBoundingBox">
          <path d={ARCH_PATH} />
        </clipPath>
      </defs>
    </svg>
  );
}

/* ── The lattice ───────────────────────────────────────────────────── */

const TILE = 120;
/** Star and cross centres alternate on a 60pt checkerboard, as in zellige. */
const STAR_R = 42.4;
const CROSS_R = 15;

function ring(cx: number, cy: number, r: number, count: number, offset = 0) {
  return Array.from({ length: count }, (_, i) => {
    const t = offset + (i * 2 * Math.PI) / count;
    return `${(cx + r * Math.cos(t)).toFixed(2)},${(cy + r * Math.sin(t)).toFixed(2)}`;
  }).join(" ");
}

/** An eight-pointed khatem: two squares at 45° to each other. */
function starPolygons(cx: number, cy: number, r: number) {
  return [ring(cx, cy, r, 4, 0), ring(cx, cy, r, 4, Math.PI / 4)];
}

const STAR_CENTRES: [number, number][] = [
  [60, 60],
  [0, 0],
  [TILE, 0],
  [0, TILE],
  [TILE, TILE],
];
const CROSS_CENTRES: [number, number][] = [
  [60, 0],
  [0, 60],
  [TILE, 60],
  [60, TILE],
];

export function Lattice({
  id,
  className = "",
  scale = 1,
  strokeWidth = 1.1,
}: {
  /** Must be unique per instance — it names the SVG pattern. */
  id: string;
  className?: string;
  scale?: number;
  strokeWidth?: number;
}) {
  const size = TILE * scale;

  return (
    <svg
      aria-hidden
      className={className}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern
          id={id}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          viewBox={`0 0 ${TILE} ${TILE}`}
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          >
            {STAR_CENTRES.flatMap(([cx, cy], i) =>
              starPolygons(cx, cy, STAR_R).map((points, j) => (
                <polygon key={`s${i}-${j}`} points={points} />
              )),
            )}
            {CROSS_CENTRES.map(([cx, cy], i) => (
              <polygon key={`c${i}`} points={ring(cx, cy, CROSS_R, 4, 0)} />
            ))}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/* ── The cubes ─────────────────────────────────────────────────────── */

/** Hexagon side, in pattern units. */
const HEX = 20;
const HEX_W = Math.sqrt(3) * HEX;

/** Hexagon outline plus the inner "Y" that turns it into a cube. */
function cube(cx: number, cy: number) {
  const h = HEX / 2;
  const w = HEX_W / 2;
  const top = `${cx},${cy - HEX}`;
  const ur = `${cx + w},${cy - h}`;
  const lr = `${cx + w},${cy + h}`;
  const bottom = `${cx},${cy + HEX}`;
  const ll = `${cx - w},${cy + h}`;
  const ul = `${cx - w},${cy - h}`;
  const c = `${cx},${cy}`;
  return `M${top} L${ur} L${lr} L${bottom} L${ll} L${ul} Z M${c} L${bottom} M${c} L${ur} M${c} L${ul}`;
}

const CUBE_CENTRES: [number, number][] = [
  [0, 0],
  [HEX_W, 0],
  [HEX_W / 2, HEX * 1.5],
  [0, HEX * 3],
  [HEX_W, HEX * 3],
];

/**
 * The tumbling-block hairlines printed on the lid of every box. On the box
 * they sit in bands along the top and bottom edges and fade toward the name,
 * so `fade` masks them the same way.
 */
export function Cubes({
  id,
  className = "",
  scale = 1,
  strokeWidth = 0.6,
  fade = "both",
}: {
  /** Must be unique per instance — it names the SVG pattern. */
  id: string;
  className?: string;
  scale?: number;
  strokeWidth?: number;
  fade?: "both" | "down" | "up" | "none";
}) {
  const mask = {
    both: "linear-gradient(to bottom, #000 0%, transparent 34%, transparent 66%, #000 100%)",
    down: "linear-gradient(to bottom, #000 0%, transparent 100%)",
    up: "linear-gradient(to top, #000 0%, transparent 100%)",
    none: undefined,
  }[fade];

  return (
    <svg
      aria-hidden
      className={className}
      width="100%"
      height="100%"
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    >
      <defs>
        <pattern
          id={id}
          width={HEX_W * scale}
          height={HEX * 3 * scale}
          patternUnits="userSpaceOnUse"
          viewBox={`0 0 ${HEX_W} ${HEX * 3}`}
        >
          <path
            d={CUBE_CENTRES.map(([x, y]) => cube(x, y)).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/* ── The hairline that separates sections ─────────────────────────── */

/** The eight-pointed star on its own, at any size. */
export function Khatem({
  size = 26,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round">
        {starPolygons(60, 60, STAR_R).map((points, j) => (
          <polygon key={j} points={points} />
        ))}
      </g>
    </svg>
  );
}

/** A single lattice star, used where a divider needs a full stop. */
export function StarRule({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-5 text-or/45 ${className}`}>
      <span className="h-px flex-1 bg-current" />
      <Khatem />
      <span className="h-px flex-1 bg-current" />
    </div>
  );
}

/* ── Section grounds ──────────────────────────────────────────────── */

/**
 * The pattern a large surface sits on, chosen by palette: the carved lattice
 * for the dark grounds, the printed cubes of the box lid for "blanc".
 */
export function Ground({
  id,
  className = "",
  scale = 1,
  fade,
}: {
  id: string;
  className?: string;
  scale?: number;
  fade?: "both" | "down" | "up" | "none";
}) {
  return palette === "blanc" ? (
    <Cubes id={id} className={className} scale={scale} fade={fade} />
  ) : (
    <Lattice id={id} className={className} scale={scale} />
  );
}
