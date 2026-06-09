-- Købsguider v2: scores, "bedst til"-label, forfatter.
-- Spec: docs/superpowers/specs/2026-06-09-buying-guides-v2-seo-geo-conversion-design.md

alter table public.buying_guide_entries
  add column if not exists score numeric,          -- 0-10, én decimal (redaktionel, rubrik-baseret)
  add column if not exists best_for text;          -- kort "bedst til"-label til tabel/overblik

alter table public.buying_guides
  add column if not exists author text;            -- E-E-A-T, fx "ShelterDK Redaktionen"
