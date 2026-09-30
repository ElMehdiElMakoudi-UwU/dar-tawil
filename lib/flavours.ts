/**
 * The bonbon range, in the order of the house's own flavour card. Names and
 * notes live in the dictionaries under `flavours.items`, keyed by slug; this
 * file only holds what each shell looks like.
 *
 * `finish` is how the coloured cocoa butter is applied to the mould:
 *   splatter — flicked dots      drizzle — thin thrown lines
 *   marble   — wide swirls       leaf    — gold leaf all over
 *   plain    — a single glossy colour
 */
export type Finish = "splatter" | "drizzle" | "marble" | "leaf" | "plain";

export type Flavour = {
  slug: FlavourSlug;
  base: string;
  accents: readonly string[];
  finish: Finish;
};

export const flavours = [
  { slug: "bounty", base: "#efe9dc", accents: ["#1a1612"], finish: "splatter" },
  { slug: "amlo", base: "#e2701e", accents: ["#f3c25a", "#b04a12"], finish: "drizzle" },
  { slug: "ferrero", base: "#c01f26", accents: ["#f5ece6"], finish: "drizzle" },
  { slug: "citron", base: "#e8b632", accents: ["#fbf1d2"], finish: "drizzle" },
  { slug: "pralineAmande", base: "#3f9ea3", accents: ["#8b2f24", "#6a3a2e"], finish: "drizzle" },
  { slug: "gianduja", base: "#d8431c", accents: ["#f7d9c4"], finish: "splatter" },
  { slug: "noisetteNoire", base: "#1d3050", accents: ["#e8eef2", "#4f8fa8"], finish: "splatter" },
  { slug: "speculoos", base: "#a98199", accents: ["#f1e6ee", "#7c5670"], finish: "marble" },
  { slug: "corneDeGazelle", base: "#f0e2cb", accents: ["#c27a36", "#9a5a25"], finish: "splatter" },
  { slug: "fruitsRouges", base: "#eca6b0", accents: ["#c21a33"], finish: "splatter" },
  { slug: "pistacheAmande", base: "#2d6a3a", accents: ["#0f1a12", "#e9efe0"], finish: "marble" },
  { slug: "konafaPistache", base: "#d6ad45", accents: ["#f3dc8e", "#9c7625"], finish: "leaf" },
  { slug: "cafe", base: "#151313", accents: [], finish: "plain" },
] as const satisfies readonly {
  slug: string;
  base: string;
  accents: readonly string[];
  finish: Finish;
}[];

export type FlavourSlug = (typeof flavours)[number]["slug"];
