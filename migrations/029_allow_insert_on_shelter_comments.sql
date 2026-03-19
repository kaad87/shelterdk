-- Fix for existing environments:
-- Approve af community-kommentar fejler uden INSERT-policy på shelter_comments.

alter table public.shelter_comments enable row level security;

drop policy if exists "Alle kan indsætte shelter_comments" on public.shelter_comments;
create policy "Alle kan indsætte shelter_comments"
  on public.shelter_comments for insert with check (true);
