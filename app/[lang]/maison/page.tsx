import type { Metadata } from "next";
import { Photo } from "@/components/photo";
import { StarRule } from "@/components/ornament";
import { CtaPrimary, PageHeader, Section, Title } from "@/components/ui";
import type { Locale } from "@/lib/locales";
import { photos } from "@/lib/photos";
import { getDictionary } from "../dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/maison">): Promise<Metadata> {
  const { lang } = await params;
  const t = await getDictionary(lang);
  return { title: t.maisonPage.eyebrow, description: t.maisonPage.lede };
}

export default async function MaisonPage({ params }: PageProps<"/[lang]/maison">) {
  const { lang } = await params;
  const t = await getDictionary(lang);
  const l = lang as Locale;

  return (
    <>
      <PageHeader
        eyebrow={t.maisonPage.eyebrow}
        title={t.maisonPage.title}
        lede={t.maisonPage.lede}
      />

      <Section>
        <div className="grid gap-14 md:grid-cols-[0.85fr_1fr] md:gap-20">
          <Photo
            src={photos.maison || undefined}
            alt={t.maisonPage.photo}
            caption={t.maisonPage.photo}
            pending={t.ui.photoPending}
            className="aspect-[3/4] w-full md:sticky md:top-32"
          />

          <div data-reveal className="space-y-7">
            {t.maisonPage.body.map((paragraph, i) => (
              <p
                key={paragraph.slice(0, 24)}
                className={`leading-[1.9] text-ivoire/70 ${
                  i === 0 ? "text-[1.15rem] text-ivoire/85" : "text-[1rem]"
                }`}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <StarRule className="mt-24 md:mt-32" />

        <div className="mt-20 md:mt-28">
          <div data-reveal>
            <Title className="max-w-[22ch]">{t.maisonPage.valuesTitle}</Title>
          </div>

          <dl className="mt-14 grid gap-px bg-or/22 md:grid-cols-3">
            {t.maisonPage.values.map((value, i) => (
              <div
                key={value.title}
                data-reveal
                data-reveal-delay={i * 110}
                className="bg-noir p-9"
              >
                <dt className="monument text-xl text-or-clair">{value.title}</dt>
                <dd className="mt-4 text-[0.95rem] leading-[1.8] text-ivoire/60">
                  {value.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div data-reveal className="mt-20 flex justify-center md:mt-24">
          <CtaPrimary href={`/${l}/collections`}>{t.collections.cta}</CtaPrimary>
        </div>
      </Section>
    </>
  );
}
