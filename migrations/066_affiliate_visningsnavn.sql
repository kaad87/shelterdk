-- Rent produktnavn og maerke til visning, som synken ikke kan overskrive.
--
-- Maalt 1. november 2026: 242 af de 362 varer i udgivne guider (67%) har
-- feedets stoej i navnet, og 203 af dem har slet ingen `brand`. Eksempler:
-- "Stol - Treklife Low-back UL Chair", "Sovepose - Nordisk Bjarni +10 -
-- Mummy - XL", "Camelbak Thrive Flip Straw 32oz - Oxford - Str. 1L / 32 oz -
-- Drikkeflaske". Navnet gaar uaendret ud i tre flader: hub-kortet,
-- ItemList-skemaet og llms.txt, hvor der i dag staar "Foerstevalg: Dry bag -
-- 8 liter" uden hverken maerke eller model.
--
-- Hvorfor ikke bare rette `brand` og `product_name`?
-- Fordi web/scripts/sync-affiliate-products.ts skriver praecis de to
-- kolonner ved hver koersel, saa en rettelse er vaek naeste nat. Det er samme
-- faelde som `category_mapped`, hvor en backfill blev designet foer det blev
-- opdaget. Kolonnerne her staar IKKE i synkens upsert-payload, og Postgres'
-- `on conflict do update set` saetter kun de kolonner der naevnes, saa de
-- overlever.
--
-- Arbejdsdelingen er den samme som i kategori-kaeden: koden udleder
-- (web/lib/produktnavn.ts), og disse kolonner holder kun de rettelser et
-- menneske har lavet, fordi udledningen tog fejl. Null betyder "brug
-- udledningen", ikke "intet navn".

alter table public.affiliate_products
  add column if not exists display_name text,
  add column if not exists display_brand text;

comment on column public.affiliate_products.display_name is
  'Manuel rettelse af produktnavnet til visning. Null = brug rentNavn() i web/lib/produktnavn.ts. Synken rører den ikke.';
comment on column public.affiliate_products.display_brand is
  'Manuel rettelse af maerket til visning. Null = brug rentMaerke(). Synken rører den ikke, i modsaetning til brand-kolonnen.';
