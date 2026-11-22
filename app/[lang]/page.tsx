import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Bonbon } from "@/components/bonbon";
import { Mark, Wordmark } from "@/components/mark";
import { Cubes, Lattice, StarRule } from "@/components/ornament";
import { Photo } from "@/components/photo";
import { Procession, Ribbon } from "@/components/procession";
import {
  CtaGhost,
  CtaPrimary,
  Eyebrow,
  Lede,
  Section,
  Title,
} from "@/components/ui";
import { getCatalog, getCategoryRows, localized, type Pack } from "@/lib/catalog";
import type { Locale } from "@/lib/locales";
import { reviews } from "@/lib/reviews";
import { whatsappLink } from "@/lib/site";
import { flavours } from "@/lib/flavours";
import { photos } from "@/lib/photos";
import { palette } from "@/lib/theme";
import { getDictionary } from "./dictionaries";

/** A line set word by word, each word rising out of its own slot. */
function Words({ text, start }: { text: string; start: number }) {
  return text.split(" ").map((word, i) => (
    <span key={`${word}-${i}`}>
      <span className="word">
        <span className="word-in" style={{ animationDelay: `${start + i * 85}ms` }}>
          {word}
        </span>
      </span>{" "}
    </span>
  ));
}

const priceNumber = new Intl.NumberFormat("fr-FR");

/**
 * The rubriques that get a door on the home page, each with its own photo
 * (lib/photos.ts) and lines (content/*.ts collections.categories). Rubriques
 * added later in /gestion appear on the Collections page only.
 */
const doors = ["boxChocolat", "dattes", "tablettes", "evenements"] as const;

/**
 * The rubrique names, and up to three packs for the home page: the featured
 * ones first, then one per rubrique so the row shows the range rather than
 * three of a kind. The database may be unreachable (a fresh checkout, a
 * build): the doors and the row are then simply left out.
 */
