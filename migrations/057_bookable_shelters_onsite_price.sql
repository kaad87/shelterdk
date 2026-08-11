-- 057: pris som ejeren opkræver SELV, uden om ShelterDKs betalingsflow
--
-- Baggrund: ejeren af Legind Bjerge opkræver 50 kr pr. nat pr. person via
-- MobilePay direkte. Siden viste "Gratis shelter — du betaler kun et
-- bookinggebyr fra 25 kr", altså direkte misvisende for gæsten.
--
-- Hvorfor ikke bare bruge `shelter_price_dkk`: det felt ER opkrævningen.
--   totalDkk = shelter_price_dkk + platformgebyr   (lib/stripe.ts calculateFee)
-- Sattes 50 dér, ville Stripe trække 75 kr af gæsten, og platformen ville
-- skylde ejeren de 50. Præcis modsat af det ønskede.
--
-- Derfor et SEPARAT felt frem for en boolean på det eksisterende. Et felt som
-- betalingslogikken slet ikke kender, kan ikke ved et uheld komme til at indgå
-- i en opkrævning — hvor en flag-variant ville fejle stille, hvis blot ét
-- kodested glemte at tjekke den.

alter table public.bookable_shelters
  add column if not exists onsite_price_dkk integer,
  add column if not exists onsite_price_basis text,
  add column if not exists onsite_payment_note text;

alter table public.bookable_shelters
  drop constraint if exists bookable_shelters_onsite_price_basis_check;

alter table public.bookable_shelters
  add constraint bookable_shelters_onsite_price_basis_check
  check (
    onsite_price_basis is null
    or onsite_price_basis in ('per_person_per_night', 'per_night', 'per_booking')
  );

comment on column public.bookable_shelters.onsite_price_dkk is
  'Beløb ejeren opkræver DIREKTE af gæsten (fx MobilePay ved ankomst). Indgår ALDRIG i Stripe-opkrævningen — se lib/stripe.ts calculateFee, som kun kender shelter_price_dkk.';
comment on column public.bookable_shelters.onsite_price_basis is
  'Hvordan onsite_price_dkk skal ganges op: per_person_per_night | per_night | per_booking.';
comment on column public.bookable_shelters.onsite_payment_note is
  'Fri tekst til gæsten om hvordan der betales på stedet, fx "MobilePay 356093".';
