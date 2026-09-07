import type { Metadata } from "next";
import { Photo } from "@/components/photo";
import { StarRule } from "@/components/ornament";
import { CtaPrimary, Lede, PageHeader, Section, Title } from "@/components/ui";
import { whatsappLink } from "@/lib/site";
import { photos } from "@/lib/photos";
import { getDictionary } from "../dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/dfou3">): Promise<Metadata> {
  const { lang } = await params;
  const t = await getDictionary(lang);
  return { title: t.dfou3Page.eyebrow, description: t.dfou3Page.lede };
}

export default async function Dfou3Page({ params }: PageProps<"/[lang]/dfou3">) {
  const { lang } = await params;
  const t = await getDictionary(lang);

  return (
    <>
      <PageHeader
        eyebrow={t.dfou3Page.eyebrow}
        title={t.dfou3Page.title}
        lede={t.dfou3Page.lede}
      />

      <Section>
        <div className="grid gap-14 md:grid-cols-[1fr_0.8fr] md:gap-20">
          <div data-reveal>
            <p className="text-[1.15rem] leading-[1.9] text-ivoire/80">
              {t.dfou3.body}
            </p>

            <dl className="mt-12 grid gap-px bg-or/22 sm:grid-cols-2">
              {t.dfou3.points.map((point) => (
                <div key={point.title} className="bg-noir p-7">
                  <dt className="monument text-lg text-or-clair">{point.title}</dt>
                  <dd className="mt-3 text-[0.92rem] leading-[1.75] text-ivoire/60">
                    {point.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <Photo
            src={photos.dfou3 || undefined}
            alt={t.dfou3Page.photo}
            caption={t.dfou3Page.photo}
            pending={t.ui.photoPending}
            className="aspect-[3/4] w-full"
          />
        </div>

        <StarRule className="mt-24 md:mt-32" />

        {/* A real sequence — so it is numbered, and the numbers mean something. */}
        <div className="mt-20 md:mt-28">
          <div data-reveal>
            <Title className="max-w-[20ch]">{t.dfou3Page.processTitle}</Title>
            <p className="mt-6 text-[0.88rem] text-ivoire/45">{t.dfou3.lead}</p>
          </div>

          <ol className="mt-14 space-y-px bg-or/22">
            {t.dfou3Page.process.map((stage, i) => (
              <li
                key={stage.step}
                data-reveal
                data-reveal-delay={i * 90}
                className="grid gap-4 bg-noir p-8 md:grid-cols-[5rem_14rem_1fr] md:items-baseline md:gap-8 md:p-9"
              >
                <span className="font-display text-sm tracking-[0.2em] text-or/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="monument text-xl text-or-clair">{stage.step}</h3>
                <p className="max-w-[62ch] text-[0.95rem] leading-[1.8] text-ivoire/62">
                  {stage.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section className="border-t border-or/15 pt-0 md:pt-0">
        <div className="grid gap-12 pt-24 md:grid-cols-[0.7fr_1fr] md:gap-20 md:pt-32">
          <div data-reveal>
            <Title>{t.dfou3Page.faqTitle}</Title>
          </div>

          <div data-reveal className="divide-y divide-or/15 border-y border-or/15">
            {t.dfou3Page.faq.map((entry) => (
              <details key={entry.q} className="group py-6">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 font-display text-[1.15rem] text-ivoire transition-colors hover:text-or-clair">
                  {entry.q}
                  <span
                    aria-hidden
                    className="mt-1 shrink-0 text-or transition-transform duration-300 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-[62ch] text-[0.95rem] leading-[1.8] text-ivoire/62">
                  {entry.a}
                </p>
              </details>
            ))}
          </div>
        </div>

        <div data-reveal className="mt-20 text-center md:mt-28">
          <Lede className="mx-auto">{t.dfou3.lede}</Lede>
          <div className="mt-10 flex justify-center">
            <CtaPrimary href={whatsappLink()} external>
              {t.dfou3Page.cta}
            </CtaPrimary>
          </div>
        </div>
      </Section>
    </>
  );
}
