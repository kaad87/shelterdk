-- Startpunkt paa prishistorik-kurverne.
--
-- 067 oprettede tabellen, men synken logger kun AENDRINGER: den sammenligner
-- feedets nye pris med den pris der stod i basen foer upserten, og er de ens,
-- gemmes intet. Startpunkts-grenen i logPrisHistorik (`gammel === undefined`)
-- rammer kun varer der er helt nye i kataloget.
--
-- Konsekvensen maalt 2. november 2026: tabellen havde 0 raekker, og en
-- eksisterende vare ville faa sit foerste kurvepunkt foerst ved sin foerste
-- prisaendring. Glpris er lig nypris paa ~97% af feedet, saa stabile priser er
-- normalen; for mange varer ville der gaa maaneder. Prishistorik-komponenten
-- taaler det (under to punkter giver forklarende tekst i stedet for en graf),
-- men funktionen laa i dvale paa stoerstedelen af de 362 produktsider.
--
-- Den her saetter én raekke pr. vare med dagens pris, saa hver kurve har en
-- dag 0 at maale fra. Derefter er synkens aendringslog nok: punkt to kommer
-- den dag prisen faktisk flytter sig.
--
-- Afgraensningen `price is not null` er den samme som synkens egen. Udsolgte
-- og blokerede varer tages med: deres sider findes, og en vare der kommer
-- tilbage paa lager skal have sin pris fra foer.
--
-- Idempotent via unique (product_id, observeret) fra 067, saa den kan koeres
-- igen uden at lave dubletter. Koeres kun én gang; synken klarer resten.
insert into public.affiliate_price_history
  (product_id, observeret, price, price_original, in_stock)
select
  id,
  (now() at time zone 'utc')::date,
  price,
  price_original,
  in_stock
from public.affiliate_products
where price is not null
on conflict (product_id, observeret) do nothing;
