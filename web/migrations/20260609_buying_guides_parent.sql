-- Long-tail-varianter kobles til deres hovedguide.
alter table public.buying_guides
  add column if not exists parent_slug text;  -- NULL for hovedguider; ellers slug på hovedguide
