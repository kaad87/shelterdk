-- Sæt image_url til NULL hvor værdien er HTML (fx <a>Link</a>) eller ikke en http(s)-URL.
-- Så vises placeholder i stedet, og sortering "med billede først" virker korrekt.

UPDATE shelters
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND (
    image_url NOT LIKE 'http://%'
    AND image_url NOT LIKE 'https://%'
    OR image_url LIKE '%<%'
    OR image_url LIKE '%>%'
  );
