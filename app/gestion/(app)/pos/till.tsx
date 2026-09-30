"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { mad, qty as fmtQty } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { createSale } from "../../actions";
import { useT } from "../../_components/i18n";

type Product = {
  id: number; sku: string; name: string; category: string | null; price: number; in_stock: number; unit: string;
  alt_unit: string | null; alt_factor: number | null; alt_price: number | null;
};
/** qty is typed text so weights like 0.35 can be keyed in; alt = sold in the product's second unit. */
type Line = { productId: number; qty: string; unitPrice: string; discount: string; alt: boolean };

/**
 * Which of a product's two units is the countable "piece": the smaller one.
 * Dates stocked in kg and sold by the date → the second unit (1 pc = 0.012 kg).
 * Chocolates stocked by the piece and also sold by weight → the stock unit (1 kg = 80 pc).
 */
const pieceIsAlt = (p: Product) => !!p.alt_unit && (p.alt_factor ?? 1) < 1;
type Receipt = { message: string; total: number; tendered: number | null };

const num = (s: string) => Number(s.replace(",", ".")) || 0;
// Filter keys, not labels: a real category could be called "All".
const ALL = "\u0000all";
const OTHER = "\u0000other";

/**
 * Counter till: tap a product to add it, adjust the basket, pick how it was
 * paid, charge. Saves through the same createSale action as "New sale", so
 * orders, stock and reports stay in one place.
 */
