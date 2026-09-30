import Link from "next/link";
import { Bonbon } from "@/components/bonbon";
import { Mark, Wordmark } from "@/components/mark";
import { Cubes, Khatem, Lattice, StarRule } from "@/components/ornament";
import { Photo } from "@/components/photo";
import {
  CtaGhost,
  CtaPrimary,
  Eyebrow,
  Lede,
  Section,
  Title,
} from "@/components/ui";
import type { Locale } from "@/lib/locales";
import { whatsappLink } from "@/lib/site";
import { flavours } from "@/lib/flavours";
import { photos } from "@/lib/photos";
import { palette } from "@/lib/theme";
import { getDictionary } from "./dictionaries";

type OriginCopy = {
  place: string;
  coord: string;
  title: string;
  body: string;
  photo: string;
};

function Origin({
  origin,
  src,
  pending,
  delay = 0,
}: {
  origin: OriginCopy;
  src: string;
  pending: string;
  delay?: number;
}) {
  return (
    <div data-reveal data-reveal-delay={delay}>
      <Photo
        src={src || undefined}
        alt={origin.photo}
        caption={origin.photo}
        pending={pending}
        className="aspect-[3/4] w-full"
      />
      <div className="mt-8 flex items-baseline justify-between gap-4 border-b border-or/20 pb-3">
        <span className="eyebrow">{origin.place}</span>
        <span className="font-body text-[0.72rem] tracking-[0.18em] text-ivoire/40">
          {origin.coord}
        </span>
      </div>
      <h3 className="monument mt-6 text-2xl text-or-clair md:text-3xl">{origin.title}</h3>
      <p className="mt-4 max-w-[42ch] text-[0.95rem] leading-[1.8] text-ivoire/60">
        {origin.body}
      </p>
    </div>
  );
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  const t = await getDictionary(lang);
  const l = lang as Locale;
  const [line1, line2] = t.hero.title.split("\n");
  const blanc = palette === "blanc";

  return (
    <>
      {/* ── Hero: the mark behind a carved screen, lit from one side ── */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden">
        {blanc ? (
          /* The lid of the box: cube bands top and bottom, the name framed between. */
          <Cubes
            id="cubes-hero"
            className="pointer-events-none absolute inset-0 text-or/45"
            scale={1.5}
          />
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
          <Mark
            title={t.meta.ogAlt}
            className="rise mx-auto h-28 w-[5.2rem] md:h-40 md:w-[7.4rem]"
          />

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

          <h1
            className="rise monument mx-auto mt-6 max-w-[16ch] text-[clamp(2.5rem,7vw,5.25rem)] text-ivoire"
            style={{ animationDelay: "260ms" }}
          >
            {line1}
            {line2 ? (
              <>
                <br />
                <span className="text-or-clair">{line2}</span>
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
            <CtaGhost href={`/${l}/contact`}>{t.hero.secondary}</CtaGhost>
          </div>

          <p
            className="rise mt-20 text-[0.62rem] uppercase tracking-[0.3em] text-ivoire/30 md:mt-24"
            style={{ animationDelay: "700ms" }}
            aria-hidden
          >
            {t.hero.scroll}
          </p>
        </div>
      </section>

      {/* ── Two origins, 2 400 km apart, facing each other ── */}
      <Section className="border-t border-or/15">
        <div data-reveal className="max-w-[60ch]">
          <Eyebrow>{t.origins.eyebrow}</Eyebrow>
          <Title className="mt-5">{t.origins.title}</Title>
          <Lede className="mt-7">{t.origins.lede}</Lede>
        </div>

        <div className="mt-16 grid items-start gap-12 md:mt-24 md:grid-cols-[1fr_auto_1fr] md:gap-10">
          {/* left origin — star — right origin, in that order, so the two
              sides read as meeting in the middle at any width */}
          <Origin
            origin={t.origins.left}
            src={photos.originLeft}
            pending={t.ui.photoPending}
          />

          <div
            data-reveal
            data-reveal-delay="80"
            className="flex items-center gap-5 md:flex-col md:justify-center md:self-stretch"
          >
            <span className="h-px flex-1 bg-or/25 md:h-auto md:w-px md:flex-1" />
            <Khatem size={30} className="mx-2 my-2 text-or/70" />
            <span className="h-px flex-1 bg-or/25 md:h-auto md:w-px md:flex-1" />
          </div>

          <Origin
            origin={t.origins.right}
            src={photos.originRight}
            pending={t.ui.photoPending}
            delay={140}
          />
        </div>
      </Section>

      {/* ── The shop: dates and chocolates, laid out as the tray inside a coffret ── */}
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

        <div
          data-reveal
          className="mt-14 grid gap-px bg-or/25 md:mt-20 md:grid-cols-12"
          style={{ gridAutoRows: "minmax(0, auto)" }}
        >
          {t.collections.items.map((item, i) => {
            const isDfou3 = item.slug === "dfou3";
            const span = ["md:col-span-6", "md:col-span-6", "md:col-span-12"][i];

            return (
              <Link
                key={item.slug}
                href={isDfou3 ? `/${l}/contact` : `/${l}/collections`}
                className={`group flex min-h-[15rem] flex-col justify-between px-6 py-8 transition-colors duration-500 md:p-9 ${span} ${
                  isDfou3
                    ? "panel-accent hover:bg-accent-hover"
                    : "bg-noir hover:bg-brou"
                }`}
              >
                <div>
                  <p className="eyebrow">{item.line}</p>
                  <h3
                    className={`monument mt-4 text-[1.7rem] md:text-[2.1rem] ${
                      isDfou3 ? "" : "text-ivoire"
                    }`}
                  >
                    {item.name}
                  </h3>
                </div>

                <div className="mt-10">
                  <p
                    className={`text-[0.72rem] uppercase tracking-[0.2em] ${
                      isDfou3 ? "on-accent-dim" : "text-or/70"
                    }`}
                  >
                    {t.collections.composition}
                  </p>
                  <p
                    className={`mt-2.5 max-w-[42ch] text-[0.92rem] leading-[1.7] ${
                      isDfou3 ? "on-accent-dim" : "text-ivoire/60"
                    }`}
                  >
                    {item.composition}
                  </p>
                  <p
                    className={`mt-5 max-w-[40ch] font-display text-[0.98rem] leading-snug ${
                      isDfou3 ? "on-accent-em" : "text-or-clair/70"
                    }`}
                  >
                    {item.note}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <div data-reveal className="mt-12 flex justify-center">
          <CtaGhost href={`/${l}/collections`}>{t.collections.cta}</CtaGhost>
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
            {flavours.map((flavour) => {
              const copy = t.flavours.items[flavour.slug];
              return (
                <li
                  key={flavour.slug}
                  className="group flex w-1/2 flex-col items-center px-2 text-center sm:w-1/3 md:w-1/5"
                >
                  <Bonbon
                    flavour={flavour}
                    className="h-auto w-[4.5rem] transition-transform duration-500 ease-[var(--ease-lantern)] group-hover:-translate-y-1.5 md:w-[5.25rem]"
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

      {/* ── Dfou3 ── */}
      <section className="panel-accent relative overflow-hidden px-5 py-24 md:px-10 md:py-32">
        <Lattice
          id="lattice-dfou3"
          className={`pointer-events-none absolute inset-0 ${
            blanc ? "text-on-accent-eyebrow/[0.12]" : "text-on-accent-title/[0.09]"
          }`}
          scale={1.1}
        />
        <div className="relative mx-auto grid max-w-[82rem] gap-14 md:grid-cols-2 md:gap-20">
          <div data-reveal>
            <Eyebrow>{t.dfou3.eyebrow}</Eyebrow>
            <Title className="mt-5">{t.dfou3.title}</Title>
            <Lede className="on-accent-dim mt-7">{t.dfou3.lede}</Lede>
            <p className="on-accent-dim mt-5 max-w-[54ch] text-[0.95rem] leading-[1.8] opacity-85">
              {t.dfou3.body}
            </p>
            <div className="mt-10">
              <CtaPrimary href={`/${l}/contact`}>{t.dfou3.cta}</CtaPrimary>
            </div>
            <p className="on-accent-dim mt-6 text-[0.82rem] opacity-80">{t.dfou3.lead}</p>
          </div>

          <dl
            data-reveal
            data-reveal-delay="120"
            className="grid gap-px self-start bg-on-accent/20 sm:grid-cols-2"
          >
            {t.dfou3.points.map((point) => (
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
