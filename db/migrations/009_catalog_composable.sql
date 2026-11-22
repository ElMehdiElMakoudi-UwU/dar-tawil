-- A pack the visitor composes, such as macarons: instead of picking one
-- size, they set a quantity for each variant (one per flavour) and the
-- basket gets one line per flavour chosen. Ticked in /gestion/admin/collections.

alter table catalog_packs add column composable boolean not null default false;
