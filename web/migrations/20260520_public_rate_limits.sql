create table if not exists public.public_rate_limits (
  scope text not null,
  subject_hash text not null,
  bucket_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash, bucket_start)
);

alter table public.public_rate_limits enable row level security;

create index if not exists public_rate_limits_updated_at_idx
  on public.public_rate_limits (updated_at);

create or replace function public.consume_public_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_window_seconds integer,
  p_max_hits integer
)
returns table (
  allowed boolean,
  hits integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_bucket_epoch bigint;
  v_bucket_start timestamptz;
  v_hits integer;
  v_elapsed integer;
begin
  if p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be positive';
  end if;

  if p_max_hits <= 0 then
    raise exception 'p_max_hits must be positive';
  end if;

  delete from public.public_rate_limits
  where updated_at < (v_now - interval '2 days');

  v_bucket_epoch :=
    floor(extract(epoch from v_now) / p_window_seconds)::bigint * p_window_seconds;
  v_bucket_start := to_timestamp(v_bucket_epoch);

  insert into public.public_rate_limits (
    scope,
    subject_hash,
    bucket_start,
    hits,
    updated_at
  )
  values (
    p_scope,
    p_subject_hash,
    v_bucket_start,
    1,
    v_now
  )
  on conflict (scope, subject_hash, bucket_start)
  do update
    set hits = public.public_rate_limits.hits + 1,
        updated_at = excluded.updated_at
  returning public.public_rate_limits.hits into v_hits;

  v_elapsed := greatest(
    0,
    floor(extract(epoch from (v_now - v_bucket_start)))::integer
  );

  allowed := v_hits <= p_max_hits;
  hits := v_hits;
  retry_after_seconds := greatest(1, p_window_seconds - v_elapsed);

  return next;
end;
$$;

revoke all on table public.public_rate_limits from anon, authenticated;
revoke all on function public.consume_public_rate_limit(text, text, integer, integer) from public;

grant execute on function public.consume_public_rate_limit(text, text, integer, integer)
  to service_role;
