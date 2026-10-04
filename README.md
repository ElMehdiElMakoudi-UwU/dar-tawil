# Dar Tawil — site vitrine

Trilingual showcase site (FR / EN / AR with RTL) for Dar Tawil, a house in Ksar
El Kebir selling dates and Belgian couverture chocolate in gift coffrets and
wedding dfou3.

Next.js 16 (App Router) · Tailwind v4 · the public site is fully static — 15
prerendered pages. The back office at `/gestion` is dynamic and needs Postgres
(see [Back office](#back-office-gestion)).

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

## Back office (`/gestion`)

A sign-in-only section that replaces the old `dar_tawil.xlsx` tracker: sales,
stock, customers, purchases, expenses, staff & payroll, cash & bank, and a
yearly dashboard. French or Arabic (a cookie switch), never indexed, outside
the locale redirect.

Two roles:

| | Staff | Admin |
| --- | --- | --- |
| Log sales, mark orders paid | ✓ | ✓ |
| Take payments on what customers owe | ✓ | ✓ |
| Print receipts, issue invoices | ✓ | ✓ |
| Edit a sale | own, same day | any |
| Record losses and stock counts | ✓ | ✓ |
| See products, prices, stock; add customers | ✓ | ✓ |
| Costs, margins, profit, stock value | — | ✓ |
| Purchases, expenses, payroll, cash & bank, dashboard | — | ✓ |
| Returns / credit notes, value of stock losses | — | ✓ |
| Edit products, delete records, dropdown lists, user accounts | — | ✓ |
| Business details, Excel export, full backup | — | ✓ |

Staff never receive cost data at all — it isn't hidden in the page, it's never
queried for them. Every page and every server action checks the role itself
(`requireUser` / `requireAdmin` in `lib/gestion/auth.ts`).

**First run:** open `/gestion`. With no users in the database it shows a setup
screen that creates the owner's admin account; staff are added afterwards under
*Settings & users*. The setup screen disappears once any user exists.

**Local development:**

```bash
createdb dar_tawil
echo "DATABASE_URL=postgres://localhost:5432/dar_tawil" >> .env.local
npm run migrate
npm run dev      # then http://localhost:3000/gestion
```

| You want to change… | Edit |
| --- | --- |
| Tables / columns | add `db/migrations/00N_*.sql` (never edit an applied one) |
| What each role can read | `lib/gestion/queries.ts` |
| Saves, deletes, permissions on writes | `app/gestion/actions.ts` |
| Pages | `app/gestion/(app)/…` — admin-only ones under `admin/` |

A sale stores the product's cost at the moment it's sold, so changing a cost
later doesn't rewrite past profit. Payroll payments count as a cost on the
dashboard next to expenses, so salaries shouldn't also be logged as expenses.

**Stock** is opening stock + purchases − sales + adjustments. Adjustments
(*Pertes & inventaire*) record waste, breakage, tastings and own use, and
physical counts: for a count you type what is on the shelf and the difference
is recorded. Their value at cost shows as *Pertes* on the dashboard and comes
off net profit.

**Returns** are credit notes (`R00001`): sale lines with a negative quantity,
each pointing at the line it gives back, at the original price and cost. So
revenue, profit, stock, the till and customer totals all net out without any
query knowing about returns. Items not fit to sell again are written off as
*damaged* in the same step. Only paid sales can be returned.

**Payments on account**: money received on a sale (from its page) or on a
customer's balance (from the customer page, oldest sales first) is a
`sale_payments` row on the day it came in, and a sale whose balance reaches
zero is marked paid. The till count compares against cash taken that day,
sales paid at once and payments received alike.

**Editing a sale** keeps its number and date. It is refused once the sale is
invoiced, has a return, or came from an order (edit the order instead).

**Receipts and invoices** print from `/gestion/print/receipt|invoice/<no>`, in
French. Invoices are numbered `F-2026-0001` with no gaps per year, can't be
dated before the previous one, and can't be changed or deleted once issued:
a mistake is corrected with a return and its own invoice. The house's legal
details (ICE, IF, RC, patente, VAT rate…) are set under *Settings*. With a VAT
rate above 0 the invoice breaks the (VAT-inclusive) prices into HT / TVA / TTC.

**Export & backup** (admin): one Excel workbook per year for the accountant
(`/gestion/export/xlsx?year=`), and a full JSON backup of the database
(`/gestion/export/backup`, password hashes included — keep it safe). To load
a backup into a fresh, migrated database:

```bash
npm run migrate
npm run restore -- dar-tawil-backup-….json            # refuses if there is data
npm run restore -- dar-tawil-backup-….json --replace  # overwrites it
```

This doesn't replace Coolify's scheduled database backups; it's the copy you
keep off the server.

## Deploying to Coolify

The repo ships a `Dockerfile` (multi-stage, Next.js standalone output, non-root
user, ~50 MB of app on top of `node:22-alpine`).

In Coolify:

1. **+ New → Application → Public Repository** (or Private, via the GitHub App).
   Repo `ElMehdiElMakoudi-UwU/dar-tawil`, branch `main`.
2. **Build Pack: `Dockerfile`.** Base directory `/`, Dockerfile `/Dockerfile`.
3. **Port: `3000`.**
4. **Domains**: `https://dartawil.ma,https://www.dartawil.ma`, and set **Direction** to redirect www → non-www. The A record for `dartawil.ma` (and the `www` CNAME) must point at the
   VPS *before* deploying, so Let's Encrypt can issue the certificate.
5. **Environment variables** — add both and tick **Build Variable** on each:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | `https://dartawil.ma` |
   | `SITE_INDEXABLE` | `false` for the client preview |

6. **Health check**: path `/api/health`, port `3000`. Do not leave it on `/` —
   that returns a 307 to the visitor's language and can read as unhealthy.
7. **Database for `/gestion`**: **+ New → Database → PostgreSQL** in the same
   project, then add `DATABASE_URL` (its internal URL) to the app as a normal
   **runtime** variable — *not* a build variable. Migrations run automatically
   each time the container starts. Turn on Coolify's scheduled backups for that
   database: it holds the business's books.

### Things that will bite otherwise

- Both variables are consumed by `next build`, because every page is statically
  generated. A runtime-only variable never reaches them. Changing either one
  needs a **rebuild**, not a restart.
- `NEXT_PUBLIC_SITE_URL` must match the served domain exactly. If it doesn't,
  canonical URLs, `hreflang` and the Open Graph image all point at the wrong
  host — which is what WhatsApp and Messenger read when the link is shared.
- **`SITE_INDEXABLE=false` keeps the preview out of Google**: `robots.txt`
  disallows everything and every page carries `<meta name="robots"
  content="noindex, nofollow">`. Set it to `true` only at real launch.

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
