/**
 * Single place for the client's real details. Everything marked PLACEHOLDER
 * still needs Dar Tawil's actual value before launch.
 */
import { siteUrl } from "./env";

export const site = {
  name: "Dar Tawil",
  /** Set with NEXT_PUBLIC_SITE_URL at build time — see lib/env.ts. */
  url: siteUrl,
  /** 0614149785 in international format, no spaces, for wa.me links. */
  whatsapp: "212614149785",
  phoneDisplay: "+212 6 14 14 97 85",
  /** Dialable from a phone; keeps the local form for Moroccan visitors. */
  phoneHref: "tel:+212614149785",
  /** PLACEHOLDER */
  email: "contact@dartawil.ma",
  /** PLACEHOLDER */
  instagram: "https://instagram.com/dartawil",
  founded: 2026,
};

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${site.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
