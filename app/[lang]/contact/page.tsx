import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { getDictionary } from "../dictionaries";
import { PageHeader, Section } from "@/components/ui";
import { site, whatsappLink } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/contact">): Promise<Metadata> {
  const { lang } = await params;
  const t = await getDictionary(lang);
  return { title: t.contactPage.eyebrow, description: t.contactPage.lede };
}

export default async function ContactPage({ params }: PageProps<"/[lang]/contact">) {
  const { lang } = await params;
  const t = await getDictionary(lang);

  // Same number, two different actions — dial it, or open the chat.
  const direct = [
    { label: t.contactPage.phone, value: site.phoneDisplay, href: site.phoneHref },
    { label: t.contactPage.whatsapp, value: t.visit.cta, href: whatsappLink() },
    { label: t.contactPage.email, value: site.email, href: `mailto:${site.email}` },
    { label: t.contactPage.instagram, value: "@dartawil", href: site.instagram },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t.contactPage.eyebrow}
        title={t.contactPage.title}
        lede={t.contactPage.lede}
      />

      <Section>
        <div className="grid gap-16 md:grid-cols-[1fr_0.62fr] md:gap-20">
          <div data-reveal>
            <h2 className="eyebrow">{t.contactPage.formTitle}</h2>
            <div className="mt-8">
              <ContactForm t={t} />
            </div>
          </div>

          <aside data-reveal data-reveal-delay="120" className="space-y-14">
            <div>
              <h2 className="eyebrow">{t.contactPage.directTitle}</h2>
              <dl className="mt-7 divide-y divide-or/15 border-y border-or/15">
                {direct.map((item) => (
                  <div key={item.label} className="flex items-baseline justify-between gap-4 py-4">
                    <dt className="text-[0.82rem] uppercase tracking-[0.14em] text-ivoire/45">
                      {item.label}
                    </dt>
                    <dd>
                      <a
                        href={item.href}
                        target={
                          item.href.startsWith("mailto") || item.href.startsWith("tel")
                            ? undefined
                            : "_blank"
                        }
                        rel="noreferrer"
                        className="font-display text-[1.05rem] text-or-clair transition-colors hover:text-or"
                        dir="ltr"
                      >
                        {item.value}
                      </a>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <h2 className="eyebrow">{t.visit.addressLabel}</h2>
              <address className="mt-6 space-y-1 text-[0.98rem] not-italic leading-relaxed text-ivoire/70">
                {t.visit.address.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </address>
            </div>

            <div>
              <h2 className="eyebrow">{t.visit.hoursLabel}</h2>
              <div className="mt-6 space-y-1 text-[0.98rem] leading-relaxed text-ivoire/70">
                {t.visit.hours.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
