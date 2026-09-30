import type { Metadata } from "next";
import { Bonbon } from "@/components/bonbon";
import { Photo } from "@/components/photo";
import { CtaPrimary, Eyebrow, Lede, PageHeader, Section, Title } from "@/components/ui";
import { flavours } from "@/lib/flavours";
import { whatsappLink } from "@/lib/site";
import { photos } from "@/lib/photos";
import { getDictionary } from "../dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/collections">): Promise<Metadata> {
  const { lang } = await params;
  const t = await getDictionary(lang);
  return { title: t.collectionsPage.eyebrow, description: t.collectionsPage.lede };
}

export default async function CollectionsPage({
  params,
}: PageProps<"/[lang]/collections">) {
  const { lang } = await params;
  const t = await getDictionary(lang);

  return (
    <>
      <PageHeader
        eyebrow={t.collectionsPage.eyebrow}
        title={t.collectionsPage.title}
        lede={t.collectionsPage.lede}
      />

      <Section>
        {/* Alternating arches: each product line gets one, facing the other way. */}
        <div className="space-y-24 md:space-y-32">
          {t.collections.items.map((item, i) => (
            <article
              key={item.slug}
              data-reveal
              className={`grid items-center gap-10 md:gap-16 ${
                i % 2 === 1
                  ? "md:grid-cols-[1fr_0.62fr] md:[&>figure]:order-2"
                  : "md:grid-cols-[0.62fr_1fr]"
              }`}
            >
              <Photo
                src={photos.range[item.slug] || undefined}
                alt={item.photo}
                caption={item.photo}
                pending={t.ui.photoPending}
                className="aspect-[3/4] w-full"
              />

              <div>
                <p className="eyebrow">{item.line}</p>
                <h2 className="monument mt-5 text-[clamp(1.9rem,3.6vw,2.9rem)] text-ivoire">
                  {item.name}
                </h2>

                <div className="mt-8 border-t border-or/22 pt-6">
                  <p className="text-[0.72rem] uppercase tracking-[0.2em] text-or/75">
                    {t.collections.composition}
                  </p>
                  <p className="mt-3 max-w-[46ch] text-[1rem] leading-[1.8] text-ivoire/70">
                    {item.composition}
                  </p>
                </div>

                {item.slug === "dattes" ? (
                  <div className="mt-8 border-t border-or/22 pt-6">
                    <p className="text-[0.72rem] uppercase tracking-[0.2em] text-or/75">
                      {t.collectionsPage.varieties.label}
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-2.5">
                      {t.collectionsPage.varieties.names.map((name) => (
                        <li
                          key={name}
                          className="border border-or/35 px-4 py-2 font-display text-[1rem] text-ivoire/85"
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 max-w-[46ch] text-[0.85rem] leading-[1.7] text-ivoire/50">
                      {t.collectionsPage.varieties.note}
                    </p>
                  </div>
                ) : null}

                {item.slug === "chocolats" ? (
                  <div className="mt-8 border-t border-or/22 pt-6">
                    <p className="text-[0.72rem] uppercase tracking-[0.2em] text-or/75">
                      {t.collectionsPage.flavoursLabel}
                    </p>
                    <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                      {flavours.map((flavour) => {
                        const copy = t.flavours.items[flavour.slug];
                        return (
                          <li key={flavour.slug} className="flex items-center gap-3">
                            <Bonbon flavour={flavour} className="h-auto w-9 shrink-0" />
                            <span>
                              <span className="block font-display text-[0.98rem] leading-tight text-ivoire/85">
                                {copy.name}
                              </span>
                              <span className="mt-0.5 block text-[0.75rem] leading-snug text-ivoire/50">
                                {copy.note}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                <p className="mt-7 max-w-[44ch] font-display text-[1.1rem] leading-snug text-or-clair/80">
                  {item.note}
                </p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section className="border-t border-or/15">
        <div data-reveal className="max-w-[46ch]">
          <Eyebrow>{t.collectionsPage.compose.eyebrow}</Eyebrow>
          <Title className="mt-5">{t.collectionsPage.compose.title}</Title>
        </div>

        {/* A real sequence: each decision narrows the next one. */}
        <ol className="mt-14 grid gap-px bg-or/22 md:mt-20 md:grid-cols-3">
          {t.collectionsPage.compose.steps.map((stage, i) => (
            <li
              key={stage.step}
              data-reveal
              data-reveal-delay={i * 110}
              className="bg-noir p-8 md:p-9"
            >
              <span className="font-display text-sm tracking-[0.2em] text-or/60">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="monument mt-5 text-xl text-or-clair">{stage.step}</h3>
              <p className="mt-4 text-[0.95rem] leading-[1.8] text-ivoire/62">
                {stage.body}
              </p>
            </li>
          ))}
        </ol>

        <div data-reveal className="mx-auto mt-24 max-w-[52ch] text-center md:mt-32">
          <Title as="h3" className="text-[clamp(1.6rem,3vw,2.3rem)]">
            {t.collectionsPage.customTitle}
          </Title>
          <Lede className="mx-auto mt-7">{t.collectionsPage.customBody}</Lede>
          <div className="mt-11 flex justify-center">
            <CtaPrimary href={whatsappLink()} external>
              {t.collectionsPage.customCta}
            </CtaPrimary>
          </div>
        </div>
      </Section>
    </>
  );
}
