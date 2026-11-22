import type { Metadata } from "next";
import { connection } from "next/server";
import { CartProvider } from "@/components/cart";
import { StarRule } from "@/components/ornament";
import { PackCard } from "@/components/pack-card";
import { CtaPrimary, Lede, PageHeader, Section, Title } from "@/components/ui";
import { getCatalogSections } from "@/lib/catalog";
import type { Locale } from "@/lib/locales";
import { whatsappLink } from "@/lib/site";
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
  const c = t.collectionsPage;
  // Rendered per request: the packs are edited live in /gestion, and the
  // database is not reachable at build time.
  await connection();
  const sections = await getCatalogSections(lang as Locale);

  const labels = {
    featuredBadge: c.featuredBadge,
    priceFormat: c.priceFormat,
    priceOnRequest: c.priceOnRequest,
    sizeLabel: c.sizeLabel,
    flavourLabel: c.flavourLabel,
    addToCart: c.addToCart,
    added: c.added,
    quantity: c.cart.quantity,
    decrease: c.cart.decrease,
    increase: c.cart.increase,
    slider: c.slider,
  };

  const cartLabels = {
    ...c.cart,
    priceFormat: c.priceFormat,
    priceOnRequest: c.priceOnRequest,
  };

  return (
    <CartProvider labels={cartLabels}>
      <PageHeader eyebrow={c.eyebrow} title={c.title} lede={c.lede} />

      <Section className="!pt-12 md:!pt-16">
        {/* Jump links to each category. */}
        <nav aria-label={c.categories.label} className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
          <ul className="flex gap-2.5">
            {sections.map(({ category, name }, i) => (
              <li key={category} data-reveal data-reveal-delay={i * 90} className="shrink-0">
                <a
                  href={`#${category}`}
                  className="cta-ghost relative inline-flex min-h-11 items-center border border-or/40 px-5 text-[0.78rem] uppercase tracking-[0.16em] text-ivoire/80 transition-colors duration-500 hover:border-or hover:text-or-profond"
                >
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-16 space-y-24 md:mt-20 md:space-y-32">
          {sections.map(({ category, name, packs }, s) => (
            <section key={category} id={category} aria-labelledby={`${category}-title`} className="scroll-mt-28">
              <div data-reveal className="cat-head relative flex items-baseline gap-5 pb-5">
                <h2
                  id={`${category}-title`}
                  className="monument text-[clamp(1.5rem,2.8vw,2.1rem)] text-ivoire"
                >
                  {name}
                </h2>
                <span className="font-display text-sm tracking-[0.2em] text-or/70">
                  {String(packs.length).padStart(2, "0")}
                </span>
                {/* The rule draws itself out from the title. */}
                <span aria-hidden className="cat-rule absolute inset-x-0 bottom-0 h-px" />
              </div>

              <div className="mt-10 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10">
                {packs.map((pack, i) => (
                  <PackCard
                    key={pack.id}
                    name={pack.name}
                    description={pack.description}
                    featured={pack.featured}
                    variants={pack.variants}
                    labels={labels}
                    priority={s === 0 && i < 3}
                    composable={pack.composable}
                    index={i}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </Section>

      <Section className="border-t border-or/15">
        <StarRule className="mx-auto mb-16 max-w-md md:mb-20" />
        <div data-reveal className="mx-auto max-w-[52ch] text-center">
          <Title as="h2" className="text-[clamp(1.6rem,3vw,2.3rem)]">
            {c.customTitle}
          </Title>
          <Lede className="mx-auto mt-7">{c.customBody}</Lede>
          <div className="mt-11 flex justify-center">
            <CtaPrimary href={whatsappLink()} external>
              {c.customCta}
            </CtaPrimary>
          </div>
        </div>
      </Section>
    </CartProvider>
  );
}
