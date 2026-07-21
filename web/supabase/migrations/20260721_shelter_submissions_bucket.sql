-- Privat bucket til shelter-indsendelsers billeder (pending/). Kun service_role
-- rører den: uploads sker via createAdminClient(), previews via signed URLs,
-- og approve-flowet kopierer herfra til den offentlige 'shelter-photos'.
-- Ingen RLS-policies nødvendige (service_role omgår RLS) og ingen anon-adgang.
--
-- Rod-årsag: upload-API'et (app/api/submit-shelter/photos) og approve-flowet
-- pegede på denne bucket, men den fandtes ikke → hver foto-upload fejlede 500,
-- og 0 indsendelser fik nogensinde billeder. Anvendt mod remote 2026-07-21.
insert into storage.buckets (id, name, public)
values ('shelter-submissions', 'shelter-submissions', false)
on conflict (id) do nothing;
