-- Fjern Cookiebot/1.gif fra image_url og image_urls – det er tracking-placeholders, ikke rigtige billeder.
-- Efter kørsel kan I udfylde billeder fra Google Places med: python3 backfill_image_from_google_places.py

-- image_url = cookiebot eller 1.gif → sæt til NULL
UPDATE public.shelters
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND (image_url ILIKE '%cookiebot.com%' OR image_url LIKE '%/1.gif');

-- image_urls (jsonb) hvor alle entries er cookiebot/1.gif → sæt til NULL
UPDATE public.shelters
SET image_urls = NULL
WHERE image_urls IS NOT NULL
  AND image_urls::text ILIKE '%cookiebot%';

UPDATE public.shelters
SET image_urls = NULL
WHERE image_urls IS NOT NULL
  AND image_urls::text LIKE '%1.gif%';
