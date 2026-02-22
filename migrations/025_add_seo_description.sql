-- Tilføj seo_description til shelters. Bruges af scripts/rewriteDescriptions.js til unik AI-omskrevet tekst.

ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS seo_description TEXT;

COMMENT ON COLUMN public.shelters.seo_description IS 'Unik SEO-omskrevet beskrivelse (fx via OpenAI) for at undgå duplicate content.';
