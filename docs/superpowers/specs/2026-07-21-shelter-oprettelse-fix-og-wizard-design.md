# Shelter-oprettelse: fix af billed-upload + sammenlægning til wizard — Design

**Dato:** 2026-07-21
**Status:** Godkendt design (afventer implementeringsplan)

## Mål

Få ejeres selvbetjente shelter-oprettelse til at virke helt — inkl. billed-upload — og samle to overlappende formularer til ét lækkert trin-for-trin-flow, så indsendelser lander i admin-køen med billeder klar til ét-kliks godkendelse → live.

## Baggrund: hvad findes allerede

Flowet er allerede bygget og wired end-to-end (bekræftet i koden):

- **Offentlige formularer:** to stykker, begge sender `type: "owner_registration"` til `POST /api/submit-shelter`:
  - `/registrer-shelter` → `RegistrerShelterForm` (261 l): navn, placering (fritekst), kapacitet, beskrivelse, faciliteter, kontakt, booking-URL. **Ingen kort, ingen billeder.** Linket fra footeren ("Tilføj manglende shelter").
  - `/opret-shelter` → `ShelterSubmissionForm` (635 l): alt ovenstående **plus** kort-placering (lat/lng), billed-upload og booking-opt-in (sektion 5). Næsten ikke linket.
- **Datalag:** tabellen `shelter_submissions` (`type`, `status` = pending/approved/rejected, `photo_urls` text[], `lat`/`lng`, `facilities` jsonb, `wants_booking`, kontakt m.m.). Payload valideres i `submit-shelter/route.ts` (maks 5 billeder, path-regex, email-krav for owner_registration).
- **Foto-upload-API:** `POST /api/submit-shelter/photos` — solid: rate-limit, type/størrelse-guard, honeypot, uploader til bucket `shelter-submissions` under `pending/<uuid>.<ext>`, returnerer signed preview-URL + HMAC delete-token. `DELETE` samme rute til at fjerne før submit.
- **Admin-godkendelse:** `/admin/shelter-ansogninger` + `POST /api/admin/approve-shelter-submission` (+ reject, + pending-list). Approve hævder submission atomisk (status → approved, guard mod dobbelt-behandling), genererer unik slug, **kopierer billeder** fra `shelter-submissions` → `shelter-photos`, og **inserter i `shelters`** → live.

**Aktuel brug (DB):** 1 owner_registration approved, 3 owner pending (ældste 13. juli), 4 user_tip pending, 11 user_tip rejected. **0 indsendelser nogensinde har haft billeder.**

## Rod-årsag til den manglende billed-upload (bekræftet)

Upload-API'et og approve-flowet peger begge på storage-bucketen `shelter-submissions` — **men den bucket eksisterer ikke.** De eneste buckets er `experience-photos`, `nature-stays`, `shelter-photos`. Hver eneste upload fejler derfor med 500 ("Upload fejlede — prøv igen"), og fejlen har ikke været tydelig nok til at nogen opdagede det. Resten af pipelinen er korrekt.

## Design

### Del 1 — Fix billed-uploaden

