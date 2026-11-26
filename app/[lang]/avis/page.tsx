import type { Metadata } from "next";
import Image from "next/image";
import { StarRule } from "@/components/ornament";
import { CtaGhost, CtaPrimary, PageHeader, Section, Title } from "@/components/ui";
import { pageAlternates, type Locale } from "@/lib/locales";
import { reviews } from "@/lib/reviews";
import { whatsappLink } from "@/lib/site";
import { getDictionary } from "../dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/avis">): Promise<Metadata> {
  const { lang } = await params;
  const t = await getDictionary(lang);
  return {
    title: t.avisPage.eyebrow,
    description: t.avisPage.lede,
    alternates: pageAlternates(lang, "/avis"),
  };
}

/* A pinned-board tilt, alternating so neighbours never lean the same way. */
const tilts = ["-rotate-[1.2deg]", "rotate-[0.9deg]", "-rotate-[0.6deg]", "rotate-[1.4deg]", "-rotate-[1deg]"];

export default async function AvisPage({ params }: PageProps<"/[lang]/avis">) {
  const { lang } = await params;
  const t = await getDictionary(lang);
  const l = lang as Locale;
  const fmt = new Intl.DateTimeFormat(l === "ar" ? "ar-MA" : l, {
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <PageHeader
        eyebrow={t.avisPage.eyebrow}
        title={t.avisPage.title}
        lede={t.avisPage.lede}
      />

      <Section>
        {/* A few lines lifted out of the screenshots, in the customers' own words. */}
        <ul className="grid gap-px bg-or/22 md:grid-cols-3">
          {t.avisPage.quotes.map((q, i) => (
            <li
              key={q.text}
              data-reveal
              data-reveal-delay={i * 110}
              className="flex flex-col bg-noir p-9 md:p-10"
            >
              <span aria-hidden className="font-display text-5xl leading-none text-or/50">
                “
              </span>
              <blockquote
                dir="auto"
                className="mt-3 font-display text-[1.45rem] leading-snug text-ivoire"
              >
                {q.text}
              </blockquote>
              <p className="mt-4 text-[0.9rem] leading-relaxed text-ivoire/55">{q.gloss}</p>
            </li>
          ))}
        </ul>

        <StarRule className="mt-24 md:mt-32" />

        <div data-reveal className="mt-20 md:mt-28">
          <Title className="max-w-[22ch]">{t.avisPage.wallTitle}</Title>
          <p className="mt-5 max-w-[54ch] text-[0.95rem] leading-[1.75] text-ivoire/60">
            {t.avisPage.wallNote}
          </p>
        </div>

        <div className="mt-14 mx-auto max-w-[64rem] columns-1 gap-10 sm:columns-2 md:gap-14 [&>*]:mb-12">
          {reviews.map((r, i) => (
            <figure
              key={r.src}
              data-reveal
              data-reveal-delay={(i % 3) * 110}
              className="break-inside-avoid"
            >
              <div
                className={`border border-or/30 bg-brou p-2.5 shadow-[0_18px_40px_-24px_rgb(60_40_20/0.45)] transition-transform duration-500 ease-[var(--ease-lantern)] hover:rotate-0 ${tilts[i % tilts.length]}`}
              >
                <Image
                  src={r.src}
                  width={r.width}
                  height={r.height}
                  alt={`${t.avisPage.altPrefix} ${r.transcript.join(" — ")}`}
                  sizes="(max-width: 640px) 92vw, 30rem"
                  className="h-auto w-full"
                />
              </div>
              <figcaption className="mt-4 flex items-center justify-between gap-4 px-1">
                <span className="eyebrow">
                  {r.kind === "story" ? t.avisPage.story : t.avisPage.messages}
                </span>
                <time dateTime={r.date} className="text-[0.8rem] text-ivoire/50">
                  {fmt.format(new Date(r.date))}
                </time>
              </figcaption>
            </figure>
          ))}
        </div>

        <div
          data-reveal
          className="mt-16 flex flex-col items-center gap-8 border-t border-or/20 pt-16 text-center md:mt-24"
        >
          <Title className="max-w-[20ch]">{t.avisPage.ctaTitle}</Title>
          <p className="max-w-[46ch] text-[0.98rem] leading-[1.75] text-ivoire/60">
            {t.avisPage.ctaBody}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <CtaPrimary href={whatsappLink(t.avisPage.whatsappMessage)} external>
              {t.avisPage.cta}
            </CtaPrimary>
            <CtaGhost href={`/${l}/collections`}>{t.collections.cta}</CtaGhost>
          </div>
        </div>
      </Section>
    </>
  );
}
