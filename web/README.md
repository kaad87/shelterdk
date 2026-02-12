# ShelterDK – web (Next.js)

Frontend for ShelterDK. Samme design som GlampDk, koblet til shelterdk-databasen.

## Kom i gang

1. **Afhængigheder:** `npm install`
2. **Supabase:** Opret `web/.env.local` med:
   - `NEXT_PUBLIC_SUPABASE_URL` – samme værdi som i `shelterdk/.env`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` – samme værdi som i `shelterdk/.env`
3. **Kør:** `npm run dev` → åbn http://localhost:3000 (eller 3001)

## Sider

- **/** – Forside med hero, udvalgte shelters og regioner
- **/soeg** – Alle shelters (primære, uden dubletter)
- **/shelter/[slug]** – Detaljeside for ét shelter (billede, beskrivelse, rating, booking-link)

Data hentes fra Supabase-tabellen `shelters` (kun rækker hvor `duplicate_of_shelter_id` er null).
