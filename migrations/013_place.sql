-- Præcist stednavn (landsby, by) til visning – kommune beholdes til filtrering.
-- Eksempel: place = "Stouby", kommune = "Vejle" så vises "Stouby" i stedet for "Vejle".

alter table public.shelters
  add column if not exists place text;

comment on column public.shelters.place is 'Præcist stednavn fra reverse geocoding (village/town/city). Bruges til visning; kommune bruges til filtrering.';

-- Efter migration: kør for at udfylde place for eksisterende shelters:
--   python3 backfill_kommune_from_geo.py --refresh-place
-- (eller --refresh-place --dry-run først). Tager ca. 1 sek per shelter pga. rate limit.
