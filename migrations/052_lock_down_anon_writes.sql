-- migrations/052_lock_down_anon_writes.sql
-- Security: removes always-true RLS write policies that exposed core tables to the
-- `anon`/`public` role via the public REST API, and revokes anon/authenticated
-- EXECUTE on the photo-mutating SECURITY DEFINER functions.
--
-- These "til import" policies were never needed: imports, owner edits and admin
-- routes all use the service_role key, which bypasses RLS entirely. As written,
-- anyone on the internet could overwrite/insert shelters, inject or delete reviews,
-- and add/remove shelter photos. Verified (2026-06-28) that no app code writes these
-- tables or calls these functions via the anon/public client — only createAdminClient().
-- Public SELECT policies are intentionally kept.

-- shelters: anon could INSERT + UPDATE the core content table
DROP POLICY IF EXISTS "Tillad insert og update (til import)" ON public.shelters;
DROP POLICY IF EXISTS "Tillad update (til import)" ON public.shelters;

-- google_place_reviews: anon could INSERT / UPDATE / DELETE reviews
DROP POLICY IF EXISTS "google_place_reviews insert" ON public.google_place_reviews;
DROP POLICY IF EXISTS "google_place_reviews update" ON public.google_place_reviews;
DROP POLICY IF EXISTS "google_place_reviews delete" ON public.google_place_reviews;

-- google_places: anon could INSERT / UPDATE
DROP POLICY IF EXISTS "google_places insert" ON public.google_places;
DROP POLICY IF EXISTS "google_places update" ON public.google_places;

-- shelter_google_match: anon could INSERT / UPDATE / DELETE
DROP POLICY IF EXISTS "shelter_google_match insert" ON public.shelter_google_match;
DROP POLICY IF EXISTS "shelter_google_match update" ON public.shelter_google_match;
DROP POLICY IF EXISTS "shelter_google_match delete" ON public.shelter_google_match;

-- raw import tables: anon could INSERT / UPDATE
DROP POLICY IF EXISTS "naturstyrelsen_raw insert" ON public.naturstyrelsen_raw;
DROP POLICY IF EXISTS "naturstyrelsen_raw update" ON public.naturstyrelsen_raw;
DROP POLICY IF EXISTS "bookenshelter_raw insert" ON public.bookenshelter_raw;
DROP POLICY IF EXISTS "bookenshelter_raw update" ON public.bookenshelter_raw;

-- Photo-mutating SECURITY DEFINER functions: only ever called server-side via
-- service_role. EXECUTE was granted to PUBLIC (so revoking from anon alone is a
-- no-op) — revoke from PUBLIC and re-grant to service_role so the owner/admin flow
-- (createAdminClient) keeps working while anon can no longer hit /rest/v1/rpc.
REVOKE EXECUTE ON FUNCTION public.append_user_image_url(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_photo_from_shelter(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_user_image_url(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_user_image_url(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_photo_from_shelter(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_user_image_url(uuid, text) TO service_role;
