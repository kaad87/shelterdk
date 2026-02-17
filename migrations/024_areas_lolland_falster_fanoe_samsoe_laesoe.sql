-- Nye områder: Lolland-Falster, Fanø, Samsø, Læsø.
-- Kør i Supabase SQL Editor. Efterfølgende: kør backfill-municipality-dawa.js (evt. --alle) så shelters får area_slug.

insert into public.areas (slug, name, description, region) values
('lolland-falster', 'Lolland-Falster', 'Shelters på Lolland og Falster – Guldborgsund, Maribo, Nykøbing F. og kysten.', 'Sjælland og Øerne'),
('fanoe', 'Fanø', 'Fanø med strand, marsk og shelters ved vestkysten.', 'Jylland'),
('samsoe', 'Samsø', 'Samsø – øen med grøn energi, natur og naturovernatning.', 'Jylland'),
('laesoe', 'Læsø', 'Læsø med rejer, salt og shelters.', 'Jylland')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  region = excluded.region;
