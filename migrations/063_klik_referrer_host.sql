-- Hvor et klik kom fra, som vaertsnavn.
--
-- Referreren opsamles allerede i browseren, men sendes kun videre til GA4,
-- som ligger bag samtykkeporten og maalt fanger omkring 3 % af den reelle
-- optaelling. Den gemmes ikke, og derfor kan en AI-henvisning kun ses, naar
-- assistenten selv tilfoejer en utm-parameter. ChatGPT, Copilot og Perplexity
-- goer det; Claude og Gemini goer det ofte ikke, og deres henvisninger
-- taelles i dag som direkte trafik.
--
-- Det betyder at den maalte AI-andel paa 5,5 % af affiliate-klik i oktober er
-- et gulv og ikke et tal, og at virkningen af arbejde paa AI-synlighed ikke
-- kan vurderes.
--
-- KUN vaertsnavnet gemmes, aldrig stien eller forespoergselsstrengen. Et
-- vaertsnavn er nok til at skelne chatgpt.com fra google.com, og det kan ikke
-- pege paa en person. Det holder kolonnen i samme anonyme stand som resten af
-- tabellen, der bevidst er uden bruger-id.

alter table public.affiliate_clicks
  add column if not exists referrer_host text;

alter table public.internal_events
  add column if not exists referrer_host text;

-- Forespoergslerne er altid "hvor kom klikkene fra i en periode", saa
-- vaertsnavnet indekseres sammen med tidspunktet.
create index if not exists affiliate_clicks_referrer_host_idx
  on public.affiliate_clicks (referrer_host, created_at desc);

create index if not exists internal_events_referrer_host_idx
  on public.internal_events (referrer_host, created_at desc);

comment on column public.affiliate_clicks.referrer_host is
  'Vaertsnavn fra document.referrer, uden sti og forespoergselsstreng. Null naar der ingen referrer var.';
comment on column public.internal_events.referrer_host is
  'Vaertsnavn fra document.referrer, uden sti og forespoergselsstreng. Null naar der ingen referrer var.';
