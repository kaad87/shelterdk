-- Hvor skal en guides kandidat-produkter findes? Anden runde.
--
-- Migration 059 oprettede buying_guides.product_categories for at skille det
-- maskinlaesbare opslag fra guidens etiket. Kolonnen blev fyldt én gang og
-- derefter aldrig laest: der var nul referencer til den i hele kodebasen, og
-- product_categories stod ikke paa FIELDS-listen i
-- app/api/admin/buying-guides/route.ts, saa admin kunne ikke opdatere den.
-- Begge dele er rettet i samme commit som denne migration.
--
-- I mellemtiden var vaerdierne blevet forkerte to gange:
--
--   1. Fase 2 delte 'beklaedning' op i hue, handsker, gamacher og undertoj.
--      De fire toejguider peger stadig paa 'beklaedning', som nu kun har 118
--      varer, mens de dedikerede kategorier har 225, 449, 41 og 153.
--   2. Flere guider pegede paa en kategori, der daekker bredere end guiden:
--      'kompas' hentede fra prepping og foerstehjaelp i stedet for navigation,
--      og 'taendstaal' og 'frysetorret-mad' hentede begge fra kogeudstyr.
--
-- Samtidig ramte produktsoegningen i admin paa buying_guides.category, som er
-- guidens etiket. For 7 af 46 udgivne guider rammer det felt NUL varer
-- ('campingstol' findes som 'campingmobler', 'stormkoekken' som 'kogeudstyr',
-- 'drybag' som 'taske', 'optaending' som 'taendstaal', 'uldundertoj' som
-- 'undertoj', 'frysetorret' som 'mad', 'kompas' som 'navigation'), saa
-- kategorifiltret gav en tom liste uanset hvad der laa i basen.
--
-- Vaerdierne herunder er maalt mod affiliate_products.category_mapped paa
-- hele kataloget (18.012 raekker), ikke udledt af navnene.
--
-- To bevidste valg:
--   pandelampe mister 'lygte'. Foer delte /bedste/pandelampe og
--   /bedste/lanterne den samme pulje, saa de kunne vaelge hinandens varer.
--   taendstaal faar baade 'taendstaal' og 'prepping', fordi de 31 og 30 varer
--   hver for sig er for lidt til en guide, og begge er optaendingsgrej.

update public.buying_guides set product_categories = v.cats from (values
  ('bestik',                   array['kogeudstyr']),
  ('campingstol',              array['campingmobler']),
  ('drikkedunk',               array['drikkedunk']),
  ('dry-bag',                  array['taske']),
  ('dunjakke',                 array['dunjakke']),
  ('dunsovepose',              array['sovepose']),
  ('familietelt',              array['telt']),
  ('fleece',                   array['fleece']),
  ('foerstehjaelp',            array['foerstehjaelp']),
  ('frysetorret-mad',          array['mad']),
  ('gamacher',                 array['gamacher']),
  ('haandklaede',              array['hygiejne']),
  ('haengekoje',               array['haengekoje']),
  ('handsker',                 array['handsker']),
  ('hue',                      array['hue']),
  ('kikkert',                  array['kikkert']),
  ('kniv',                     array['kniv']),
  ('kompas',                   array['navigation']),
  ('lanterne',                 array['lygte']),
  ('letvaegtstelt',            array['telt']),
  ('liggeunderlag',            array['liggeunderlag']),
  ('liggeunderlag-til-vinter', array['liggeunderlag']),
  ('myggenet',                 array['myggenet']),
  ('oekse',                    array['oekse']),
  ('pandelampe',               array['pandelampe']),
  ('powerbank',                array['elektronik']),
  ('regntoj',                  array['regntoj']),
  ('siddeunderlag',            array['siddeunderlag']),
  ('solhat',                   array['solhat']),
  ('sovepose',                 array['sovepose']),
  ('sovepose-til-boern',       array['sovepose']),
  ('sovepose-til-vinter',      array['sovepose']),
  ('sovepude',                 array['soveudstyr']),
  ('stormkoekken',             array['kogeudstyr']),
  ('taendstaal',               array['taendstaal','prepping']),
  ('tarp',                     array['tarp']),
  ('telt',                     array['telt']),
  ('uldundertoj',              array['undertoj']),
  ('vandfilter',               array['vandfilter']),
  ('vandrebukser',             array['vandrebukser']),
  ('vandrerygsaek',            array['rygsaek']),
  ('vandresandal',             array['vandresandal']),
  ('vandresko',                array['fodtoj']),
  ('vandresokker',             array['sokker']),
  ('vandrestav',               array['vandrestav']),
  ('vandrestovler',            array['fodtoj'])
) as v(slug, cats)
where public.buying_guides.slug = v.slug;

-- Eftersyn. Skal give NUL raekker: hver udgivet guide skal have mindst én
-- kategori, der findes blandt varer paa lager.
select g.slug, g.category, g.product_categories
from public.buying_guides g
where g.status = 'published'
  and not exists (
    select 1 from public.affiliate_products p
    where p.category_mapped = any(g.product_categories)
      and p.in_stock and not p.is_blocked
  )
order by g.slug;
