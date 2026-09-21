-- Hvor skal en guides kandidat-produkter findes?
--
-- buying_guides.category er et VISNINGS-felt (badge på /bedste og gruppering i
-- hub'en). Det blev også brugt som om det pegede på affiliate_products.
-- category_mapped — men 12 af 30 guider har en category der matcher NUL
-- produkter ("campingstol" findes som "campingmobler", "stormkoekken" som
-- "kogeudstyr", "gamacher"/"hue"/"handsker" som "beklædning").
--
-- Konsekvensen var ikke en synlig fejl, men at der ikke fandtes nogen vej til
-- automatisk at finde erstatninger, da 37 produkter forsvandt fra feed'et.
--
-- product_categories holder det maskinlæsbare opslag adskilt fra visningen.
-- Værdierne er udledt af hvad guidernes egne picks faktisk er kategoriseret som.

alter table public.buying_guides add column if not exists product_categories text[];
comment on column public.buying_guides.product_categories is
  'affiliate_products.category_mapped-værdier hvor guidens kandidater findes. category er kun til visning.';

update public.buying_guides set product_categories = v.cats from (values
  ('campingstol',              array['campingmobler']),
  ('drikkedunk',               array['drikkedunk']),
  ('dry-bag',                  array['taske']),
  ('frysetorret-mad',          array['kogeudstyr']),
  ('gamacher',                 array['beklædning']),
  ('haengekoje',               array['haengekoje']),
  ('handsker',                 array['beklædning']),
  ('hue',                      array['beklædning']),
  ('kniv',                     array['kniv']),
  ('kompas',                   array['prepping','foerstehjaelp']),
  ('liggeunderlag',            array['liggeunderlag']),
  ('liggeunderlag-til-vinter', array['liggeunderlag']),
  ('myggenet',                 array['soveudstyr','hygiejne']),
  ('pandelampe',               array['pandelampe','lygte']),
  ('regntoj',                  array['regntoj']),
  ('siddeunderlag',            array['soveudstyr']),
  ('sommersovepose',           array['sovepose']),
  ('sovepose',                 array['sovepose']),
  ('sovepose-til-boern',       array['sovepose']),
  ('sovepose-til-vinter',      array['sovepose']),
  ('sovepude',                 array['soveudstyr']),
  ('stormkoekken',             array['kogeudstyr']),
  ('taendstaal',               array['kogeudstyr']),
  ('tarp',                     array['tarp']),
  ('telt',                     array['telt']),
  ('uldundertoj',              array['beklædning']),
  ('vandfilter',               array['vandfilter']),
  ('vandrerygsaek',            array['rygsaek']),
  ('vandresokker',             array['sokker']),
  ('vandrestovler',            array['fodtoj'])
) as v(slug, cats)
where buying_guides.slug = v.slug;
