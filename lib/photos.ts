/**
 * Every image slot on the site, in one place.
 *
 * Drop the file in `public/photos/` and set the path here — e.g.
 *   originLeft: "/photos/palmeraie-ziz.jpg"
 * An empty string leaves the labelled placeholder plate in place, so the site
 * stays presentable while the photography is being shot.
 */
export const photos = {
  /** Palm grove at harvest — home, "Deux origines", left arch. */
  originLeft: "/photos/dattes-detail.jpg",
  /** Belgian couverture being tempered — home, "Deux origines", right arch. */
  originRight: "/photos/bonbons-detail.jpg",
  /** Shopfront or interior — home, "Passez à la boutique". */
  visit: "/photos/boutique-plateau.jpg",
  /** The workshop or the founders — La maison. */
  maison: "",
  /** The drifting procession of arches on the home page, in order. */
  gallery: [
    "/photos/dattes-detail.jpg",
    "/photos/coffret-dar-tawil.jpg",
    "/photos/dattes-coffret-rond.jpg",
    "/photos/bonbons-detail.jpg",
    "/photos/boutique-plateau.jpg",
    "/photos/bonbons-coffret.jpg",
  ],
  /** One per product line, keyed by slug — Collections page. */
  range: {
    dattes: "/photos/dattes-coffret-rond.jpg",
    chocolats: "/photos/bonbons-coffret.jpg",
    dfou3: "/photos/boutique-plateau.jpg",
  } as Record<string, string>,
};
