-- The sections (« rubriques ») of the public /collections page, edited from
-- /gestion/admin/collections/rubriques. They were a fixed list in code
-- (lib/catalog.ts, content/*.ts collectionsPage.categories) until now.

create table catalog_categories (
  -- Stable key: the page anchor (/collections#dattes) and what packs point
  -- to. Made from the French name when created, never changed afterwards.
  slug     text primary key check (slug ~ '^[A-Za-z0-9-]+$'),
  position integer not null default 0,
  name_fr  text not null,
  name_en  text,                                -- empty falls back to French
  name_ar  text
);

insert into catalog_categories (slug, position, name_fr, name_en, name_ar) values
  ('boxChocolat', 1, 'Box chocolat', 'Chocolate boxes', 'علب الشوكولاتة'),
  ('dattes',      2, 'Dattes',       'Dates',           'التمور'),
  ('tablettes',   3, 'Tablettes',    'Chocolate bars',  'ألواح الشوكولاتة'),
  ('evenements',  4, 'Événements',   'Events',          'المناسبات');

-- A pack now points to a row instead of a fixed list. A rubrique that still
-- holds packs cannot be deleted.
alter table catalog_packs drop constraint catalog_packs_category_check;
alter table catalog_packs
  add constraint catalog_packs_category_fkey
  foreign key (category) references catalog_categories (slug) on delete restrict;