export function Till({
  products,
  customers,
  channel,
  payments,
  today,
}: {
  products: Product[];
  customers: string[];
  channel: string;
  payments: string[];
  today: string;
}) {
  const t = useT();
  const [state, run, pending] = useActionState(createSale, undefined);
  const [lines, setLines] = useState<Line[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [payment, setPayment] = useState(payments[0] ?? "");
  const [customer, setCustomer] = useState("");
  const [paid, setPaid] = useState(true);
  const [tendered, setTendered] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const charged = useRef<Omit<Receipt, "message"> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const byId = new Map(products.map((p) => [p.id, p]));
  const categories = [ALL, ...new Set(products.map((p) => p.category ?? OTHER))];
  const categoryLabel = (c: string) => (c === ALL ? t.pos.all : c === OTHER ? t.pos.other : c);
  const q = search.trim().toLowerCase();
  const shown = products.filter(
    (p) =>
      (category === ALL || (p.category ?? OTHER) === category) &&
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
  );

  const lineTotal = (l: Line) => num(l.qty) * num(l.unitPrice) * (1 - num(l.discount) / 100);
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  /** How much of the product's stock a line uses, in its stock unit. */
  const stockUsed = (l: Line) => num(l.qty) * (l.alt ? byId.get(l.productId)?.alt_factor ?? 1 : 1);
  const unitOf = (l: Line, p: Product) => (l.alt ? p.alt_unit! : p.unit);
  const isCash = /cash|esp[eè]ce|نقد/i.test(payment) && !/delivery|livraison|توصيل/i.test(payment);
  const given = num(tendered);
  const change = given - total;

  // A successful charge empties the basket and shows the receipt; an error
  // leaves everything in place so nothing has to be keyed in again.
  useEffect(() => {
    if (state?.ok && charged.current) {
      setReceipt({ message: state.ok, ...charged.current });
      setLines([]);
      setOpen(null);
      setCustomer("");
      setTendered("");
      setPaid(true);
      charged.current = null;
    }
  }, [state]);

  // A tap adds one piece (a single date, a single chocolate); the basket line
  // can be switched to weight.
  function add(p: Product) {
    setReceipt(null);
    setLines((ls) => {
      const found = ls.find((l) => l.productId === p.id);
      // A line being weighed is left alone: another tap must not add a whole kilo.
      if (found && p.alt_unit && found.alt !== pieceIsAlt(p)) return ls;
      if (found) return ls.map((l) => (l === found ? { ...l, qty: String(num(l.qty) + 1) } : l));
      const alt = pieceIsAlt(p);
      return [...ls, { productId: p.id, qty: "1", unitPrice: String(alt ? p.alt_price : p.price), discount: "", alt }];
    });
  }

  const update = (id: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.productId === id ? { ...l, ...patch } : l)));
  const remove = (id: number) => setLines((ls) => ls.filter((l) => l.productId !== id));

  function charge() {
    if (!lines.length || pending) return;
    // Server-side validation also catches this; checking here keeps the typed basket.
    if (lines.some((l) => !(num(l.qty) > 0))) {
      setOpen(lines.find((l) => !(num(l.qty) > 0))!.productId);
      return;
    }
    const fd = new FormData();
    fd.set("date", today);
    fd.set("channel", channel);
    fd.set("payment", payment);
    fd.set("customer", customer);
    if (paid) fd.set("paid", "on");
    fd.set(
      "lines",
      JSON.stringify(
        lines.map((l) => ({ productId: l.productId, qty: num(l.qty), unitPrice: num(l.unitPrice), discount: num(l.discount), alt: l.alt })),
      ),
    );
    charged.current = { total, tendered: isCash && paid && given > 0 ? given : null };
    startTransition(() => run(fd));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      {/* ── products ─────────────────────────────────── */}
      <section aria-label={t.pos.products} className="min-w-0 space-y-4">
        <input
          ref={searchRef}
          className="g-input"
          type="search"
          placeholder={t.pos.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && shown[0]) {
              e.preventDefault();
              add(shown[0]);
              setSearch("");
            }
          }}
        />
        {categories.length > 2 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t.common.category}>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`g-btn g-btn-sm ${c === category ? "" : "g-btn-ghost"}`}
                aria-pressed={c === category}
                onClick={() => setCategory(c)}
              >
                {categoryLabel(c)}
              </button>
            ))}
          </div>
        )}
        {shown.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {shown.map((p) => {
              const line = lines.find((l) => l.productId === p.id);
              const inCart = line ? num(line.qty) : 0;
              const left = p.in_stock - (line ? stockUsed(line) : 0);
              return (
                <button key={p.id} type="button" className="g-tile" onClick={() => add(p)} data-selected={inCart > 0 || undefined}>
                  {inCart > 0 && <span className="g-tile-count">{fmtQty(inCart)}</span>}
                  <span className="line-clamp-2 font-medium leading-snug">{p.name}</span>
                  <span className="g-muted text-xs">{p.sku}</span>
                  <span className="mt-auto flex items-baseline justify-between gap-2 pt-2">
                    <span className="tabular-nums font-medium" dir="ltr">
                      {mad(pieceIsAlt(p) ? p.alt_price : p.price)}
                      {p.alt_unit && <span className="g-muted text-xs"> /{pieceIsAlt(p) ? p.alt_unit : p.unit}</span>}
                    </span>
                    <span className={`text-xs tabular-nums ${left <= 0 ? "text-[var(--g-bad)]" : "g-muted"}`}>
                      {fill(t.pos.left, { qty: fmtQty(left) + (p.unit !== "U" ? ` ${p.unit}` : "") })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="g-panel g-muted text-sm">{fill(t.pos.noMatch, { q: search })}</p>
        )}
      </section>

      {/* ── basket ───────────────────────────────────── */}
      <section aria-label={t.pos.basket} className="g-card space-y-4 lg:sticky lg:top-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg">{t.pos.basket}</h2>
          {lines.length > 0 && (
            <button type="button" className="g-link-danger" onClick={() => (setLines([]), setOpen(null))}>
              {t.pos.clear}
            </button>
          )}
        </div>

        {receipt && !lines.length ? (
          <div className="g-panel space-y-2 text-center" role="status">
            <p className="font-medium text-[var(--g-good)]">{receipt.message}</p>
            <p className="text-2xl tabular-nums">
              {mad(receipt.total)} {t.cur}
            </p>
            {receipt.tendered != null && (
              <p className="g-muted text-sm">
                {fill(t.pos.received, { amount: mad(receipt.tendered) })} · {t.pos.change}{" "}
                <span className="font-medium text-[var(--color-ivoire)] tabular-nums">{mad(receipt.tendered - receipt.total)}</span>
              </p>
            )}
            <button type="button" className="g-btn mt-2 w-full" onClick={() => (setReceipt(null), searchRef.current?.focus())}>
              {t.pos.nextCustomer}
            </button>
          </div>
        ) : !lines.length ? (
          <p className="g-muted py-6 text-center text-sm">{t.pos.tapToStart}</p>
        ) : (
          <ul className="divide-y divide-[var(--g-line)]">
            {lines.map((l) => {
              const p = byId.get(l.productId)!;
              const editing = open === l.productId;
              const changed = num(l.unitPrice) !== (l.alt ? p.alt_price : p.price) || num(l.discount) > 0;
              return (
                <li key={l.productId} className="py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 text-start"
                      aria-expanded={editing}
                      onClick={() => setOpen(editing ? null : l.productId)}
                    >
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="g-muted block text-xs">
                        <span dir="ltr">
                          {mad(num(l.unitPrice))}
                          {unitOf(l, p) !== "U" && ` /${unitOf(l, p)}`}
                        </span>
                        {num(l.discount) > 0 && ` −${num(l.discount)}%`} · {editing ? t.pos.done : changed ? t.pos.edited : t.pos.editPrice}
                      </span>
                    </button>
                    <span className="shrink-0 tabular-nums font-medium">{mad(lineTotal(l))}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="g-btn g-btn-ghost g-btn-sm w-9"
                      aria-label={fill(t.pos.oneLess, { name: p.name })}
                      onClick={() => (num(l.qty) > 1 ? update(l.productId, { qty: String(num(l.qty) - 1) }) : remove(l.productId))}
                    >
                      −
                    </button>
                    <input
                      className="g-input w-16 px-1 py-1 text-center tabular-nums"
                      inputMode="decimal"
                      aria-label={fill(t.pos.qtyOf, { name: p.name })}
                      value={l.qty}
                      onChange={(e) => update(l.productId, { qty: e.target.value })}
                    />
                    <button
                      type="button"
                      className="g-btn g-btn-ghost g-btn-sm w-9"
                      aria-label={fill(t.pos.oneMore, { name: p.name })}
                      onClick={() => update(l.productId, { qty: String(num(l.qty) + 1) })}
                    >
                      +
                    </button>
                    {p.alt_unit ? (
                      <div className="flex" role="group" aria-label={t.common.soldBy}>
                        {[false, true].map((alt) => (
                          <button
                            key={String(alt)}
                            type="button"
                            className={`g-btn g-btn-sm px-2 ${l.alt === alt ? "" : "g-btn-ghost"}`}
                            aria-pressed={l.alt === alt}
                            onClick={() =>
                              l.alt !== alt &&
                              // Switching to weight clears the qty so it gets keyed in, not left at "2 kg".
                              update(l.productId, {
                                alt,
                                qty: alt === pieceIsAlt(p) ? "1" : "",
                                unitPrice: String(alt ? p.alt_price : p.price),
                              })
                            }
                          >
                            {alt ? p.alt_unit : p.unit}
                          </button>
                        ))}
                      </div>
                    ) : (
                      p.unit !== "U" && <span className="g-muted text-xs">{p.unit}</span>
                    )}
                    <button type="button" className="g-link-danger ms-auto" onClick={() => remove(l.productId)}>
                      {t.common.remove}
                    </button>
                  </div>
                  {editing && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="g-label">{t.common.priceMad}</span>
                        <input
                          className="g-input"
                          inputMode="decimal"
                          value={l.unitPrice}
                          onChange={(e) => update(l.productId, { unitPrice: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="g-label">{t.common.discountPct}</span>
                        <input
                          className="g-input"
                          inputMode="decimal"
                          placeholder="0"
                          value={l.discount}
                          onChange={(e) => update(l.productId, { discount: e.target.value })}
                        />
                      </label>
                    </div>
                  )}
                  {stockUsed(l) > p.in_stock && (
                    <p className="mt-1 text-xs text-[var(--g-bad)]">
                      {fill(t.common.onlyInStock, { qty: fmtQty(p.in_stock), unit: p.unit })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {lines.length > 0 && (
          <>
            <div className="flex items-baseline justify-between border-t border-[var(--g-line)] pt-4">
              <span className="g-muted text-sm">
                {fill(t.pos.productCount, { n: lines.length })}
              </span>
              <span className="text-2xl tabular-nums">
                {mad(total)} <span className="text-sm">{t.cur}</span>
              </span>
            </div>

            <div>
              <span className="g-label">{t.common.payment}</span>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.common.payment}>
                {payments.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`g-btn g-btn-sm ${m === payment ? "" : "g-btn-ghost"}`}
                    aria-pressed={m === payment}
                    onClick={() => setPayment(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {isCash && paid && (
              <div className="grid grid-cols-2 items-end gap-2">
                <label className="block">
                  <span className="g-label">{t.pos.cashReceived}</span>
                  <input
                    className="g-input"
                    inputMode="decimal"
                    placeholder={mad(total)}
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                  />
                </label>
                <p className="pb-2 text-end text-sm">
                  {given > 0 && (
                    <>
                      <span className="g-muted">{change < 0 ? t.pos.short : t.pos.change} </span>
                      <span className={`font-medium tabular-nums ${change < 0 ? "text-[var(--g-bad)]" : ""}`}>
                        {mad(Math.abs(change))}
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}

            <label className="block">
              <span className="g-label">{t.common.customerOptional}</span>
              <input
                className="g-input"
                list="pos-customers"
                placeholder={t.common.walkIn}
                autoComplete="off"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
              <datalist id="pos-customers">
                {customers.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
                className="size-4 accent-[var(--color-accent)]"
              />
              {t.common.paidNow}
            </label>

            <button type="button" className="g-btn w-full py-3 text-base" disabled={pending} onClick={charge}>
              {pending ? t.common.saving : fill(t.pos.charge, { amount: mad(total) })}
            </button>
            {state?.error && (
              <p key={state.at} role="alert" className="text-sm text-[var(--g-bad)]">
                {state.error}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
