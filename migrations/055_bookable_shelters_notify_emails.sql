-- 055: ekstra notifikationsmodtagere pr. bookbart shelter
--
-- Baggrund: ejeren af Legind Bjerge bad om at bookingnotifikationer også gik til
-- en fælles foreningsmail. Flere adresser kan IKKE bare proppes ind i
-- `owner_email` — det felt er identitetsnøgle og slås op med lighed flere steder
-- (`api/ejer/signup`, `api/ejer/claim`, `api/admin/owner-login-link`). En
-- kommasepareret værdi ville stille og roligt afskære ejeren fra at logge ind.
--
-- Derfor holdes de to begreber adskilt:
--   owner_email   = ejerens identitet/login (uændret, præcis én adresse)
--   notify_emails = yderligere modtagere af de samme notifikationer
--
-- Mail-laget (`sendLoggedEmail`) understøtter allerede `to: string[]`, inkl.
-- suppression-filtrering og logning pr. modtager, så der skal ikke ændres noget
-- i afsendelsen ud over at bygge listen.

alter table public.bookable_shelters
  add column if not exists notify_emails text[];

comment on column public.bookable_shelters.notify_emails is
  'Ekstra modtagere af bookingnotifikationer ud over owner_email. Kun notifikationer — bruges ALDRIG til login, ejer-claim eller adgangskontrol.';
