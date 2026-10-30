-- Outnorth som forhandler i affiliate_products.
--
-- Samme spaerre som i 061 og 062: constrainten opregner forhandlerne, og et
-- nyt feed bliver afvist af den, indtil noeglen staar her. Listen skal matche
-- retailer-noeglerne i web/lib/affiliate-feeds.ts.
--
-- Outnorth er det foerste feed fra Awin og ikke fra Partner-ads. Det er med
-- for grejet: de to store partner-ads-feeds er stoerst paa toej og fodtoej,
-- mens Outnorth har dybde i telte, soveposer, liggeunderlag, rygsaekke,
-- trekkoekkener, pandelamper og knive, hvor kataloget hidtil har vaeret tyndt.
-- 684 varer fordelt paa 35 kategorier med loft 20 pr. kategori.

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
    'outdooricentrum',
    'outnorth'
  ));
