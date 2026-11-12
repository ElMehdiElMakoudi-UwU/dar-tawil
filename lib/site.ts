/**
 * Single place for the client's real details. Everything marked PLACEHOLDER
 * still needs Dar Tawil's actual value before launch.
 */
import { siteUrl } from "./env";

export const site = {
  name: "Dar Tawil",
  /** Set with NEXT_PUBLIC_SITE_URL at build time — see lib/env.ts. */
  url: siteUrl,
  /** 0606063742 in international format, no spaces, for wa.me links. */
  whatsapp: "212606063742",
  phoneDisplay: "+212 6 06 06 37 42",
  /** Dialable from a phone; keeps the local form for Moroccan visitors. */
  phoneHref: "tel:+212606063742",
  /** PLACEHOLDER */
  email: "contact@dartawil.ma",
  /** PLACEHOLDER */
  instagram: "https://instagram.com/dartawil.ma",
  founded: 2026,
};

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${site.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
