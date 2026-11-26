/**
 * Deploy-time settings. Both are read during `next build` (most pages are
 * statically generated) and again at runtime by the pages that render per
 * request (home, collections). The Dockerfile carries the build values into
 * the running container so the two always agree.
 */

/** Public origin, no trailing slash. Used for canonicals, OG and the sitemap. */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/**
 * Search engines are kept out unless this is explicitly "true".
 * A client preview should never be indexed; flip it only for the real launch.
 */
export const indexable = process.env.SITE_INDEXABLE === "true";
