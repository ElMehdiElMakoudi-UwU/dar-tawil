/**
 * Which palette the site runs in. One word switches the whole thing — every
 * colour on the site reads from tokens defined in `app/globals.css`.
 *
 *   "nuit"  — gold on dark lacquer. Lantern light, evening, the mark as engraved
 *             brass. Reads as a jewellery house.
 *   "jour"  — a sage coffret on a saturated emerald ground, cream band, gold
 *             type. Reads as a confiseur.
 *   "blanc" — the house's own Instagram: white lid, hairline gold cubes, the
 *             name in script inside a thin gold frame, chocolate as the only
 *             dark. Matches the boxes the client actually ships.
 */
export type Palette = "nuit" | "jour" | "blanc";

export const palette: Palette = "blanc";
