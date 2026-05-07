create or replace function public.append_user_image_url(
  p_shelter_id uuid,
  p_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_urls jsonb;
begin
  update public.shelters
  set user_image_urls =
    case
      when coalesce(user_image_urls, '[]'::jsonb) @> jsonb_build_array(p_url)
        then coalesce(user_image_urls, '[]'::jsonb)
      else coalesce(user_image_urls, '[]'::jsonb) || jsonb_build_array(p_url)
    end
  where id = p_shelter_id
  returning coalesce(user_image_urls, '[]'::jsonb) into updated_urls;

  return coalesce(updated_urls, '[]'::jsonb);
end;
$$;

create or replace function public.remove_user_image_url(
  p_shelter_id uuid,
  p_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_urls jsonb;
begin
  update public.shelters
  set user_image_urls = coalesce((
    select jsonb_agg(value)
    from jsonb_array_elements_text(coalesce(user_image_urls, '[]'::jsonb)) as value
    where value <> p_url
  ), '[]'::jsonb)
  where id = p_shelter_id
  returning coalesce(user_image_urls, '[]'::jsonb) into updated_urls;

  return coalesce(updated_urls, '[]'::jsonb);
end;
$$;
