create table if not exists booking_monitor_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  severity text not null check (severity in ('info', 'warning', 'error', 'critical')),
  source text not null,
  event_type text not null,
  message text not null,
  booking_id uuid null,
  payment_id uuid null,
  shelter_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  needs_attention boolean not null default false,
  acknowledged_at timestamptz null,
  acknowledged_by text null,
  resolved_at timestamptz null,
  resolved_by text null
);

create index if not exists booking_monitor_events_created_at_idx
  on booking_monitor_events (created_at desc);

create index if not exists booking_monitor_events_attention_idx
  on booking_monitor_events (needs_attention, acknowledged_at, created_at desc);

create index if not exists booking_monitor_events_severity_idx
  on booking_monitor_events (severity, created_at desc);

create index if not exists booking_monitor_events_booking_id_idx
  on booking_monitor_events (booking_id);

create index if not exists booking_monitor_events_payment_id_idx
  on booking_monitor_events (payment_id);

create index if not exists booking_monitor_events_shelter_id_idx
  on booking_monitor_events (shelter_id);
