"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { whatsappLink } from "@/lib/site";

export type CartItem = {
  /** The variant id: one line per pack size. */
  id: number;
  name: string;
  /** Empty for a pack's only size. */
  size: string;
  /** In MAD; null is "price on request". */
  price: number | null;
  qty: number;
};

export type CartLabels = {
  open: string;
  title: string;
  close: string;
  empty: string;
  remove: string;
  decrease: string;
  increase: string;
  quantity: string;
  total: string;
  totalOnRequest: string;
  checkout: string;
  clear: string;
  keepShopping: string;
  /** "{n}" is replaced with the number of pieces. */
  count: string;
  priceFormat: string;
  priceOnRequest: string;
  /** The WhatsApp message: "{lines}" and "{total}" are filled in. */
  message: string;
  messageLine: string;
  messageTotal: string;
  messageTotalOnRequest: string;
};

const STORAGE_KEY = "dar-tawil:cart";
export const MAX_QTY = 99;
const priceNumber = new Intl.NumberFormat("fr-FR");

type CartContextValue = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty: number) => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
  openCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

const clamp = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.round(n) || 1));

function readStored(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is CartItem =>
        typeof i?.id === "number" && typeof i?.name === "string" && typeof i?.qty === "number",
    );
  } catch {
    return [];
  }
}

/**
 * Holds the basket for the collections page. Nothing goes to WhatsApp until
 * the visitor checks out; the basket survives a reload in localStorage.
 */
export function CartProvider({ labels, children }: { labels: CartLabels; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setItems(readStored());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* private mode: the basket just won't survive a reload */
    }
  }, [items, loaded]);

  const add = useCallback<CartContextValue["add"]>((item, qty) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, ...item, qty: clamp(i.qty + qty) } : i));
      }
      return [...prev, { ...item, qty: clamp(qty) }];
    });
  }, []);

  const setQty = useCallback((id: number, qty: number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: clamp(qty) } : i)));
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setOpen(true), []);

  const value = useMemo(
    () => ({ items, add, setQty, remove, clear, openCart }),
    [items, add, setQty, remove, clear, openCart],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartBar labels={labels} onOpen={openCart} />
      <CartDrawer labels={labels} open={open} onClose={() => setOpen(false)} />
    </CartContext.Provider>
  );
}

function formatPrice(labels: CartLabels, price: number) {
  return labels.priceFormat.replace("{price}", priceNumber.format(price));
}

function itemName(item: CartItem) {
  return item.size ? `${item.name} (${item.size})` : item.name;
}

function summary(items: CartItem[]) {
  const pieces = items.reduce((n, i) => n + i.qty, 0);
  const total = items.reduce((n, i) => n + (i.price ?? 0) * i.qty, 0);
  const onRequest = items.some((i) => i.price === null);
  return { pieces, total, onRequest };
}

/** The one message sent to WhatsApp once the visitor is done shopping. */
export function composeOrder(labels: CartLabels, items: CartItem[]) {
  const { total, onRequest } = summary(items);
  const lines = items
    .map((i) =>
      labels.messageLine
        .replace("{qty}", String(i.qty))
        .replace("{pack}", itemName(i))
        .replace(
          "{price}",
          i.price === null ? labels.priceOnRequest : formatPrice(labels, i.price * i.qty),
        ),
    )
    .join("\n");
  const totalLine = (onRequest ? labels.messageTotalOnRequest : labels.messageTotal).replace(
    "{total}",
    formatPrice(labels, total),
  );
  return labels.message.replace("{lines}", lines).replace("{total}", totalLine);
}

/** Floating summary that appears once something is in the basket. */
function CartBar({ labels, onOpen }: { labels: CartLabels; onOpen: () => void }) {
  const { items } = useCart();
  const { pieces, total, onRequest } = summary(items);
  if (pieces === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onOpen}
        className="cart-bar pointer-events-auto flex min-h-14 w-full max-w-md items-center justify-between gap-4 border border-or/50 bg-brou px-5 text-ivoire shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)] transition-colors duration-300 hover:border-or"
      >
        <span className="flex items-center gap-3">
          <BagIcon className="size-5 text-or" />
          <span className="text-[0.78rem] uppercase tracking-[0.18em]">
            {labels.count.replace("{n}", String(pieces))}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span key={total} className="price-in font-display text-[1.1rem] text-or-profond">
            {formatPrice(labels, total)}
            {onRequest ? " +" : ""}
          </span>
          <span className="text-[0.74rem] font-medium uppercase tracking-[0.18em] text-or">
            {labels.open}
          </span>
        </span>
      </button>
    </div>
  );
}

