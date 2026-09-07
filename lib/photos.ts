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
  originLeft: "",
  /** Belgian couverture being tempered — home, "Deux origines", right arch. */
  originRight: "",
  /** Shopfront or interior — home, "Passez à la boutique". */
  visit: "",
  /** The workshop or the founders — La maison. */
  maison: "",
  /** Dfou3 trays laid out — Dfou3 page. */
  dfou3: "",
  /** One per coffret, keyed by slug — Collections page. */
  coffret: {
    andalou: "",
    majhoul: "",
    ganache: "",
    zellige: "",
    ramadan: "",
    dfou3: "",
  } as Record<string, string>,
};
