# Dar Tawil — site vitrine

Trilingual showcase site (FR / EN / AR with RTL) for Dar Tawil, a house in Ksar
El Kebir selling dates and Belgian couverture chocolate in gift coffrets and
wedding dfou3.

Next.js 16 (App Router) · Tailwind v4 · fully static — 15 prerendered pages.

```bash
npm run dev      # http://localhost:3000  → redirects to the browser's language
npm run build
npm start
```

## Where things live

| You want to change… | Edit |
| --- | --- |
| Any wording on the site | `content/fr.ts`, `content/en.ts`, `content/ar.ts` |
| Phone, WhatsApp, email, Instagram, domain | `lib/site.ts` |
| Photographs | `lib/photos.ts` (files go in `public/photos/`) |
| Colours, fonts, spacing tokens | `@theme` block at the top of `app/globals.css` |
| Which palette the site runs in | `lib/theme.ts` — one word |
| Which languages exist | `lib/locales.ts` |

`content/fr.ts` is the source of truth: it defines the shape, and `en` / `ar`
are typed against it, so a missing translation is a build error rather than a
blank on the page.

## Still to replace before launch

Everything below is invented placeholder content, written to be plausible so the
design reads correctly. None of it is Dar Tawil's real information.

- **`lib/site.ts`** — domain, WhatsApp number, phone, email, Instagram handle.
- **Address and opening hours** — `visit.address` / `visit.hours` in each
  `content/*.ts`. The street number is literally `rue XXX`.
- **The founding story** — `maisonPage.body`, including the Brussels-suitcases
  anecdote. The house opened in 2026, so the copy deliberately claims no track
  record; keep it that way until there is one.
- **The six coffrets** — names, example compositions and notes in
  `collections.items`. These are written as *starting points*, not fixed
  recipes: a coffret can hold dates, chocolates or both, and the customer
  settles the format, the contents and the budget.
- **The date varieties** — the list in `origins.left.body` (Majhoul, Boufeggous,
  Bouittob, Nejda, Deglet Nour) is a plausible placeholder. Replace it with what
  the house actually carries; the site never claims a single region of origin.
- **Dfou3 terms** — minimums, lead times, delivery cities, the six-week figure.
- **All photography** — every image slot currently shows a labelled plate.

## Contact form

There is no backend. The form on `/[lang]/contact` composes the message and
hands it to WhatsApp or the visitor's mail client, both of which work with no
server. To take submissions properly later, replace the two links in
`components/contact-form.tsx` with a server action or a form endpoint.

## The two palettes

`lib/theme.ts` holds a single constant that stamps `data-palette` on `<html>`.
Every colour on the site reads from tokens, so switching is one word.

- **`nuit`** — gold on dark lacquer. Lantern light, evening, the mark as
  engraved brass. Reads as a jewellery house.
- **`jour`** — the palette of the client's own packaging: a sage coffret on a
  saturated emerald ground, cream type, gold accents. Reads as a confiseur, and
  matches the boxes when they sit next to the site.

The inverted panel (the Dfou3 band, and its cell in the collections tray) is the
one place the two palettes diverge structurally: in `nuit` it is a deep green
block against the dark ground; in `jour` it becomes the pale sage of the box
itself, with dark green type. Its colours come from the `--color-on-accent-*`
tokens, applied by the `.panel-accent` class — never hardcoded per element.

## Design notes

Three shapes carry the whole site, all taken from the logo:

- **the arch** — every photograph is masked into the multifoil arch from the
  mark (`ARCH_PATH` in `components/ornament.tsx`);
- **the lattice** — the star-and-cross zellige field carved inside that arch,
  used as a low-contrast ground in the hero, the dfou3 band and the footer;
- **the tray** — the collections grid on the home page is laid out as the
  compartments inside a real coffret: hairline gold dividers, no gaps.

The monogram is raster inside the supplied PDF, so `public/brand/logo-mask.png`
is an extracted alpha mask that gets filled with the site's own gold gradient
(`.mark` in `app/globals.css`). It stays crisp at any size and always matches
the palette. `logo-gold.png` and `icon.png` are flat versions for Open Graph
and the favicon.

Scroll reveals are progressive enhancement: the hiding is applied by JS, so the
page renders complete for crawlers and with JS disabled. Motion is disabled
under `prefers-reduced-motion`.

## Adding a language

Add the code to `lib/locales.ts` (with its `dir`), add `content/<code>.ts`, and
register it in `app/[lang]/dictionaries.ts`. Routing, the switcher, `hreflang`
and the sitemap all read from `locales`. For another RTL language, extend the
`html[lang="ar"]` font block in `app/globals.css`.
