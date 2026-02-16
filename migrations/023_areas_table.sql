-- Områder til landingssider: slug, navn, beskrivelse og region (Jylland / Fyn og Øerne / Sjælland og Øerne).
-- shelters.area_slug matcher areas.slug. Backfill-scriptet (backfill-municipality-dawa.js) mapper kommuner til disse slugs.
-- Kør i Supabase SQL Editor.

create table if not exists public.areas (
  slug text primary key,
  name text not null,
  description text,
  region text not null
);

comment on table public.areas is 'SEO-områder til landingssider. shelters.area_slug matcher areas.slug.';
comment on column public.areas.region is 'Overordnet region: Jylland, Fyn og Øerne eller Sjælland og Øerne';

insert into public.areas (slug, name, description, region) values
-- Jylland
('soehojlandet', 'Søhøjlandet (Silkeborg/Skanderborg)', 'Kendt som Danmarks outdoor-mekka. Her er der masser af vandrere og kanofarere på Gudenåen, som leder efter shelters ved vand og skov.', 'Jylland'),
('nationalpark-thy', 'Nationalpark Thy', 'Den vilde natur og "Cold Hawaii" trækker enormt mange naturglade turister til. Her er shelters i klitplantagerne meget eftertragtede.', 'Jylland'),
('rold-skov-rebild', 'Rold Skov og Rebild Bakker', 'Et af Danmarks største skovområder og en ægte klassiker inden for friluftsliv.', 'Jylland'),
('limfjorden', 'Limfjorden', 'Et enormt kystområde, der dækker mange kommuner. Landingssider målrettet shelters "rundt om Limfjorden" er meget populære for kajakroere og cyklister.', 'Jylland'),
('vadehavet', 'Vadehavet (Nationalpark)', 'Unik natur på vestkysten, som tiltrækker både danske og tyske turister.', 'Jylland'),
('haervejen', 'Hærvejen', 'Selvom det er en rute og ikke et klassisk "område", er en landingsside dedikeret til shelters langs Hærvejen guld værd for vandrere og cyklister.', 'Jylland'),
-- Fyn og Øerne
('sydfynske-oeehav', 'Det Sydfynske Øhav', 'Et af de absolut mest populære steder for kystnære shelters. Her kan du med fordel samle Langeland, Ærø, Tåsinge og kysten på Sydfyn, da det er et paradis for havkajak og ø-hop.', 'Fyn og Øerne'),
('hindsholm-nordfyn', 'Hindsholm og Nordfyn', 'Tilbyder fantastisk kystnatur og er et godt, lidt mere roligt alternativ til Sydfyn.', 'Fyn og Øerne'),
-- Sjælland og Øerne
('sydsjaelland-moen', 'Sydsjælland og Møn (Camønoen)', 'Området omkring Møns Klint og vandreruten Camønoen har skabt en massiv efterspørgsel på shelters hernede.', 'Sjælland og Øerne'),
('odsherred', 'Odsherred (Geopark Odsherred)', 'Et bakket, smukt istidslandskab med masser af skov og kyst, som er meget velbesøgt af sjællændere på weekendtur.', 'Sjælland og Øerne'),
('kongernes-nordsjaelland', 'Nationalpark Kongernes Nordsjælland', 'Dækker blandt andet over Gribskov og Esrum Sø. Et enormt populært område for folk fra Hovedstadsområdet, der vil i skoven.', 'Sjælland og Øerne'),
('skjoldungernes-land', 'Skjoldungernes Land (Roskilde Fjord)', 'Oplagt område for folk, der leder efter fjordnære shelters på Sjælland.', 'Sjælland og Øerne'),
-- Øvrige (allerede i brug fra 022)
('lolland', 'Lolland', 'Shelters på Lolland og i Guldborgsund.', 'Sjælland og Øerne'),
('bornholm', 'Bornholm', 'Bornholms shelters og natur.', 'Sjælland og Øerne')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  region = excluded.region;
