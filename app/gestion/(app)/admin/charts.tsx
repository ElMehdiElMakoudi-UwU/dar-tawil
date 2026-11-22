"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { mad } from "@/lib/gestion/format";

/*
 * Small hand-drawn SVG charts for the dashboard: no chart library, the
 * house colours from the --g-c1/--g-c2/--g-pos/--g-neg tokens. Each one
 * measures its own width so text stays at its real size on a phone, and
 * shows a tooltip on hover (or tap).
 */

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const tick = (n: number) => {
  const v = Math.abs(n) < 0.5 ? 0 : n; // no "-0"
  return Math.abs(v) >= 10_000 ? compact.format(v) : Math.round(v).toLocaleString("en-US");
};

/** Splits a long axis label over two lines at the space nearest its middle. */
function twoLines(label: string, max: number): [string, string?] {
  if (label.length <= max || !label.includes(" ")) return [label];
  const mid = label.length / 2;
  let best = -1;
  for (let i = 0; i < label.length; i++) if (label[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return [label.slice(0, best), label.slice(best + 1)];
}

/** 0 / 1,000 / 2,000…: about `count` clean steps covering [min, max]. */
function niceTicks(min: number, max: number, count = 4) {
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

type Tip = { x: number; y: number; body: ReactNode } | null;

function Tooltip({ tip, width }: { tip: Tip; width: number }) {
  if (!tip) return null;
  // Flip to the left of the pointer near the right edge.
  const left = tip.x > width - 180 ? tip.x - 12 : tip.x + 12;
  return (
    <div className="g-tip" style={{ left, top: Math.max(0, tip.y - 10), transform: tip.x > width - 180 ? "translateX(-100%)" : undefined }}>
      {tip.body}
    </div>
  );
}

const Row = ({ color, label, value }: { color?: string; label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span>
      {color && <span className="g-key me-1.5" style={{ background: color }} />}
      {label}
    </span>
    <span className="tabular-nums font-medium" dir="ltr">
      {value}
    </span>
  </div>
);

/** Rounded data-end, square at the baseline (y0). Works for bars going up or down. */
function columnPath(x: number, w: number, y0: number, y1: number, r = 4) {
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return "";
  const rr = Math.min(r, h, w / 2);
  if (y1 < y0) {
    return `M${x},${y0}V${y1 + rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 + rr}V${y0}Z`;
  }
  return `M${x},${y0}V${y1 - rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 - rr}V${y0}Z`;
}

/** Horizontal bar from x0 to x1 with a rounded end at x1. */
function barPath(y: number, h: number, x0: number, x1: number, r = 4) {
  const w = Math.abs(x1 - x0);
  if (w < 0.5) return "";
  const rr = Math.min(r, w, h / 2);
  if (x1 > x0) return `M${x0},${y}H${x1 - rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 - rr},${y + h}H${x0}Z`;
  return `M${x0},${y}H${x1 + rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 + rr},${y + h}H${x0}Z`;
}

/* ── break-even ───────────────────────────────────────────────────── */

export type BreakEvenLabels = {
  axis: string; revenue: string; costs: string; fixed: string; breakEven: string; actual: string; net: string; cur: string;
};

/**
 * The classic break-even chart: for any level of sales x, revenue is x and
 * total cost is fixed + (1 − margin rate)·x. They cross at the break-even.
 */
export function BreakEvenChart({ fixed, rate, revenue, labels }: { fixed: number; rate: number; revenue: number; labels: BreakEvenLabels }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const [hx, setHx] = useState<number | null>(null);

  const be = rate > 0 ? fixed / rate : null;
  const xMax = Math.max(revenue, be ?? 0, fixed, 1) * 1.25;
  const cost = (x: number) => fixed + (1 - rate) * x;
  const yMax = Math.max(xMax, cost(xMax));

  const height = 280;
  const m = { t: 16, r: 16, b: 40, l: 52 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const xs = niceTicks(0, xMax);
  const ys = niceTicks(0, yMax);
  const X = (v: number) => m.l + (v / xs[xs.length - 1]) * iw;
  const Y = (v: number) => m.t + ih - (v / ys[ys.length - 1]) * ih;
  const xEnd = xs[xs.length - 1];

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - box.left;
    const v = Math.max(0, Math.min(xEnd, ((px - m.l) / iw) * xEnd));
    setHx(v);
    const net = v - cost(v);
    setTip({
      x: X(v),
      y: Y(Math.max(v, cost(v))),
      body: (
        <>
          <Row color="var(--g-c1)" label={labels.revenue} value={mad(v)} />
          <Row color="var(--g-c2)" label={labels.costs.split(" (")[0]} value={mad(cost(v))} />
          <Row label={labels.net} value={mad(net)} />
        </>
      ),
    });
  };

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg className="g-chart block" width={width} height={height} role="img" aria-label={labels.axis}>
        {ys.map((v) => (
          <g key={`y${v}`}>
            <line x1={m.l} x2={width - m.r} y1={Y(v)} y2={Y(v)} stroke="var(--g-grid)" />
            <text x={m.l - 8} y={Y(v) + 4} textAnchor="end">
              {tick(v)}
            </text>
          </g>
        ))}
        {xs.map((v) => (
          <text key={`x${v}`} x={X(v)} y={height - m.b + 18} textAnchor="middle">
            {tick(v)}
          </text>
        ))}
        <text x={m.l + iw / 2} y={height - 4} textAnchor="middle">
          {labels.axis}
        </text>

        {/* Loss zone, then profit zone: washes between the two lines. */}
        {be != null && (
          <>
            <path
              d={`M${X(0)},${Y(0)}L${X(be)},${Y(be)}L${X(0)},${Y(cost(0))}Z`}
              fill="var(--g-neg)"
              opacity={0.1}
            />
            <path
              d={`M${X(be)},${Y(be)}L${X(xEnd)},${Y(xEnd)}L${X(xEnd)},${Y(cost(xEnd))}Z`}
              fill="var(--g-pos)"
              opacity={0.12}
            />
          </>
        )}

        {/* Fixed charges, a quiet reference line. */}
        <line x1={X(0)} x2={X(xEnd)} y1={Y(fixed)} y2={Y(fixed)} stroke="var(--g-soft)" strokeWidth={1} opacity={0.6} />
        <text x={X(xEnd)} y={Y(fixed) - 6} textAnchor="end">
          {labels.fixed}
        </text>

        <line x1={X(0)} y1={Y(cost(0))} x2={X(xEnd)} y2={Y(cost(xEnd))} stroke="var(--g-c2)" strokeWidth={2} strokeLinecap="round" />
        <line x1={X(0)} y1={Y(0)} x2={X(xEnd)} y2={Y(xEnd)} stroke="var(--g-c1)" strokeWidth={2} strokeLinecap="round" />

        {/* Actual sales. */}
        {revenue > 0 && (
          <g>
            <line x1={X(revenue)} x2={X(revenue)} y1={m.t} y2={m.t + ih} stroke="var(--color-ivoire)" strokeWidth={1} opacity={0.5} />
            <text x={X(revenue)} y={m.t + 10} textAnchor={X(revenue) > width - 90 ? "end" : "start"} dx={X(revenue) > width - 90 ? -6 : 6} className="g-chart-strong">
              {labels.actual} {tick(revenue)}
            </text>
          </g>
        )}

        {be != null && be <= xEnd && (
          <g>
            <circle cx={X(be)} cy={Y(be)} r={5} fill="var(--color-ivoire)" stroke="var(--color-noir)" strokeWidth={2} />
            <text x={X(be)} y={Y(be) + 20} textAnchor="middle" className="g-chart-strong">
              {labels.breakEven} {tick(be)}
            </text>
          </g>
        )}

        {hx != null && (
          <g pointerEvents="none">
            <line x1={X(hx)} x2={X(hx)} y1={m.t} y2={m.t + ih} stroke="var(--g-soft)" strokeWidth={1} />
            <circle cx={X(hx)} cy={Y(hx)} r={4} fill="var(--g-c1)" stroke="var(--color-noir)" strokeWidth={2} />
            <circle cx={X(hx)} cy={Y(cost(hx))} r={4} fill="var(--g-c2)" stroke="var(--color-noir)" strokeWidth={2} />
          </g>
        )}

        <rect
          x={m.l}
          y={m.t}
          width={iw}
          height={ih}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => {
            setTip(null);
            setHx(null);
          }}
        />
      </svg>
      <Tooltip tip={tip} width={width} />
      <Legend items={[{ color: "var(--g-c1)", label: labels.revenue }, { color: "var(--g-c2)", label: labels.costs }]} />
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="g-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map((i) => (
        <li key={i.label}>
          <span className="g-key me-1.5" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/* ── waterfall ────────────────────────────────────────────────────── */

export type Step = { label: string; value: number; kind: "total" | "delta" };

/** Revenue down to net result: totals stand on the baseline, deltas float. */
export function Waterfall({ steps, cur }: { steps: Step[]; cur: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);

  let run = 0;
  const bars = steps.map((s) => {
    const start = s.kind === "total" ? 0 : run;
    const end = s.kind === "total" ? s.value : run + s.value;
    run = end;
    return { ...s, start, end };
  });
  const lo = Math.min(0, ...bars.map((b) => Math.min(b.start, b.end)));
  const hi = Math.max(1, ...bars.map((b) => Math.max(b.start, b.end)));
  const ys = niceTicks(lo, hi);

  const height = 260;
  const m = { t: 22, r: 8, b: 44, l: 52 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const Y = (v: number) => m.t + ih - ((v - ys[0]) / (ys[ys.length - 1] - ys[0])) * ih;
  const band = iw / bars.length;
  const bw = Math.min(40, band * 0.6);
  const narrow = band < 64;

  const color = (b: (typeof bars)[number], i: number) =>
    b.kind === "delta" ? (b.value < 0 ? "var(--g-neg)" : "var(--g-pos)") : i === bars.length - 1 ? (b.value < 0 ? "var(--g-neg)" : "var(--g-pos)") : "var(--g-c1)";

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg className="g-chart block" width={width} height={height} role="img">
        {ys.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={width - m.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? "var(--g-soft)" : "var(--g-grid)"} opacity={v === 0 ? 0.6 : 1} />
            <text x={m.l - 8} y={Y(v) + 4} textAnchor="end">
              {tick(v)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = m.l + band * i + (band - bw) / 2;
          const up = b.end >= b.start;
          // Totals grow from the baseline; deltas from where the last bar ended.
          const d = columnPath(x, bw, Y(up ? Math.min(b.start, b.end) : Math.max(b.start, b.end)), Y(up ? Math.max(b.start, b.end) : Math.min(b.start, b.end)));
          const next = bars[i + 1];
          return (
            <g key={b.label}>
              <path d={d} fill={color(b, i)} />
              {next && next.kind === "delta" && (
                <line x1={x + bw} x2={x + band} y1={Y(b.end)} y2={Y(b.end)} stroke="var(--g-soft)" strokeWidth={1} opacity={0.5} />
              )}
              <text x={x + bw / 2} y={Y(Math.max(b.start, b.end)) - 6} textAnchor="middle" className="g-chart-strong">
                {tick(b.kind === "delta" ? b.value : b.end)}
              </text>
              <text x={x + bw / 2} y={height - m.b + 16} textAnchor="middle" style={narrow ? { fontSize: 10 } : undefined}>
                {twoLines(b.label, narrow ? 9 : 14).map((line, k) => (
                  <tspan key={k} x={x + bw / 2} dy={k ? 12 : 0}>
                    {line}
                  </tspan>
                ))}
              </text>
              <rect
                x={m.l + band * i}
                y={m.t}
                width={band}
                height={ih}
                fill="transparent"
                onPointerEnter={() => setTip({ x: x + bw / 2, y: Y(Math.max(b.start, b.end)), body: <Row label={b.label} value={`${mad(b.kind === "delta" ? b.value : b.end)} ${cur}`} /> })}
                onPointerDown={() => setTip({ x: x + bw / 2, y: Y(Math.max(b.start, b.end)), body: <Row label={b.label} value={`${mad(b.kind === "delta" ? b.value : b.end)} ${cur}`} /> })}
                onPointerLeave={() => setTip(null)}
              />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

/* ── horizontal bars ──────────────────────────────────────────────── */

/**
 * One bar per row, sorted by the caller. Signed values grow left or right of
 * a zero line; `note` goes in the tooltip.
 */
export function HBars({ rows, cur, color = "var(--g-c1)" }: { rows: { label: string; value: number; note?: string }[]; cur: string; color?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const signed = rows.some((r) => r.value < 0);
  const lo = Math.min(0, ...rows.map((r) => r.value));
  const hi = Math.max(0, ...rows.map((r) => r.value), 1);

  const labelW = Math.min(160, width * 0.36);
  const valueW = 70;
  const rowH = 30;
  const bh = 14;
  const height = rows.length * rowH + 4;
  const x0 = labelW + 8;
  const iw = width - x0 - valueW;
  const X = (v: number) => x0 + ((v - lo) / (hi - lo || 1)) * iw;

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg className="g-chart block" width={width} height={height} role="img">
        {signed && <line x1={X(0)} x2={X(0)} y1={0} y2={height} stroke="var(--g-soft)" opacity={0.5} />}
        {rows.map((r, i) => {
          const y = i * rowH + (rowH - bh) / 2;
          const fill = signed ? (r.value < 0 ? "var(--g-neg)" : "var(--g-pos)") : color;
          const show = () => setTip({ x: Math.max(X(r.value), X(0)), y, body: <Row label={r.label} value={`${mad(r.value)} ${cur}${r.note ? ` · ${r.note}` : ""}`} /> });
          return (
            <g key={r.label + i}>
              <text x={labelW} y={y + bh - 2} textAnchor="end">
                {r.label.length > 24 ? r.label.slice(0, 22) + "…" : r.label}
              </text>
              <path d={barPath(y, bh, X(0), X(r.value))} fill={fill} />
              <text x={r.value < 0 ? X(r.value) - 6 : X(r.value) + 6} y={y + bh - 2} textAnchor={r.value < 0 ? "end" : "start"} className="g-chart-strong">
                {tick(r.value)}
              </text>
              <rect x={0} y={i * rowH} width={width} height={rowH} fill="transparent" onPointerEnter={show} onPointerDown={show} onPointerLeave={() => setTip(null)} />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

/* ── grouped columns over periods ─────────────────────────────────── */

export function PeriodColumns({
  periods,
  labels,
  cur,
}: {
  periods: { label: string; revenue: number; net: number; current: boolean }[];
  labels: { revenue: string; net: string };
  cur: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const lo = Math.min(0, ...periods.map((p) => p.net));
  const hi = Math.max(1, ...periods.map((p) => Math.max(p.revenue, p.net)));
  const ys = niceTicks(lo, hi);

  const height = 260;
  const m = { t: 20, r: 8, b: 44, l: 52 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const Y = (v: number) => m.t + ih - ((v - ys[0]) / (ys[ys.length - 1] - ys[0])) * ih;
  const band = iw / periods.length;
  const bw = Math.min(22, (band * 0.7 - 2) / 2);

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg className="g-chart block" width={width} height={height} role="img">
        {ys.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={width - m.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? "var(--g-soft)" : "var(--g-grid)"} opacity={v === 0 ? 0.6 : 1} />
            <text x={m.l - 8} y={Y(v) + 4} textAnchor="end">
              {tick(v)}
            </text>
          </g>
        ))}
        {periods.map((p, i) => {
          const cx = m.l + band * i + band / 2;
          const show = () =>
            setTip({
              x: cx,
              y: Y(Math.max(p.revenue, p.net, 0)),
              body: (
                <>
                  <div className="mb-1 font-medium">{p.label}</div>
                  <Row color="var(--g-c1)" label={labels.revenue} value={`${mad(p.revenue)} ${cur}`} />
                  <Row color={p.net < 0 ? "var(--g-neg)" : "var(--g-c2)"} label={labels.net} value={`${mad(p.net)} ${cur}`} />
                </>
              ),
            });
          return (
            <g key={p.label + i}>
              {p.current && <rect x={m.l + band * i + 2} y={m.t} width={band - 4} height={ih} rx={6} fill="var(--color-ivoire)" opacity={0.05} />}
              <path d={columnPath(cx - bw - 1, bw, Y(0), Y(p.revenue))} fill="var(--g-c1)" />
              <path d={columnPath(cx + 1, bw, Y(0), Y(p.net))} fill={p.net < 0 ? "var(--g-neg)" : "var(--g-c2)"} />
              <text x={cx} y={height - m.b + 16} textAnchor="middle" className={p.current ? "g-chart-strong" : undefined}>
                {/* "1 nov. – 22 nov." stacks on two lines when the bands are narrow. */}
                {(band < 110 ? p.label.split(" – ").map((l, k, a) => (k < a.length - 1 ? `${l} –` : l)) : [p.label]).map((line, k) => (
                  <tspan key={k} x={cx} dy={k ? 12 : 0}>
                    {line}
                  </tspan>
                ))}
              </text>
              <rect x={m.l + band * i} y={m.t} width={band} height={ih} fill="transparent" onPointerEnter={show} onPointerDown={show} onPointerLeave={() => setTip(null)} />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={width} />
      <Legend items={[{ color: "var(--g-c1)", label: labels.revenue }, { color: "var(--g-c2)", label: labels.net }]} />
    </div>
  );
}

/** A thin progress meter towards a target; past 100 % it turns the good colour. */
export function Meter({ value, target }: { value: number; target: number }) {
  const share = target > 0 ? value / target : 0;
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-brou-clair)]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(1, share) * 100}%`, background: share >= 1 ? "var(--g-pos)" : "var(--g-c1)" }}
      />
    </div>
  );
}
