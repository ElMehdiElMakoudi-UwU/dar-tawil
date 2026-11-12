import Image from "next/image";
import { Khatem } from "./ornament";

/**
 * Two slow moving bands. Each renders its run twice and slides by exactly one
 * run, so the loop never shows a seam. The second copy is hidden from
 * assistive tech. The band is pinned LTR so the loop arithmetic is the same
 * in Arabic; each word keeps its own direction.
 */

/** A ribbon of names, set like the band printed around the lid. */
export function Ribbon({ items, className = "" }: { items: string[]; className?: string }) {
  const run = (copy: boolean) => (
    <ul aria-hidden={copy || undefined} className="flex shrink-0 items-center">
      {items.map((item, i) => (
        <li key={`${item}-${i}`} className="flex items-center">
          <span dir="auto" className="px-7 font-display text-[clamp(1.6rem,3.4vw,2.6rem)] leading-none text-ivoire/80 md:px-10">
            {item}
          </span>
          <Khatem size={16} className="text-or/60" />
        </li>
      ))}
    </ul>
  );

  return (
    <div dir="ltr" className={`ribbon relative overflow-hidden ${className}`}>
      <div className="ribbon-track flex w-max">
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}

/** A procession of arches that drifts past and stops when you look at one. */
export function Procession({ slides }: { slides: { src: string; alt: string }[] }) {
  const run = (copy: boolean) => (
    <ul aria-hidden={copy || undefined} className="flex shrink-0 items-start gap-6 pe-6 md:gap-10 md:pe-10">
      {slides.map((slide, i) => (
        <li
          key={`${slide.src}-${i}`}
          className={`procession-item shrink-0 ${i % 2 ? "mt-14 md:mt-20" : ""}`}
        >
          <figure
            className="relative aspect-[3/4] w-[13.5rem] overflow-hidden bg-brou md:w-[18rem]"
            style={{ clipPath: "url(#dt-arch)" }}
          >
            <Image
              src={slide.src}
              alt={copy ? "" : slide.alt}
              fill
              sizes="(max-width: 768px) 14rem, 18rem"
              className="procession-img object-cover"
            />
          </figure>
        </li>
      ))}
    </ul>
  );

  return (
    <div dir="ltr" className="procession relative overflow-hidden py-4">
      <div className="procession-track flex w-max">
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}
