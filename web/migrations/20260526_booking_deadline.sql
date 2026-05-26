-- Tidsfrist for samme-dag-booking
--
-- Tilføjer mulighed for at en ejer kan sætte en "lukketid" for nye
-- bookings på samme dag. Når aktuelle tid (Europe/Copenhagen) er senere
-- end deadline, kan gæster ikke længere booke til i dag — kun til i
-- morgen eller frem. Bookings til fremtidige datoer berøres ikke.
--
-- NULL = ingen tidsfrist (default, uændret adfærd for eksisterende
-- pladser). Værdier gemmes i Europe/Copenhagen lokal tid.

alter table public.bookable_shelters
  add column if not exists same_day_booking_deadline time;

comment on column public.bookable_shelters.same_day_booking_deadline is
  'Lokal tid (Europe/Copenhagen). Når nu >= denne tid, kan gæster ikke booke til samme dag. NULL = ingen tidsfrist.';
