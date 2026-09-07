/**
 * Which palette the site runs in. One word switches the whole thing — every
 * colour on the site reads from tokens defined in `app/globals.css`.
 *
 *   "nuit" — gold on dark lacquer. Lantern light, evening, the mark as engraved
 *            brass. Reads as a jewellery house.
 *   "jour" — the palette of the client's own packaging: a sage coffret on a
 *            saturated emerald ground, cream band, gold type. Reads as a
 *            confiseur, and matches the boxes on a shelf.
 */
export type Palette = "nuit" | "jour";

export const palette: Palette = "nuit";
