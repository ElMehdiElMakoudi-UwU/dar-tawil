"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import type { PackVariant } from "@/lib/catalog";
import { QtyStepper, useCart } from "@/components/cart";

export type PackCardLabels = {
  featuredBadge: string;
  priceFormat: string;
  priceOnRequest: string;
  sizeLabel: string;
  /** For a pack the visitor composes; "{n}" is the number of pieces. */
  compose: { label: string; hint: string; count: string; empty: string };
  addToCart: string;
  added: string;
  quantity: string;
  decrease: string;
  increase: string;
  slider: { prev: string; next: string; photo: string };
};

const priceNumber = new Intl.NumberFormat("fr-FR");

/**
 * One pack: photo slider, name, description, size selector, price, quantity
 * and an add-to-basket button. Choosing a size swaps the photos and the price.
 */
export function PackCard({
  name,
  description,
  featured,
  variants,
  labels,
  priority,
  index = 0,
}: {
  name: string;
  description: string;
  featured: boolean;
  variants: readonly PackVariant[];
  labels: PackCardLabels;
  priority?: boolean;
  /** Position in its row, so a row of cards arrives one after another. */
  index?: number;
}) {
  const [selected, setSelected] = useState(0);
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const { add } = useCart();
  const sizeId = useId();
  const variant = variants[selected];
  const sizeName = variant.label;
  const fullName = sizeName ? `${name} (${sizeName})` : name;

  const price =
    variant.price === null
      ? labels.priceOnRequest
      : labels.priceFormat.replace("{price}", priceNumber.format(variant.price));

  // Flip the button to "added" for a moment, then reset the quantity.
  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(false), 1600);
    return () => clearTimeout(t);
  }, [justAdded]);

  function addToCart() {
    add({ id: variant.id, name, size: sizeName, price: variant.price }, qty);
    setQty(1);
    setJustAdded(true);
  }

  return (
    <article data-reveal data-reveal-delay={(index % 3) * 90} className="pack group/pack flex flex-col">
      {/* Keyed on the size so the slider starts again at its first photo. */}
      <Slider
        key={variant.id}
        images={variant.images}
        alt={fullName}
        labels={labels.slider}
        priority={priority}
        badge={featured ? labels.featuredBadge : undefined}
      />

      <div className="flex flex-1 flex-col pt-6">
        <h3 className="font-display text-[1.45rem] leading-tight text-ivoire transition-colors duration-500 group-hover/pack:text-or-profond">
          {name}
        </h3>
        <span aria-hidden className="pack-underline mt-3 block h-px w-12 bg-or/60" />
        <p className="mt-4 text-[0.95rem] leading-[1.7] text-ivoire/65">{description}</p>

        {variants.length > 1 ? (
          <div className="mt-5">
            <p
              id={sizeId}
              className="text-[0.7rem] uppercase tracking-[0.2em] text-or/80"
            >
              {labels.sizeLabel}
            </p>
            <div
              role="radiogroup"
              aria-labelledby={sizeId}
              className="mt-2.5 flex flex-wrap gap-2"
            >
              {variants.map((v, i) => {
                const active = i === selected;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelected(i)}
                    className={`min-h-11 border px-4 text-[0.85rem] tracking-[0.04em] transition-[color,background-color,border-color,box-shadow] duration-500 ease-[var(--ease-lantern)] ${
                      active
                        ? "border-or bg-or text-noir shadow-[0_8px_20px_-10px_var(--color-or)]"
                        : "border-or/40 text-ivoire/80 hover:border-or hover:text-or-profond"
                    }`}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-auto pt-6">
        <div className="flex items-center justify-between gap-4 border-t border-or/22 pt-5">
          <p
            aria-live="polite"
            className={`whitespace-nowrap font-display ${
              variant.price === null
                ? "text-[0.95rem] text-ivoire/60"
                : "text-[1.35rem] text-or-profond"
            }`}
          >
            {/* Keyed on the price so a new size eases its figure in. */}
            <span key={price} className="price-in inline-block">
              {price}
            </span>
          </p>
          <QtyStepper
            value={qty}
            onChange={setQty}
            labels={labels}
            label={`${labels.quantity} — ${fullName}`}
          />
        </div>
        <button
          type="button"
          onClick={addToCart}
          aria-live="polite"
          className="cta-primary cta-sheen group/cta relative mt-4 flex min-h-11 w-full items-center justify-center gap-2 overflow-hidden bg-or px-5 text-[0.74rem] font-medium uppercase tracking-[0.18em] text-noir transition-colors duration-300 hover:bg-or-clair"
        >
          {justAdded ? (
            <>
              <svg viewBox="0 0 16 16" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 8.5l3.2 3L13 4.5" />
              </svg>
              {labels.added}
            </>
          ) : (
            <>
              {labels.addToCart}
              {qty > 1 ? <span className="opacity-70">× {qty}</span> : null}
            </>
          )}
        </button>
        </div>
      </div>
    </article>
  );
}

/**
 * A pack the visitor composes, such as macarons: every variant (flavour) is
 * listed with its own quantity, starting at 0, and one click puts each chosen
 * flavour in the basket as its own line. The photo follows the last flavour
 * touched.
 */
export function ComposeCard({
  name,
  description,
  featured,
  variants,
  labels,
  priority,
  index = 0,
}: {
  name: string;
  description: string;
  featured: boolean;
  variants: readonly PackVariant[];
  labels: PackCardLabels;
  priority?: boolean;
  index?: number;
}) {
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [focused, setFocused] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const { add } = useCart();
  const listId = useId();
  const shown = variants[focused];

  const pieces = variants.reduce((n, v) => n + (qtys[v.id] ?? 0), 0);
  const total = variants.reduce((n, v) => n + (v.price ?? 0) * (qtys[v.id] ?? 0), 0);
  const onRequest = variants.some((v) => v.price === null && (qtys[v.id] ?? 0) > 0);
  const fmt = (n: number) => labels.priceFormat.replace("{price}", priceNumber.format(n));

  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(false), 1600);
    return () => clearTimeout(t);
  }, [justAdded]);

  function setQty(i: number, qty: number) {
    setQtys((prev) => ({ ...prev, [variants[i].id]: qty }));
    setFocused(i);
  }

  function addToCart() {
    for (const v of variants) {
      const qty = qtys[v.id] ?? 0;
      if (qty > 0) add({ id: v.id, name, size: v.label, price: v.price }, qty);
    }
    setQtys({});
    setJustAdded(true);
  }

  return (
    <article data-reveal data-reveal-delay={(index % 3) * 90} className="pack group/pack flex flex-col">
      <Slider
        key={shown.id}
        images={shown.images}
        alt={shown.label ? `${name} (${shown.label})` : name}
        labels={labels.slider}
        priority={priority}
        badge={featured ? labels.featuredBadge : undefined}
      />

      <div className="flex flex-1 flex-col pt-6">
        <h3 className="font-display text-[1.45rem] leading-tight text-ivoire transition-colors duration-500 group-hover/pack:text-or-profond">
          {name}
        </h3>
        <span aria-hidden className="pack-underline mt-3 block h-px w-12 bg-or/60" />
        {description ? <p className="mt-4 text-[0.95rem] leading-[1.7] text-ivoire/65">{description}</p> : null}

        <div className="mt-5">
          <p id={listId} className="text-[0.7rem] uppercase tracking-[0.2em] text-or/80">
            {labels.compose.label}
          </p>
          <p className="mt-1 text-[0.82rem] text-ivoire/55">{labels.compose.hint}</p>
          {/* Long lists scroll inside the card so it stays the size of its neighbours. */}
          <ul
            aria-labelledby={listId}
            className="mt-3 max-h-[25rem] divide-y divide-or/15 overflow-y-auto overscroll-contain border-y border-or/22 pe-1"
          >
            {variants.map((v, i) => {
              const qty = qtys[v.id] ?? 0;
              return (
                <li key={v.id} className="flex items-center gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => setFocused(i)}
                    aria-pressed={i === focused}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-start"
                  >
                    <span
                      className={`relative size-11 shrink-0 overflow-hidden border bg-white transition-colors duration-300 ${
                        i === focused ? "border-or" : "border-or/25"
                      }`}
                    >
                      <Image src={v.images[0]} alt="" fill sizes="44px" className="object-cover" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block truncate text-[0.92rem] transition-colors duration-300 ${
                          qty > 0 ? "text-or-profond" : "text-ivoire/85"
                        }`}
                      >
                        {v.label}
                      </span>
                      <span className="block text-[0.75rem] text-ivoire/45">
                        {v.price === null ? labels.priceOnRequest : fmt(v.price)}
                      </span>
                    </span>
                  </button>
                  <QtyStepper
                    value={qty}
                    min={0}
                    onChange={(q) => setQty(i, q)}
                    labels={labels}
                    label={`${labels.quantity} — ${v.label}`}
                  />
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-auto pt-6">
          <div className="flex items-baseline justify-between gap-4 pt-1" aria-live="polite">
            <span className="text-[0.74rem] uppercase tracking-[0.18em] text-ivoire/60">
              {labels.compose.count.replace("{n}", String(pieces))}
            </span>
            <span key={total} className="price-in font-display text-[1.35rem] text-or-profond">
              {fmt(total)}
              {onRequest ? " +" : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={addToCart}
            disabled={pieces === 0 && !justAdded}
            aria-live="polite"
            className="cta-primary cta-sheen group/cta relative mt-4 flex min-h-11 w-full items-center justify-center gap-2 overflow-hidden bg-or px-5 text-[0.74rem] font-medium uppercase tracking-[0.18em] text-noir transition-colors duration-300 hover:bg-or-clair disabled:pointer-events-none disabled:bg-or/30 disabled:text-noir/60"
          >
            {justAdded ? (
              <>
                <svg viewBox="0 0 16 16" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 8.5l3.2 3L13 4.5" />
                </svg>
                {labels.added}
              </>
            ) : pieces === 0 ? (
              labels.compose.empty
            ) : (
              <>
                {labels.addToCart}
                <span className="opacity-70">× {pieces}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

function Slider({
  images,
  alt,
  labels,
  priority,
  badge,
}: {
  images: readonly string[];
  alt: string;
  labels: PackCardLabels["slider"];
  priority?: boolean;
  badge?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const many = images.length > 1;

  // Follow the visible slide, whether it got there by swipe, arrow or dot.
  useEffect(() => {
    const el = track.current;
    if (!el || !many) return;
    // Slides are full width; scrollLeft runs negative in RTL, hence abs().
    const onScroll = () => setIndex(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [many]);

  // scrollTo on the track rather than scrollIntoView, so the page never moves.
  // Measured from the rendered positions, so it holds in both LTR and RTL.
  function go(i: number) {
    const el = track.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    const delta = slide.getBoundingClientRect().left - el.getBoundingClientRect().left;
    el.scrollTo({ left: el.scrollLeft + delta, behavior: "smooth" });
  }

  return (
    <div
      className="pack-frame group relative overflow-hidden bg-white"
      role={many ? "region" : undefined}
      aria-roledescription={many ? "carousel" : undefined}
      aria-label={many ? alt : undefined}
    >
      <div
        ref={track}
        className="relative flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <div
            key={src}
            className="relative h-full w-full shrink-0 snap-center overflow-hidden"
            aria-label={many ? labels.photo.replace("{n}", String(i + 1)).replace("{total}", String(images.length)) : undefined}
            role={many ? "group" : undefined}
            aria-roledescription={many ? "slide" : undefined}
          >
            <Image
              src={src}
              alt={alt}
              fill
              priority={priority && i === 0}
              sizes="(max-width: 768px) 92vw, (max-width: 1024px) 46vw, 30vw"
              className="pack-img object-contain"
            />
          </div>
        ))}
      </div>

      {/* Hairline frame that steps in on hover, and the unveiling curtain. */}
      <span aria-hidden className="pack-hairline pointer-events-none absolute inset-3" />
      <span aria-hidden className="pack-veil pointer-events-none absolute inset-0 bg-brou-clair" />

      {badge ? (
        <span className="pack-badge absolute start-3 top-3 overflow-hidden bg-or px-3 py-1.5 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-noir">
          {badge}
        </span>
      ) : null}

      {many ? (
        <>
          <SlideButton
            label={labels.prev}
            side="start"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          />
          <SlideButton
            label={labels.next}
            side="end"
            disabled={index === images.length - 1}
            onClick={() => go(index + 1)}
          />
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                aria-label={labels.photo
                  .replace("{n}", String(i + 1))
                  .replace("{total}", String(images.length))}
                aria-current={i === index}
                onClick={() => go(i)}
                className="grid size-6 place-items-center"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? "w-5 bg-or" : "w-1.5 bg-or/35"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function SlideButton({
  label,
  side,
  disabled,
  onClick,
}: {
  label: string;
  side: "start" | "end";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-or/30 bg-white/90 text-or-profond shadow-sm transition-opacity duration-200 hover:border-or disabled:pointer-events-none disabled:opacity-0 ${
        side === "start" ? "start-2" : "end-2"
      }`}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className={`size-4 ${side === "start" ? "rotate-180 rtl:rotate-0" : "rtl:rotate-180"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M6 3l5 5-5 5" />
      </svg>
    </button>
  );
}
