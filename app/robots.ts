import type { MetadataRoute } from "next";
import { indexable, siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  // A preview build tells crawlers to stay out entirely.
  if (!indexable) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
