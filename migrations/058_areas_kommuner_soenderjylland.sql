-- Landsdels-områder defineret ved kommuner.
-- shelters.area_slug er én-værdi og allerede brugt af overlappende områder
-- (Vadehavet, Hærvejen dækker en del af Sønderjylland), så et Sønderjylland-
-- område kan ikke bygges på area_slug uden at tage pladser fra dem.
-- I stedet: areas.kommuner (text[]) — når sat, findes områdets shelters som
-- shelters.kommune = any(kommuner). Læses af web/lib/area-db.ts.
--
-- Baggrund (Search Console sep. 2026): "shelter sønderjylland", "teltplads
-- sønderjylland", "shelter overnatning sønderjylland" = 226 visn/md, pos 9-12,
-- 1 klik, ingen side at lande på.

alter table public.areas add column if not exists kommuner text[];
comment on column public.areas.kommuner is
  'Kommunenavne (shelters.kommune) der udgør området. Når sat, bruges den i stedet for shelters.area_slug.';

insert into public.areas (slug, name, description, region, kommuner) values
('soenderjylland', 'Sønderjylland',
 'Sønderjylland har godt 100 shelters fordelt på Sønderborg, Aabenraa, Tønder og Haderslev – fra Als og Flensborg Fjord i øst over Sundeved og Gråsten-skovene til Vadehavet, Rømø og marsken i vest. Sønderborg alene har over 40 pladser, mange af dem ved kysten, og Hærvejen og Gendarmstien passerer adskillige shelters undervejs. Grænselandet byder på en blanding af skovshelters, kystshelters og lejrpladser ved de mange småhavne.',
 'Jylland', array['Aabenraa','Sønderborg','Tønder','Haderslev'])
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  region = excluded.region,
  kommuner = excluded.kommuner;
