-- Prishistorik. Der findes ingen i dag.
--
-- Synken upserter paa `id` og overskriver `price` paa plads hver nat, saa
-- gaarsdagens pris er vaek. Det maaler: en bruger der soeger "Haglöfs Musca
-- -13 pris" vil vide om 995 kr. er en god pris lige nu, og det kan kun
-- besvares med en kurve. Ingen dansk konkurrent har den, og den kan ikke
-- bygges bagud, kun fremad, saa den starter nu for at vaere noget vaerd til
-- foraarssaesonen. Black Friday om under fire uger er desuden praecis naar
-- priserne bevaeger sig.
--
-- KUN AENDRINGER LOGGES, ikke en raekke pr. vare pr. dag. 13.391 koebbare
-- varer gange 365 dage ville vaere ~4,9 mio. raekker om aaret, og projektet
-- har allerede haft egress-overforbrug. En prisKURVE er en trappefunktion, saa
-- aendringspunkterne er praecis det der skal tegnes: intet tabes ved at
-- udelade de dage hvor prisen stod stille.
--
-- `observeret` er datoen, ikke et tidsstempel, og unique-noeglen gaelder
-- (product_id, observeret). Synken kan derfor koere to gange samme dag uden
-- at lave dubletter, og en dag med to prisaendringer gemmer den sidste.

create table if not exists public.affiliate_price_history (
  id bigserial primary key,
  product_id text not null references public.affiliate_products(id) on delete cascade,
  observeret date not null default (now() at time zone 'utc')::date,
  price numeric not null,
  price_original numeric,
  in_stock boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, observeret)
);

-- Opslaget er altid "hele kurven for én vare, i tidsorden".
create index if not exists idx_price_history_vare
  on public.affiliate_price_history (product_id, observeret);

alter table public.affiliate_price_history enable row level security;

-- Laeses af offentlige sider (produktsiden tegner kurven). Skrives kun af
-- synken, som bruger service_role og dermed gaar uden om RLS. Der tilfoejes
-- bevidst INGEN write-policy: en always-true write-policy ville lade en
-- anonym klient skrive prishistorik.
drop policy if exists "price history er offentlig laesning" on public.affiliate_price_history;
create policy "price history er offentlig laesning"
  on public.affiliate_price_history for select
  using (true);
