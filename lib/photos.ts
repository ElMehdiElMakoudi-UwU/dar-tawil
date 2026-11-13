/**
 * Every image slot on the site, in one place.
 *
 * Drop the file in `public/photos/` and set the path here — e.g.
 *   visit: "/photos/boutique.jpg"
 * An empty string leaves the labelled placeholder plate in place, so the site
 * stays presentable while the photography is being shot.
 */
export const photos = {
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
  /** One per catalog category — home, "Les collections" tray. On white, like the pack photos. */
  categories: {
    boxChocolat: "/photos/packs/degustation.jpg",
    dattes: "/photos/packs/dattes-prestige.jpg",
    tablettes: "/photos/packs/tablette-dubai.jpg",
    evenements: "/photos/packs/fiancailles-2.jpg",
  },
};
