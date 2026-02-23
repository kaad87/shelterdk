-- Tilføj seo_title til shelters. Genereret SEO-titel med bynavn – original title bevares.

ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS seo_title TEXT;

COMMENT ON COLUMN public.shelters.seo_title IS 'Genereret SEO-titel med bynavn. Original title bevares i title-kolonnen.';
