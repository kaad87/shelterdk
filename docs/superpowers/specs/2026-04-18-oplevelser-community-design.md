# Oplevelser & Community — Design Spec
**Dato:** 2026-04-18  
**Status:** Godkendt af bruger

---

## Problemet

ShelterDK konkurrerer med Facebook-gruppen "Shelters i Danmark" (138K medlemmer) og shelter-appen om at være stedet folk deler oplevelser. Begge konkurrenter har convenience-fordelen ved at være apps. ShelterDK's styrke er derimod **struktur og søgbarhed** — en Facebook-post forsvinder i feedet efter 2 dage, mens indhold på ShelterDK lever permanent og indekseres af Google.

Forretningsmodellen er bannerannoncer, som kræver mange sidevisninger og returnerende brugere.

---

## Strategi

**Vær referencen — ikke konkurrenten.**

ShelterDK skal ikke erstatte Facebook-gruppen, men blive det sted Facebook-gruppen linker til. Når nogen poster i gruppen om et shelter, deler de et kort genereret af ShelterDK. Kortet linker tilbage til shelter-siden, hvor nye besøgende ser alle oplevelser, udforsk andre shelters og genererer annoncevisninger.

**Viral loop:**
```
Shelter-siden → Del oplevelse → Share-kort genereres
→ Brugeren poster kort i Facebook-gruppen
→ Gruppemedlemmer klikker → Lander på ShelterDK
→ Ser oplevelser, browser shelters → Bannervisning
→ Deler måske selv
```

---

## Hvad er en "oplevelse"

Minimalt format — lav friktion, højt volumen:

- **Foto(s):** 1-4 billeder. Brugeren vælger forsidebilledet til share-kortet.
- **Tekst:** 1-3 linjer fri tekst. Ingen struktureret data (ingen stjerner, ingen dato-felt).
- **Fornavn:** Vises på kortet og shelter-siden. Ikke verificeret.
- **Ingen login/email:** Helt anonymt. Moderation sker via admin-panelet der allerede eksisterer.

---

## Share-kortet

Det centrale element der skaber den virale loop. Genereres automatisk når en oplevelse er godkendt.

**Format:** Landscape billede (1.91:1 — Facebook/OG optimal). Full-bleed forsidebillede med mørk gradient-overlay. Tekst og branding ligger ovenpå.

**Indhold:**
- Forsidebillede (brugerens valgte foto)
- Shelter-navn + region (med pin-ikon)
- Brugertekst i kursiv (afkortet til ~100 tegn)
- Fornavn + dato (diskret)
- `+N billeder`-badge hvis der er flere fotos (skaber nysgerrighed → klik)
- ShelterDK-logo/URL i grøn pille (branding)

**Teknisk:** Genereres server-side via `@vercel/og` (satori) som en PNG. Endpoint: `/api/og/oplevelse/[id]`. Bruges som OG-billede på oplevelsens URL + tilbydes som download-knap.

**Deling:** Knap der åbner Facebook-gruppen "Shelters i Danmark" med pre-udfyldt link. Brugeren skriver selv sin caption i gruppen.

---

## Integration på siden

### Shelter-siden (`/shelter/[slug]`)
Ny sektion under eksisterende facilitetsinformation:

- Overskrift: "Oplevelser" + antal
- Horisontalt scroll af oplevelseskort (foto thumbnail + navn + tekst-snippet + dato)
- Prominent "**+ Del din oplevelse**"-knap (grøn, ikke gemt)
- "Se alle oplevelser →"-link hvis der er mere end 2-3

### Forsiden (`/`)
Ny sektion: "Seneste oplevelser" — horisontalt scroll af de 6-8 nyeste oplevelser på tværs af alle shelters. Giver besøgende et reason-to-explore og signalerer at siden er aktiv.

### Upload-flow (modal eller inline)
3 trin, vises når brugeren klikker "+ Del din oplevelse":

1. **Upload foto(s)** — drag/drop eller fil-vælger, op til 4 billeder, vælg forsidefoto
2. **Skriv oplevelse** — tekstfelt + fornavn-felt
3. **Del-skærm** — preview af share-kortet + Facebook-delingsknap + download-knap

---

## Moderation

Oplevelser skal godkendes før de er synlige. Eksisterende `AdminPhotoReview`-komponent og `/admin/community`-siden udvides til at håndtere oplevelser.

Standard: Oplevelser vises som "afventer" (ikke synlige) indtil admin godkender. Mål: godkendelse inden for få timer i starten, automatisk godkendelse kan overvejes senere.

Ingen rapporterings-mekanisme i første version — kan tilføjes ved behov.

---

## Datamodel

Ny Supabase-tabel: `shelter_experiences`

| Kolonne | Type | Beskrivelse |
|---|---|---|
| `id` | uuid | Primary key |
| `shelter_id` | uuid | FK → shelters |
| `author_name` | text | Fornavn (ikke verificeret) |
| `body` | text | Oplevelsestekst |
| `photo_urls` | text[] | Array af uploadede foto-URLs |
| `cover_photo_index` | int | Index i photo_urls der bruges som forsidebillede |
| `status` | enum | `pending` / `approved` / `rejected` |
| `created_at` | timestamptz | |
| `approved_at` | timestamptz | Nullable |

Storage: Fotos uploades til Supabase Storage bucket `experience-photos`.

---

## Afgrænsning (ikke i scope)

- Kommentarer på oplevelser
- Likes/reaktioner
- Brugerprofiler eller konti
- Email-notifikationer (ingen email indsamles)
- Rating/stjerner
- Automatisk Facebook-posting (brugeren poster selv)
- Push-notifikationer / PWA

---

## Succeskriterier

- Mindst én oplevelse per shelter med 3+ oplevelser inden 3 måneder
- Facebook-gruppen refererer til shelterdk.dk-links organisk
- Shelter-sider med oplevelser ranker på "[shelter navn] oplevelse" i Google
- Returnerende besøg fra Facebook-trafik stiger målbart
