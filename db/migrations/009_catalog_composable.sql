-- A pack the visitor composes, such as macarons: each variant is a flavour.
-- The site shows one photo per flavour in the slider, and the flavour on
-- screen is the one added to the basket, so a box is built flavour by
-- flavour. Ticked in /gestion/admin/collections.

alter table catalog_packs add column composable boolean not null default false;
