import type { MetadataRoute } from "next";
import { locales } from "@/lib/locales";
import { site } from "@/lib/site";

const paths = ["", "/maison", "/collections", "/dfou3", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((lang) =>
    paths.map((path) => ({
      url: `${site.url}/${lang}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${site.url}/${l}${path}`]),
        ),
      },
    })),
  );
}