- **Opret den private bucket `shelter-submissions`** (ikke public) med storage-policies:
  - Kun `service_role` kan læse/skrive (uploads går via `createAdminClient()` i API'et; previews via signed URLs). Ingen anon-adgang — jf. projektets regel om ingen anon-write.
  - Bekræft at approve-flowets `download` fra `shelter-submissions` og `upload` til `shelter-photos` virker med de nye policies.
- **Verifikation (ende-til-ende):** upload et billede via formularen → bekræft objekt i `pending/` + `photo_urls` gemt på submission → godkend i admin → bekræft billede kopieret til `shelter-photos`, `image_url`/`image_urls` sat på det nye shelter, og shelteret live.

### Del 2 — Saml de to formularer

- `/registrer-shelter` forbliver den kanoniske URL (allerede linket/indekseret), men renderer fremover den rige wizard-formular.
- **301-redirect** `/opret-shelter` → `/registrer-shelter` (bevar evt. link-equity, undgå dubletindhold).
- **Slet** `RegistrerShelterForm` og `/opret-shelter/page.tsx` (død kode efter flytning). Footer-linket er uændret.

### Del 3 — UX-pas: wizard

Struktur = **trin-for-trin wizard** med fremgangslinje (valgt frem for én-side og hybrid):

1. **Om shelteret** — navn, placering (fritekst), kapacitet, beskrivelse, booking-URL
2. **Kort** — sæt markør (lat/lng), kort + satellit-lag
3. **Faciliteter** — checkboxes (`FACILITY_KEYS`)
4. **Billeder** — se nedenfor
5. **Booking** — opt-in (`wants_booking` + accept)
6. **Gennemse & send** — opsummering + kontakt (navn/email) + honeypot

- Ét trin vises ad gangen; Næste/Tilbage; klient-side-validering pr. trin før man kan gå videre.
- Mobil-først; arver nordiske brand-toner (pine/sand).
- **Kvitteringsskærm:** "Din indsendelse er modtaget — vi godkender den snart."

**Billed-trin (trin 4) = stor drop-zone + thumbnail-stribe** (valgt frem for felt-grid):
- Stor træk-og-slip-zone ("Træk billeder hertil eller vælg filer"; JPG/PNG/WebP, maks 5, op til 10 MB).
- Uploadede billeder som miniatur-stribe nedenunder: ×-fjern (kalder `DELETE`-ruten med delete-token), **hovedbillede-markering** (første = hoved, kan ombyttes), **live upload-progress**.
- **Tydelig, synlig fejltilstand** ved upload-fejl — den centrale læring fra bug'en, så billeder aldrig igen tavst mistes.

## Arkitektur / berørte enheder

- **Storage:** ny bucket `shelter-submissions` + policies (migration/opsætning).
- **Behold uændret:** `POST /api/submit-shelter`, `POST/DELETE /api/submit-shelter/photos`, `approve/reject`-API'er, `shelter_submissions`-skema, `lib/shelter-submissions.ts`. (Uploaden er allerede korrekt kode; kun bucketen manglede.)
- **Ombyg:** `ShelterSubmissionForm.tsx` → wizard (evt. udskilt i mindre trin-komponenter, da 635 l er meget for én fil). Genbrug eksisterende felt-state og submit-logik.
- **Routing:** `/registrer-shelter/page.tsx` renderer wizard'en; `/opret-shelter` → redirect; slet gammel form.
- **Approve:** tilføj revalidering af den nye shelter-side + relevant region efter insert (så godkendt shelter er synligt straks, ikke først efter ISR-vinduet).

## Fejlhåndtering

- Upload-fejl: synlig fejlbesked pr. billede + mulighed for at prøve igen; blokerer ikke resten af formularen (billeder er valgfri).
- Submit-fejl: bevar indtastede felter, vis fejl, tillad gensend.
- Approve: eksisterende atomiske claim-guard bevares; enkelt-billed-kopifejl logges men vælter ikke hele godkendelsen (eksisterende adfærd).

## Test

- **Ende-til-ende manuelt** via preview: fuld wizard inkl. upload → submit → godkend → live shelter med billede.
- **Enheds-/integrationstest** hvor det giver mening (path-regex, payload-validering findes allerede). Ingen ny backend-logik kræver stor test-udvidelse; fokus er UI + storage-opsætning.
- `tsc --noEmit` + `next lint` grønne før push (Netlify bygger med lint).

## Uden for scope (bevidst)

- De 7 ventende indsendelser i backloggen (håndteres separat bagefter).
- `user_tip`-flowet (denne opgave dækker kun ejer-registrering).
- Egentlig redesign ud over det aftalte UX-pas.
- Compute-opgraderingen af Supabase (separat driftsbeslutning).