async function getHome(lang: Locale): Promise<{ names: Map<string, string>; picks: Pack[] }> {
  let packs: Pack[];
  let names: Map<string, string>;
  try {
    const [p, cats] = await Promise.all([getCatalog(lang), getCategoryRows()]);
    packs = p;
    names = new Map(cats.map((c) => [c.slug, localized(c, "name", lang)]));
  } catch {
    return { names: new Map(), picks: [] };
  }
  const picks = packs.filter((p) => p.featured).slice(0, 3);
  for (const category of names.keys()) {
    if (picks.length >= 3) break;
    const next = packs.find((p) => p.category === category && !picks.includes(p));
    if (next) picks.push(next);
  }
  return { names, picks };
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  const t = await getDictionary(lang);
  const l = lang as Locale;
  const [line1, line2] = t.hero.title.split("\n");
  const blanc = palette === "blanc";
  // Rendered per request: the packs are edited live in /gestion.
  await connection();
  const { names, picks } = await getHome(l);
  const boardReviews = reviews.slice(0, 2);

  return (
    <>
      {/* ── Hero: the mark behind a carved screen, lit from one side ── */}
      <section
        data-pointer
        className="hero relative flex min-h-[100svh] items-center overflow-hidden"
      >
        {blanc ? (
          /* The lid of the box: cube bands top and bottom, the name framed between. */
          <div aria-hidden className="hero-ground pointer-events-none absolute -inset-8">
            <Cubes id="cubes-hero" className="absolute inset-0 text-or/45" scale={1.5} />
          </div>
        ) : (
          <>
            <Lattice
              id="lattice-hero"
              className="pointer-events-none absolute inset-0 text-or/[0.11]"
              scale={1.35}
            />
            <div
              aria-hidden
              className="lantern-sweep pointer-events-none absolute -inset-x-1/3 inset-y-0"
              style={{
                background:
                  "radial-gradient(58% 62% at 50% 42%, rgba(190,148,85,0.20) 0%, rgba(190,148,85,0.07) 38%, transparent 70%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgb(var(--veil) / 0.72) 0%, rgb(var(--veil) / 0.25) 38%, rgb(var(--veil) / 0.86) 100%)",
              }}
            />
          </>
        )}

        <div className="relative mx-auto w-full max-w-[82rem] px-5 pb-24 pt-32 text-center md:px-10 md:pb-28 md:pt-36">
          <div className="hero-mark rise mx-auto w-fit">
            <Mark
              title={t.meta.ogAlt}
              className="mark-shine h-28 w-[5.2rem] md:h-40 md:w-[7.4rem]"
            />
          </div>

          {blanc ? (
            <div
              className="rise mx-auto mt-9 inline-flex flex-col items-center gap-2 border border-or/60 bg-noir px-9 pb-4 pt-5 md:px-12"
              style={{ animationDelay: "160ms" }}
            >
              <Wordmark size="lg" />
              <p className="eyebrow">{t.hero.eyebrow}</p>
            </div>
          ) : (
            <p className="rise eyebrow mt-9" style={{ animationDelay: "160ms" }}>
              {t.hero.eyebrow}
            </p>
          )}

          <h1 className="monument mx-auto mt-6 max-w-[16ch] text-[clamp(2.5rem,7vw,5.25rem)] text-ivoire">
            <Words text={line1} start={260} />
            {line2 ? (
              <>
                <br />
                <span className="text-or-clair">
                  <Words text={line2} start={260 + line1.split(" ").length * 85 + 60} />
                </span>
              </>
            ) : null}
          </h1>

          <p
            className="rise mx-auto mt-8 max-w-[46ch] text-[1.02rem] leading-[1.8] text-ivoire/65"
            style={{ animationDelay: "380ms" }}
          >
            {t.hero.lede}
          </p>

          <div
            className="rise mt-11 flex flex-wrap items-center justify-center gap-4"
            style={{ animationDelay: "500ms" }}
          >
            <CtaPrimary href={`/${l}/collections`}>{t.hero.primary}</CtaPrimary>
            <CtaGhost href={`/${l}/avis`}>{t.hero.secondary}</CtaGhost>
          </div>

          <div
            className="rise mt-16 flex flex-col items-center gap-4 md:mt-20"
            style={{ animationDelay: "900ms" }}
            aria-hidden
          >
            <p className="text-[0.62rem] uppercase tracking-[0.3em] text-ivoire/35">
              {t.hero.scroll}
            </p>
            <span className="scroll-cue block h-12 w-px" />
          </div>
        </div>
      </section>

      {/* ── The bonbon flavours, drifting past like the band round a lid ── */}
      <Ribbon
        className="border-y border-or/20 py-7 md:py-9"
        items={flavours.map((f) => t.flavours.items[f.slug].name)}
      />

      {/* ── The collections: four doors into the catalog, then the house's picks ── */}
      <Section className="border-t border-or/15">
        <div
          data-reveal
          className="grid gap-8 md:grid-cols-[1.15fr_0.85fr] md:items-end md:gap-16"
        >
          <div>
            <Eyebrow>{t.collections.eyebrow}</Eyebrow>
            <Title className="mt-5">{t.collections.title}</Title>
          </div>
          <Lede className="md:justify-self-end">{t.collections.lede}</Lede>
        </div>

        <ul
          data-reveal
          className="mt-14 grid gap-px bg-or/25 sm:grid-cols-2 md:mt-20 lg:grid-cols-4"
        >
          {doors.filter((category) => names.has(category)).map((category) => {
            const copy = t.collections.categories[category];
            const name = names.get(category)!;
            return (
              <li key={category} className="bg-noir">
                <Link
                  href={`/${l}/collections#${category}`}
                  className="tile group relative flex h-full flex-col px-6 pb-8 pt-6 transition-colors duration-500 hover:bg-brou md:px-7"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-white">
                    <Image
                      src={photos.categories[category]}
                      alt={name}
                      fill
                      sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 22vw"
                      className="object-contain transition-[scale] duration-[1.2s] ease-[var(--ease-lantern)] group-hover:scale-[1.04]"
                    />
                  </div>
                  <p className="eyebrow mt-7">{copy.line}</p>
                  <h3 className="monument mt-3 text-[1.5rem] text-ivoire md:text-[1.65rem]">
                    {name}
                  </h3>
                  <p className="mt-3 max-w-[34ch] text-[0.9rem] leading-[1.7] text-ivoire/60">
                    {copy.note}
                  </p>
                  <span
                    aria-hidden
                    className="mt-auto pt-6 text-or transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {picks.length > 0 ? (
          <div className="mt-20 md:mt-28">
            <div data-reveal className="cat-head relative flex items-baseline gap-5 pb-5">
              <h3 className="monument text-[clamp(1.4rem,2.6vw,1.9rem)] text-ivoire">
                {t.collections.featuredTitle}
              </h3>
              <span aria-hidden className="cat-rule absolute inset-x-0 bottom-0 h-px" />
            </div>
            <ul className="mt-10 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10">
              {picks.map((pack, i) => {
                const prices = pack.variants
                  .map((v) => v.price)
                  .filter((p): p is number => p !== null);
                const price = prices.length
                  ? t.collections.fromPrice.replace(
                      "{price}",
                      priceNumber.format(Math.min(...prices)),
                    )
                  : t.collections.priceOnRequest;
                return (
                  <li key={pack.id} data-reveal data-reveal-delay={i * 140}>
                    <Link href={`/${l}/collections#${pack.category}`} className="pack group/pack block">
                      <div className="pack-frame relative aspect-[4/5] overflow-hidden bg-white">
                        <Image
                          src={pack.variants[0].images[0]}
                          alt={pack.name}
                          fill
                          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 30vw"
                          className="pack-img object-contain"
                        />
                        {pack.featured ? (
                          <span className="absolute start-3 top-3 bg-or px-3 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.18em] text-noir">
                            {t.collectionsPage.featuredBadge}
                          </span>
                        ) : null}
                      </div>
                      <p className="eyebrow mt-6">{names.get(pack.category)}</p>
                      <h4 className="mt-2 font-display text-[1.4rem] leading-tight text-ivoire transition-colors duration-500 group-hover/pack:text-or-profond">
                        {pack.name}
                      </h4>
                      <span aria-hidden className="pack-underline mt-3 block h-px w-12 bg-or/60" />
                      <p className="mt-4 font-display text-[1.1rem] text-or-profond">{price}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div data-reveal className="mt-14 flex justify-center md:mt-16">
          <CtaPrimary href={`/${l}/collections`}>{t.collections.cta}</CtaPrimary>
        </div>
      </Section>

      {/* ── In the customers' own words: three lines, two screenshots ── */}
      <Section className="border-t border-or/15">
        <div className="grid items-center gap-16 md:grid-cols-[1.05fr_0.95fr] md:gap-20">
          <div>
            <div data-reveal>
              <Eyebrow>{t.avisPage.eyebrow}</Eyebrow>
              <Title className="mt-5">{t.avisPage.title}</Title>
              <Lede className="mt-7">{t.avisPage.teaserLede}</Lede>
            </div>

            <ul className="mt-12 divide-y divide-or/20 border-y border-or/20">
              {t.avisPage.quotes.map((q, i) => (
                <li
                  key={q.text}
                  data-reveal
                  data-reveal-delay={i * 110}
                  className="flex gap-5 py-6"
                >
                  <span aria-hidden className="font-display text-4xl leading-none text-or/50">
                    “
                  </span>
                  <div>
                    <blockquote
                      dir="auto"
                      className="font-display text-[1.3rem] leading-snug text-ivoire"
                    >
                      {q.text}
                    </blockquote>
                    <p className="mt-2 text-[0.88rem] leading-relaxed text-ivoire/55">{q.gloss}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div data-reveal className="mt-10">
              <CtaGhost href={`/${l}/avis`}>{t.avisPage.teaserCta}</CtaGhost>
            </div>
          </div>

          {/* Two screenshots pinned to the board, overlapping. */}
          <div data-reveal data-reveal-delay="120" className="relative mx-auto w-full max-w-[30rem] pb-10">
            {boardReviews.map((r, i) => (
              <figure
                key={r.src}
                className={`border border-or/30 bg-brou p-2.5 shadow-[0_18px_40px_-24px_rgb(60_40_20/0.45)] transition-transform duration-500 ease-[var(--ease-lantern)] hover:z-10 hover:rotate-0 ${
                  i === 0
                    ? "relative w-[78%] -rotate-[1.6deg]"
                    : "absolute bottom-0 end-0 w-[56%] rotate-[2.2deg]"
                }`}
              >
                <Image
                  src={r.src}
                  width={r.width}
                  height={r.height}
                  alt={`${t.avisPage.altPrefix} ${r.transcript.join(" — ")}`}
                  sizes="(max-width: 768px) 70vw, 24rem"
                  className="h-auto w-full"
                />
              </figure>
            ))}
          </div>
        </div>
      </Section>

      {/* ── The bonbons, set out like the house's flavour card ── */}
      <Section className="border-t border-or/15">
        <div data-reveal className="mx-auto max-w-[52ch] text-center">
          <Eyebrow>{t.flavours.eyebrow}</Eyebrow>
          <Title className="mt-5">{t.flavours.title}</Title>
          <Lede className="mx-auto mt-7">{t.flavours.lede}</Lede>
        </div>

        <div
          data-reveal
          className="relative mt-14 overflow-hidden border border-or/35 px-4 py-12 md:mt-20 md:px-12 md:py-16"
        >
          <Lattice
            id="lattice-flavours"
            className={`pointer-events-none absolute inset-0 ${
              blanc ? "text-or/[0.09]" : "text-or/[0.06]"
            }`}
            scale={1.2}
          />
          {/* Five to a row, the last row centred — the layout of the printed card. */}
          <ul className="relative flex flex-wrap justify-center gap-y-12">
            {flavours.map((flavour, i) => {
              const copy = t.flavours.items[flavour.slug];
              return (
                <li
                  key={flavour.slug}
                  style={{ ["--i" as string]: i }}
                  className="bonbon-item group flex w-1/2 flex-col items-center px-2 text-center sm:w-1/3 md:w-1/5"
                >
                  <Bonbon
                    flavour={flavour}
                    className="bonbon h-auto w-[4.5rem] md:w-[5.25rem]"
                  />
                  <h3 className="mt-4 font-display text-[1.05rem] leading-snug text-ivoire">
                    {copy.name}
                  </h3>
                  <p className="mt-1.5 max-w-[20ch] text-[0.8rem] leading-relaxed text-ivoire/55">
                    {copy.note}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>

        <div data-reveal className="mt-12 flex justify-center">
          <CtaGhost href={`/${l}/collections`}>{t.flavours.cta}</CtaGhost>
        </div>
      </Section>

      {/* ── A procession of arches: the shop's own photographs, drifting past ── */}
      <section aria-label={t.collections.eyebrow} className="pb-24 md:pb-32">
        <Procession
          slides={photos.gallery.map((src, i) => ({
            src,
            alt: t.collections.gallery[i] ?? "",
          }))}
        />
      </section>

      {/* ── Made to order: the inverted panel ── */}
      <section className="panel-accent relative overflow-hidden px-5 py-24 md:px-10 md:py-32">
        <Lattice
          id="lattice-bespoke"
          /* one tile (120 × 1.1) of slack each side, so the slow drift loops seamlessly */
          className={`lattice-drift pointer-events-none absolute -left-[132px] -top-[132px] h-[calc(100%+264px)] w-[calc(100%+264px)] ${
            blanc ? "text-on-accent-eyebrow/[0.12]" : "text-on-accent-title/[0.09]"
          }`}
          scale={1.1}
        />
        <div className="relative mx-auto grid max-w-[82rem] gap-14 md:grid-cols-2 md:gap-20">
          <div data-reveal>
            <Eyebrow>{t.bespoke.eyebrow}</Eyebrow>
            <Title className="mt-5">{t.bespoke.title}</Title>
            <Lede className="on-accent-dim mt-7">{t.bespoke.lede}</Lede>
            <p className="on-accent-dim mt-5 max-w-[54ch] text-[0.95rem] leading-[1.8] opacity-85">
              {t.bespoke.body}
            </p>
            <div className="mt-10">
              <CtaPrimary href={whatsappLink(t.bespoke.whatsappMessage)} external>
                {t.bespoke.cta}
              </CtaPrimary>
            </div>
            <p className="on-accent-dim mt-6 text-[0.82rem] opacity-80">{t.bespoke.lead}</p>
          </div>

          <dl
            data-reveal
            data-reveal-delay="120"
            className="grid gap-px self-start bg-on-accent/20 sm:grid-cols-2"
          >
            {t.bespoke.points.map((point) => (
              <div key={point.title} className="bg-accent p-7">
                <dt className="monument on-accent-em text-lg">{point.title}</dt>
                <dd className="on-accent-dim mt-3 text-[0.9rem] leading-[1.75]">
                  {point.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── How it's made: three places, not three numbers ── */}
      <Section>
        <div data-reveal className="max-w-[50ch]">
          <Eyebrow>{t.savoirFaire.eyebrow}</Eyebrow>
          <Title className="mt-5">{t.savoirFaire.title}</Title>
        </div>

        <div className="mt-14 grid gap-12 md:mt-20 md:grid-cols-3 md:gap-0">
          {t.savoirFaire.steps.map((step, i) => (
            <div
              key={step.place}
              data-reveal
              data-reveal-delay={i * 120}
              className={`md:px-10 ${i > 0 ? "md:border-s md:border-or/18" : "md:ps-0"} ${
                i === t.savoirFaire.steps.length - 1 ? "md:pe-0" : ""
              }`}
            >
              <p className="eyebrow">{step.place}</p>
              <h3 className="monument mt-5 text-[1.55rem] leading-tight text-or-clair">
                {step.title}
              </h3>
              <p className="mt-5 text-[0.95rem] leading-[1.8] text-ivoire/60">
                {step.body}
              </p>
            </div>
          ))}
        </div>

        <StarRule className="mt-20 md:mt-28" />
      </Section>

      {/* ── Visit ── */}
      <Section className="pt-0 md:pt-0">
        <div className="grid items-center gap-14 md:grid-cols-[1fr_0.85fr] md:gap-20">
          <div data-reveal>
            <Eyebrow>{t.visit.eyebrow}</Eyebrow>
            <Title className="mt-5">{t.visit.title}</Title>
            <Lede className="mt-7">{t.visit.lede}</Lede>

            <div className="mt-12 grid gap-10 sm:grid-cols-2">
              <div>
                <h3 className="eyebrow">{t.visit.addressLabel}</h3>
                <address className="mt-4 space-y-1 text-[0.95rem] not-italic leading-relaxed text-ivoire/65">
                  {t.visit.address.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </address>
              </div>
              <div>
                <h3 className="eyebrow">{t.visit.hoursLabel}</h3>
                <div className="mt-4 space-y-1 text-[0.95rem] leading-relaxed text-ivoire/65">
                  {t.visit.hours.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12">
              <CtaPrimary href={whatsappLink()} external>
                {t.visit.cta}
              </CtaPrimary>
            </div>
          </div>

          <Photo
            src={photos.visit || undefined}
            alt={t.visit.title}
            caption={t.visit.addressLabel}
            pending={t.ui.photoPending}
            className="aspect-[4/5] w-full"
          />
        </div>
      </Section>
    </>
  );
}
