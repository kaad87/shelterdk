-- Flyt shelters fra region "Øerne" til "Sjælland" (Bornholm, Lolland, Falster, Møn m.fl.).
-- Øerne fjernes som egen region i UI; disse shelters vises nu under Sjælland.

update public.shelters
set region = 'Sjælland'
where region = 'Øerne';