function CartDrawer({
  labels,
  open,
  onClose,
}: {
  labels: CartLabels;
  open: boolean;
  onClose: () => void;
}) {
  const { items, setQty, remove, clear } = useCart();
  const { total, onRequest } = summary(items);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="cart-title"
      className="cart-drawer m-0 ms-auto h-dvh max-h-none w-full max-w-md border-s border-or/30 bg-noir p-0 text-ivoire backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-or/20 px-6 py-5">
          <h2 id="cart-title" className="monument text-[1.35rem] text-ivoire">
            {labels.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="grid size-11 place-items-center text-ivoire/70 transition-colors hover:text-or-profond"
          >
            <svg viewBox="0 0 16 16" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
            <BagIcon className="size-8 text-or/60" />
            <p className="text-[0.95rem] text-ivoire/65">{labels.empty}</p>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 border border-or/40 px-5 text-[0.74rem] uppercase tracking-[0.18em] text-ivoire/80 transition-colors hover:border-or hover:text-or-profond"
            >
              {labels.keepShopping}
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-or/15 overflow-y-auto px-6">
              {items.map((item) => (
                <li key={item.id} className="py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-display text-[1.1rem] leading-snug text-ivoire">{item.name}</p>
                      {item.size ? (
                        <p className="mt-1 text-[0.8rem] tracking-[0.04em] text-ivoire/55">{item.size}</p>
                      ) : null}
                    </div>
                    <p className="whitespace-nowrap font-display text-[1rem] text-or-profond">
                      {item.price === null
                        ? labels.priceOnRequest
                        : formatPrice(labels, item.price * item.qty)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <QtyStepper
                      value={item.qty}
                      onChange={(q) => setQty(item.id, q)}
                      labels={labels}
                      label={`${labels.quantity} — ${itemName(item)}`}
                    />
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="min-h-11 text-[0.72rem] uppercase tracking-[0.16em] text-ivoire/50 underline-offset-4 transition-colors hover:text-or-profond hover:underline"
                    >
                      {labels.remove}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-or/25 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[0.74rem] uppercase tracking-[0.2em] text-or/80">{labels.total}</span>
                <span className="font-display text-[1.45rem] text-or-profond">{formatPrice(labels, total)}</span>
              </div>
              {onRequest ? (
                <p className="mt-1.5 text-[0.8rem] text-ivoire/55">{labels.totalOnRequest}</p>
              ) : null}
              <a
                href={whatsappLink(composeOrder(labels, items))}
                target="_blank"
                rel="noreferrer"
                className="cta-primary cta-sheen group/cta relative mt-5 flex min-h-12 w-full items-center justify-center gap-2 overflow-hidden bg-or px-5 text-[0.78rem] font-medium uppercase tracking-[0.18em] text-noir transition-colors duration-300 hover:bg-or-clair"
              >
                {labels.checkout}
                <span
                  aria-hidden
                  className="transition-transform duration-300 group-hover/cta:translate-x-1 rtl:rotate-180 rtl:group-hover/cta:-translate-x-1"
                >
                  →
                </span>
              </a>
              <div className="mt-3 flex justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 text-[0.72rem] uppercase tracking-[0.16em] text-ivoire/60 transition-colors hover:text-or-profond"
                >
                  {labels.keepShopping}
                </button>
                <button
                  type="button"
                  onClick={clear}
                  className="min-h-11 text-[0.72rem] uppercase tracking-[0.16em] text-ivoire/45 transition-colors hover:text-or-profond"
                >
                  {labels.clear}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

/** − n + control, shared by the pack cards and the basket. */
export function QtyStepper({
  value,
  onChange,
  labels,
  label,
}: {
  value: number;
  onChange: (qty: number) => void;
  labels: Pick<CartLabels, "decrease" | "increase">;
  label: string;
}) {
  const btn =
    "grid size-11 place-items-center text-ivoire/80 transition-colors hover:text-or-profond disabled:pointer-events-none disabled:opacity-30";
  return (
    <div role="group" aria-label={label} className="inline-flex items-center border border-or/40">
      <button
        type="button"
        aria-label={labels.decrease}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className={btn}
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 8h10" />
        </svg>
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_QTY}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        onFocus={(e) => e.target.select()}
        className="h-11 w-10 bg-transparent text-center font-display text-[1rem] text-ivoire [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label={labels.increase}
        disabled={value >= MAX_QTY}
        onClick={() => onChange(value + 1)}
        className={btn}
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 8h10M8 3v10" />
        </svg>
      </button>
    </div>
  );
}

function BagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M5 8h14l-1.2 12H6.2L5 8z" />
      <path d="M9 8V6.5a3 3 0 016 0V8" />
    </svg>
  );
}
