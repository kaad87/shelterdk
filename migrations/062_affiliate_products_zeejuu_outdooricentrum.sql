-- Zeejuu og Outdoor I Centrum som forhandlere i affiliate_products.
--
-- Samme spaerre som i 061: constrainten opregner forhandlerne, og et nyt feed
-- bliver afvist af den, indtil noeglen staar her. Listen skal matche
-- retailer-noeglerne i web/lib/affiliate-feeds.ts.
--
-- De to feeds er med for hver sin kategori, hvor det eksisterende katalog er
-- for tyndt til en guide: kikkert havde fire varer med brugbar tekst og
-- oekse/sav havde syv.

alter table public.affiliate_products
  drop constraint if exists affiliate_products_retailer_check;

alter table public.affiliate_products
  add constraint affiliate_products_retailer_check
  check (retailer in (
    'outmore',
    'backpackerlife',
    'outdoortid',
    'prooutdoor',
    'outdoornu',
    'zeejuu',
    'outdooricentrum'
  ));
