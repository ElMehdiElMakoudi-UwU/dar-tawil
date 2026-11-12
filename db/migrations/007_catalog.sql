-- The packs shown on the public /collections page, edited from
-- /gestion/admin/collections. Separate from `products` (the till's stock
-- items): a pack is a shop-window entry with photos and texts in three
-- languages, not a stock line.

create table catalog_packs (
  id             serial primary key,
  position       integer not null default 0,
  -- The page section it sits in; the list and its titles are in code
  -- (lib/catalog.ts, content/*.ts collectionsPage.categories).
  category       text not null check (category in ('boxChocolat', 'dattes', 'tablettes', 'evenements')),
  featured       boolean not null default false,  -- shown first, with a badge
  visible        boolean not null default true,   -- false hides it from the site
  name_fr        text not null,
  name_en        text,                            -- empty falls back to French
  name_ar        text,
  description_fr text,
  description_en text,
  description_ar text,
  created_at     timestamptz not null default now()
);

-- A size or model of a pack. A pack with one variant shows no size picker;
-- its label may then be empty.
create table catalog_variants (
  id       serial primary key,
  pack_id  integer not null references catalog_packs(id) on delete cascade,
  position integer not null default 0,
  label_fr text,
  label_en text,
  label_ar text,
  price    numeric(12, 2) check (price >= 0)       -- null = "price on request"
);
create index on catalog_variants (pack_id);

-- Either a file shipped in /public (src) or an upload kept in the database
-- (data), served by /api/catalog/image/<id>. Uploads are never changed in
-- place — a new photo is a new row — so they can be cached forever.
create table catalog_images (
  id         serial primary key,
  variant_id integer not null references catalog_variants(id) on delete cascade,
  position   integer not null default 0,
  src        text,
  mime       text,
  data       bytea,
  created_at timestamptz not null default now(),
  check ((src is null) <> (data is null)),
  check (data is null or mime is not null)
);
create index on catalog_images (variant_id);

-- The packs that were hard-coded in lib/packs.ts until now.
with p as (
  insert into catalog_packs (position, category, featured, name_fr, name_en, name_ar, description_fr, description_en, description_ar)
  values (1, 'evenements', false, 'Pack Fiançailles', 'Engagement Pack', 'باقة الخطوبة',
          'Des coffrets ronds garnis de dattes fourrées et de chocolats, pensés pour les fiançailles. Deux modèles au choix.', 'Round coffrets filled with stuffed dates and chocolates, made for engagements. Two models to choose from.', 'علب دائرية محشوّة بالتمر المحشو والشوكولاتة، مصمّمة للخطوبة. نموذجان للاختيار.')
  returning id
), v0 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 1, 'Modèle 1', 'Model 1', 'النموذج 1', null from p
  returning id
), v1 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 2, 'Modèle 2', 'Model 2', 'النموذج 2', null from p
  returning id
)
insert into catalog_images (variant_id, position, src) values
  ((select id from v0), 1, '/photos/packs/fiancailles-1.jpg'),
  ((select id from v0), 2, '/photos/packs/fiancailles-2.jpg'),
  ((select id from v0), 3, '/photos/packs/fiancailles-3.jpg'),
  ((select id from v1), 1, '/photos/packs/fiancailles-type-2.jpg');

with p as (
  insert into catalog_packs (position, category, featured, name_fr, name_en, name_ar, description_fr, description_en, description_ar)
  values (2, 'boxChocolat', false, 'Box Capsules', 'Capsules Box', 'علبة الكبسولات',
          'Des bonbons de chocolat colorés, garnis à la main, dans leur boîte Dar Tawil. Trois formats, du petit cadeau au grand coffret.', 'Colourful chocolate bonbons, filled by hand, in their Dar Tawil box. Three sizes, from a small gift to a grand coffret.', 'حبّات شوكولاتة ملوّنة محشوّة يدويًا، في علبة دار طويل. ثلاثة أحجام، من الهدية الصغيرة إلى العلبة الكبيرة.')
  returning id
), v0 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 1, 'Mini', 'Mini', 'صغير', null from p
  returning id
), v1 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 2, 'Moyen', 'Medium', 'متوسط', null from p
  returning id
), v2 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 3, 'Grand', 'Large', 'كبير', null from p
  returning id
)
insert into catalog_images (variant_id, position, src) values
  ((select id from v0), 1, '/photos/packs/capsules-mini-1.jpg'),
  ((select id from v0), 2, '/photos/packs/capsules-mini-2.jpg'),
  ((select id from v1), 1, '/photos/packs/capsules-moyen.jpg'),
  ((select id from v2), 1, '/photos/packs/capsules-grand.jpg');

with p as (
  insert into catalog_packs (position, category, featured, name_fr, name_en, name_ar, description_fr, description_en, description_ar)
  values (3, 'dattes', false, 'Plateau Dattes Beldi', 'Beldi Dates Tray', 'صينية التمر البلدي',
          'Des dattes beldi fourrées et garnies de noix, d''amandes et de pistaches, dressées sur plateau et nouées d''un ruban.', 'Beldi dates stuffed and topped with walnuts, almonds and pistachios, laid out on a tray and tied with a ribbon.', 'تمر بلدي محشو ومزيّن بالجوز واللوز والفستق، مرتّب على صينية ومربوط بشريط.')
  returning id
), v0 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 1, 'Classique', 'Classic', 'كلاسيكي', null from p
  returning id
), v1 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 2, 'Grand', 'Large', 'كبير', null from p
  returning id
)
insert into catalog_images (variant_id, position, src) values
  ((select id from v0), 1, '/photos/packs/beldi.jpg'),
  ((select id from v1), 1, '/photos/packs/beldi-grand.jpg');

with p as (
  insert into catalog_packs (position, category, featured, name_fr, name_en, name_ar, description_fr, description_en, description_ar)
  values (4, 'dattes', false, 'Box Dattes Fourrées Enrobées Prestige', 'Prestige Coated Stuffed Dates Box', 'علبة بريستيج للتمر المحشو المغلّف',
          'Des dattes fourrées puis enrobées de chocolat et décorées une à une. Le coffret à offrir.', 'Stuffed dates coated in chocolate and decorated one by one. The coffret to give.', 'تمر محشو ثم مغلّف بالشوكولاتة ومزيّن حبّة حبّة. العلبة المثالية للإهداء.')
  returning id
), v0 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 1, null, null, null, null from p
  returning id
)
insert into catalog_images (variant_id, position, src) values
  ((select id from v0), 1, '/photos/packs/dattes-prestige.jpg');

with p as (
  insert into catalog_packs (position, category, featured, name_fr, name_en, name_ar, description_fr, description_en, description_ar)
  values (5, 'boxChocolat', false, 'Box Dégustation', 'Tasting Box', 'علبة التذوّق',
          'Un assortiment de dattes enrobées et de bonbons de chocolat, pour goûter un peu de tout.', 'An assortment of coated dates and chocolate bonbons, to taste a little of everything.', 'تشكيلة من التمر المغلّف وحبّات الشوكولاتة، لتذوّق القليل من كل شيء.')
  returning id
), v0 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 1, null, null, null, null from p
  returning id
)
insert into catalog_images (variant_id, position, src) values
  ((select id from v0), 1, '/photos/packs/degustation.jpg');

with p as (
  insert into catalog_packs (position, category, featured, name_fr, name_en, name_ar, description_fr, description_en, description_ar)
  values (6, 'boxChocolat', false, 'Box Chocolat Noir', 'Dark Chocolate Box', 'علبة الشوكولاتة الداكنة',
          'Des carrés de chocolat noir aux garnitures variées : corne de gazelle, amlou, crème pistache, praliné noisette, et d''autres encore.', 'Dark chocolate squares with assorted fillings: gazelle horn, amlou, pistachio cream, hazelnut praline and more.', 'مربّعات شوكولاتة داكنة بحشوات متنوّعة: كعب الغزال، أملو، كريمة الفستق، برالين البندق، وغيرها.')
  returning id
), v0 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 1, null, null, null, null from p
  returning id
)
insert into catalog_images (variant_id, position, src) values
  ((select id from v0), 1, '/photos/packs/chocolat-noir-1.jpg'),
  ((select id from v0), 2, '/photos/packs/chocolat-noir-gouts.jpg');

with p as (
  insert into catalog_packs (position, category, featured, name_fr, name_en, name_ar, description_fr, description_en, description_ar)
  values (7, 'boxChocolat', false, 'Box Chocolat au Lait', 'Milk Chocolate Box', 'علبة شوكولاتة الحليب',
          'Des carrés de chocolat au lait aux garnitures variées, rangés dans leur coffret.', 'Milk chocolate squares with assorted fillings, set in their coffret.', 'مربّعات شوكولاتة بالحليب بحشوات متنوّعة، مرتّبة في علبتها.')
  returning id
), v0 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 1, null, null, null, null from p
  returning id
)
insert into catalog_images (variant_id, position, src) values
  ((select id from v0), 1, '/photos/packs/chocolat-lait-1.jpg'),
  ((select id from v0), 2, '/photos/packs/chocolat-lait-2.jpg');

with p as (
  insert into catalog_packs (position, category, featured, name_fr, name_en, name_ar, description_fr, description_en, description_ar)
  values (8, 'tablettes', false, 'Tablette Chocolat Dubaï', 'Dubai Chocolate Bar', 'لوح شوكولاتة دبي',
          'Du chocolat au lait garni de crème de pistache et de cheveux d''ange croustillants.', 'Milk chocolate filled with pistachio cream and crispy kataifi.', 'شوكولاتة بالحليب محشوّة بكريمة الفستق والكنافة المقرمشة.')
  returning id
), v0 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 1, null, null, null, null from p
  returning id
)
insert into catalog_images (variant_id, position, src) values
  ((select id from v0), 1, '/photos/packs/tablette-dubai.jpg');

with p as (
  insert into catalog_packs (position, category, featured, name_fr, name_en, name_ar, description_fr, description_en, description_ar)
  values (9, 'tablettes', false, 'Tablette KitKat', 'KitKat Bar', 'لوح كيت كات',
          'Du chocolat au lait garni de gaufrette croustillante.', 'Milk chocolate filled with crispy wafer.', 'شوكولاتة بالحليب محشوّة بالويفر المقرمش.')
  returning id
), v0 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 1, null, null, null, null from p
  returning id
)
insert into catalog_images (variant_id, position, src) values
  ((select id from v0), 1, '/photos/packs/tablette-kitkat.jpg');

with p as (
  insert into catalog_packs (position, category, featured, name_fr, name_en, name_ar, description_fr, description_en, description_ar)
  values (10, 'tablettes', false, 'Tablette Fruits Rouges', 'Red Berries Bar', 'لوح الفواكه الحمراء',
          'Du chocolat au lait garni d''une crème aux fruits rouges.', 'Milk chocolate filled with a red berry cream.', 'شوكولاتة بالحليب محشوّة بكريمة الفواكه الحمراء.')
  returning id
), v0 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 1, null, null, null, null from p
  returning id
)
insert into catalog_images (variant_id, position, src) values
  ((select id from v0), 1, '/photos/packs/tablette-fruits-rouges.jpg');

with p as (
  insert into catalog_packs (position, category, featured, name_fr, name_en, name_ar, description_fr, description_en, description_ar)
  values (11, 'tablettes', false, 'Tablette Citron', 'Lemon Bar', 'لوح الليمون',
          'Du chocolat au lait garni d''une crème au citron.', 'Milk chocolate filled with a lemon cream.', 'شوكولاتة بالحليب محشوّة بكريمة الليمون.')
  returning id
), v0 as (
  insert into catalog_variants (pack_id, position, label_fr, label_en, label_ar, price)
  select id, 1, null, null, null, null from p
  returning id
)
insert into catalog_images (variant_id, position, src) values
  ((select id from v0), 1, '/photos/packs/tablette-citron.jpg');

