import type { Metadata } from "next";
import { Photo } from "@/components/photo";
import { CtaPrimary, PageHeader, Section } from "@/components/ui";
import { pageAlternates, type Locale } from "@/lib/locales";
import { photos } from "@/lib/photos";
import { getDictionary } from "../dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/maison">): Promise<Metadata> {
  const { lang } = await params;
  const t = await getDictionary(lang);
  return {
    title: t.maisonPage.eyebrow,
    description: t.maisonPage.lede,
    alternates: pageAlternates(lang, "/maison"),
  };
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

        <div data-reveal className="mt-20 flex justify-center md:mt-24">
          <CtaPrimary href={`/${l}/collections`}>{t.collections.cta}</CtaPrimary>
        </div>
      </Section>
    </>
  );
}
