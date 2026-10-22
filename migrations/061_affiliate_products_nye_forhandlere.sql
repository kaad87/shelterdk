-- Pro Outdoor og Outdoornu som forhandlere i affiliate_products.
--
-- Constrainten i 034 opregner forhandlerne, og de to nye feeds blev afvist af
-- den: "new row for relation affiliate_products violates check constraint
-- affiliate_products_retailer_check". Opregningen beholdes frem for at blive
-- lempet til et moenster, fordi den fanger en stavefejl i FEEDS, foer den
-- bliver et parallelt produktsaet med egne affiliate-links.
--
-- Listen skal matche retailer-noeglerne i web/lib/affiliate-feeds.ts. Et nyt
-- feed kraever derfor baade en linje der og en migration her.

alter table public.affiliate_products
  drop constraint if exists affiliate_products_retailer_check;

alter table public.affiliate_products
  add constraint affiliate_products_retailer_check
  check (retailer in (
    'outmore',
    'backpackerlife',
    'outdoortid',
    'prooutdoor',
    'outdoornu'
  ));
