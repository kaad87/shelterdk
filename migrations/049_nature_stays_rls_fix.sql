-- 049_nature_stays_rls_fix.sql — SIKKERHEDSRETTELSE
-- 048 oprettede ved en fejl permissive anon-skrive-policies (insert/update/delete
-- using(true)) på naturophold-tabellerne — det lod enhver med den offentlige
-- anon-nøgle skrive/slette direkte via PostgREST, uden om admin-secret.
-- Dette dropper dem igen. Skrivning sker herefter KUN via service_role i
-- API-routes (jf. 045_complete_rls_lockdown). Offentlig SELECT bevares.
-- Kør i Supabase SQL Editor.

drop policy if exists "nature_stays insert" on public.nature_stays;
drop policy if exists "nature_stays update" on public.nature_stays;
drop policy if exists "nature_stays delete" on public.nature_stays;

drop policy if exists "stay_guides insert" on public.stay_guides;
drop policy if exists "stay_guides update" on public.stay_guides;
drop policy if exists "stay_guides delete" on public.stay_guides;

drop policy if exists "stay_guide_entries insert" on public.stay_guide_entries;
drop policy if exists "stay_guide_entries update" on public.stay_guide_entries;
drop policy if exists "stay_guide_entries delete" on public.stay_guide_entries;
