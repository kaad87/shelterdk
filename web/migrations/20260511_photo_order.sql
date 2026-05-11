-- Add photo_order column to shelters
-- photo_order stores the full display order of all photo URLs for a shelter.
-- NULL means "use default order" (backward-compatible).
alter table public.shelters
  add column if not exists photo_order text[] default null;

-- RPC: atomically remove a URL from both user_image_urls (jsonb) and photo_order (text[]).
-- Called by the owner billeder DELETE handler.
create or replace function public.remove_photo_from_shelter(
  p_shelter_id uuid,
  p_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shelters
  set
    user_image_urls = coalesce((
      select jsonb_agg(value)
      from jsonb_array_elements_text(coalesce(user_image_urls, '[]'::jsonb)) as value
      where value <> p_url
    ), '[]'::jsonb),
    photo_order = array_remove(photo_order, p_url)
  where id = p_shelter_id;
end;
$$;
