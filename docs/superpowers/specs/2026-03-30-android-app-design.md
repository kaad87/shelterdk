# ShelterDK Android App — Design Spec

## Oversigt

Konvertering af shelterdk.dk til en native Android-app med React Native (Expo). Appen deler backend (Supabase) med den eksisterende Next.js-webapp og genbruger forretningslogik via en fælles `shared/`-mappe.

**Primære mål:**
- Bedre GPS/rute-tracking (baggrunds-GPS)
- Offline-kort med downloadbare tile packs
- Kamera-integration til foto-upload
- Lokal data-caching for hurtig og offline adgang
- App-agtig brugeroplevelse med native navigation

**Scope (v1):** Kort, shelter-detaljer, søg/filter, ruteplanner, guides, blog. Fuld paritet med websiden minus admin-funktioner og turvenner (v2).

**Teknologi:** Expo SDK 52, Expo Router, Mapbox GL Native, expo-location, expo-camera, expo-sqlite, Zustand.

---

## 1. Projektstruktur — Monorepo

```
shelterdk/
├── package.json            ← root workspace config
├── web/                    ← eksisterende Next.js site
├── app/                    ← ny Expo/React Native app
│   ├── app/                ← Expo Router (file-based routing)
│   ├── components/         ← React Native UI-komponenter
│   ├── hooks/              ← app-specifikke hooks
│   ├── assets/             ← app-ikon, splash screen
│   ├── metro.config.js     ← Metro bundler config (resolver for shared/)
│   └── app.json            ← Expo config
└── shared/                 ← delt kode mellem web og app
    ├── package.json        ← egen package for workspace resolution
    ├── lib/                ← Supabase queries, typer, utils
    ├── types/              ← TypeScript interfaces
    └── constants/          ← fælles konstanter
```

### Monorepo-tooling

npm workspaces med root `package.json`:
```json
{
  "private": true,
  "workspaces": ["web", "app", "shared"]
}
```

Metro (Expo's bundler) konfigureres i `app/metro.config.js` til at resolve `shared/`-pakken. Web'en bruger TypeScript path aliases i `tsconfig.json` til at importere fra `shared/`.

### Delt kode — fil-for-fil migreringsplan

**Flyttes til `shared/lib/`** (ren logik, ingen platform-afhængigheder):
- `web/lib/shelter-detail.ts` — shelter queries
- `web/lib/slug.ts` — slug utilities
- `web/lib/haversine.ts` — afstandsberegning
- `web/lib/soeg-filters.ts` — filtreringslogik
- `web/lib/gpx-parser.ts` — GPX import
- `web/lib/gpx-export.ts` — GPX export
- `web/lib/relative-time-da.ts` — dansk tidsformatering
- `web/lib/area-db.ts` — area/preposition-logik (den rene del)

**Flyttes til `shared/types/`:**
- `web/types/shelter.ts`
- `web/types/curated-route.ts`
- Øvrige delte type-definitioner

**Platform-specifikke wrappers** (interface i shared, implementation per platform):
- **Supabase client:** Web bruger `@supabase/ssr` med cookie-handling. App bruger `@supabase/supabase-js` med `@react-native-async-storage/async-storage` til token persistence. Fælles interface i `shared/lib/supabase-client.ts`, platform-specifik init i `web/` og `app/`.
- **Billede-URLs:** Web bruger `/api/google-photo?ref=...` (Next.js API route). App kalder websidens endpoint som remote URL: `https://shelterdk.dk/api/google-photo?ref=...`. Simpelt og kræver ingen ny backend.

**Forbliver i `web/`** (web-only):
- `web/utils/supabase/server-admin.ts` — service_role client
- `web/utils/supabase/server-public.ts` — SSR client
- `web/lib/renderContent.tsx` — React DOM markup
- Alle React DOM hooks (`useInView`, `use-community-data`, etc.)

---

## 2. Kort og offline-kort

**Mapbox GL Native (`@rnmapbox/maps`)** erstatter Leaflet (som er web-only):

- Built-in offline tile packs — brugeren downloader et område og kan se kortet uden internet
- Bedre native performance end web-baserede kort
- Understøtter baggrunds-GPS tracking med smooth animation

**Offline-kort flow:**
1. Brugeren vælger et område (fx "Jylland Nord") eller en rute
2. Appen downloader tile pack + shelter-data for området
3. Gemmes lokalt — virker helt uden internet
4. Shelter-markører, ruter og detaljer tilgængelige offline

**Kort-features:**
- Shelter-markører med cluster ved zoom-out
- Brugerens position som live-prik
- Rute-visning med Polyline
- Filter-chips (toilet, vand, bålplads, strand, hund, bruser, etc.)
- "Download område"-knap på kort-skærmen

**Mapbox pricing:** Gratis op til 25.000 MAU for Maps. Offline tile downloads tæller som tile requests — ved moderat brug (3-5 regioner per bruger) holder det sig inden for free tier. Skal monitoreres efter launch.

---

## 3. GPS og rute-tracking

**Baggrunds-GPS med `expo-location`:**
- Tracker brugerens position selv når appen er minimeret
- Android: persistent notification ("ShelterDK tracker din rute")

**Features:**
- **Live position på kortet** — blå prik der følger dig
- **Rute-optagelse** — start/stop tracking, gem din vandrede rute
- **Afstand og tid** — løbende distance, tempo, varighed
- **Nærhed-alerts** — notifikation når du er tæt på et shelter (inden for 500m)
- **Rute-afvigelse** — advarsel hvis du er kommet væk fra den planlagte rute

**Gem ruter lokalt:**
- Trackede ruter gemmes i SQLite lokalt med device UUID som ejer
- Synkes til Supabase når der er internet
- Brugeren kan se sine tidligere ture med kort og statistik

**Strømforbrug:**
- `balanced` mode: god nøjagtighed uden at dræne batteriet
- Brugeren kan vælge mellem "høj nøjagtighed" og "batterispar"

---

## 4. Kamera og foto-upload

**`expo-camera` og `expo-image-picker`:**

- Direkte foto fra appen — åbn kamera, tag billede, upload
- Vælg fra galleri
- Komprimering via `expo-image-manipulator`: max 1200px bredde, JPEG kvalitet 0.8 (~200-400 KB per billede)
- Offline-kø — billeder gemmes lokalt og uploades automatisk ved forbindelse

**Flow:**
1. Shelter-detalje → "Tilføj foto"
2. Kamera eller galleri
3. Preview med mulighed for kort tekst
4. Upload til Supabase Storage (samme bucket som websiden) via anon key med permissive RLS på storage bucket
5. Synligt på shelter-siden — både i app og på web

Samme `community_photos`-tabel som websiden bruger.

---

## 5. Lokal data-caching og offline

**SQLite med `expo-sqlite`:**

- Shelter-data caches lokalt ved første load
- Synkronisering: ved app-start tjekkes `updated_at` timestamps
- Appen virker hurtigt selv med dårlig forbindelse

**Caching-strategi:**
| Data | Strategi | Størrelse |
|---|---|---|
| Shelters (alle) | Komplet cache | ~2-5 MB |
| Kort-tiles | Brugerens valg per område | ~50-150 MB/region |
| Billeder | Thumbnails cached, full-size on-demand | Variabel |
| Ruter | Downloadede ruter med geometry | ~1-5 MB |
| Guides/blog | Tekst cached | < 1 MB |

**Offline-indikator:**
- Diskret banner: "Du er offline — viser cached data"
- Internet-krævende handlinger (booking-links) vises som disabled
- Foto-uploads og rute-synk køres automatisk ved forbindelse

**Første åbning:**
- Grunddata downloades (~2-5 MB)
- Brugeren kan vælge at downloade kort-tiles per region

### Sync-manager

Offline-handlinger (foto-upload, rute-sync) gemmes i en SQLite-kø:

- **Kø-persistens:** Handlinger overlever app-restart
- **Retry:** Exponential backoff (1s → 2s → 4s → max 60s), maks 10 forsøg
- **Konfliktløsning:** Last-write-wins — shelter-data fra serveren overskriver altid lokalt cache. Brugerens egne data (fotos, ruter) er append-only og har ingen konflikter.
- **Kø-grænse:** Max 50 ventende uploads. Ved grænsen vises besked: "Slet ventende uploads eller vent på forbindelse"
- **Bruger-feedback:** Badge på Profil-tab viser antal ventende syncs

---

## 6. Navigation og skærm-struktur

**Tab-baseret navigation (5 tabs):**

| Tab | Indhold |
|---|---|
| **Kort** | Fuldt kort med shelters, filter-chips, download-knap, min position |
| **Udforsk** | Shelter-liste, søg, regioner, facility-filtre |
| **Ruter** | Curated ruter, mine ture (trackede), start tracking |
| **Guides** | Guides + blog-artikler |
| **Profil** | Downloadede områder, mine fotos, indstillinger |

**Skærme udover tabs:**
- `shelter/[slug]` — shelter-detalje med billeder, kort, faciliteter, booking-link
- `rute/[slug]` — rute-detalje med kort og etaper
- `område/[slug]` — områdeside med shelters i regionen
- `tracking` — aktiv rute-tracking (fullscreen kort)

**Navigation:**
- Stack-navigation inden for hver tab (push/pop)
- Swipe-back gesture
- Smooth native transitions

---

## 7. Teknisk arkitektur

```
┌──────────────┐     ┌──────────────┐
│   Next.js    │     │  Expo App    │
│   (web)      │     │  (Android)   │
└──────┬───────┘     └──────┬───────┘
       │                    │
       └────────┬───────────┘
                │
         ┌──────┴──────┐
         │   shared/   │
         └──────┬──────┘
                │
         ┌──────┴──────┐
         │  Supabase   │
         └──────┬──────┘
                │
         ┌──────┴──────┐
         │   Mapbox    │
         └─────────────┘
```

**Teknologi-oversigt:**

| Funktion | Bibliotek |
|---|---|
| Framework | Expo SDK 52 + Expo Router |
| Kort | `@rnmapbox/maps` (Mapbox GL Native) |
| GPS | `expo-location` (forgrund + baggrund) |
| Kamera | `expo-camera` + `expo-image-picker` |
| Billede-komprimering | `expo-image-manipulator` |
| Lokal DB | `expo-sqlite` |
| Backend | Supabase JS client (samme som web) |
| Billede-upload | Supabase Storage direkte |
| Offline-kø | Custom sync-manager med `expo-sqlite` |
| State management | Zustand (med persist middleware til AsyncStorage) |
| Crash reporting | Sentry (`@sentry/react-native`) |

### Identitet uden authentication

V1 har ingen bruger-login. I stedet:
- Et device UUID genereres ved første app-start og gemmes i AsyncStorage
- UUID'et bruges som ejer-reference for "mine ture" og "mine fotos"
- Supabase-kald bruger anon key med passende RLS policies
- Foto-uploads og rute-syncs inkluderer device UUID i metadata
- Brugeren ser kun sine egne data lokalt (SQLite filtrerer på UUID)

### State management

- **Zustand** til app-wide state: aktiv tracking-session, download-progress, sync-kø status, filter-valg
- **Zustand persist middleware** med AsyncStorage til state der skal overleve app-restart
- **React Query / TanStack Query** til server-state: shelter-data, ruter, guides (med SQLite som cache layer)

### Google Place Photos

Appen bruger websidens eksisterende proxy endpoint: `https://shelterdk.dk/api/google-photo?ref=...`. Dette kræver ingen ny backend-kode og holder Google API-nøglen server-side.

---

## 8. Hvad genbruges fra websiden

| Genbruges direkte (shared/) | Skrives om til React Native |
|---|---|
| Supabase queries (shelter, area, route) | Alle UI-komponenter (View/Text vs div/p) |
| TypeScript typer og interfaces | Kort (Mapbox i stedet for Leaflet) |
| Slug-utilities, konstanter | Navigation (Expo Router vs Next.js) |
| Filtreringslogik | Styling (StyleSheet vs Tailwind) |
| Area/preposition-logik | Billede-håndtering |
| GPX parser/export | |
| Haversine afstandsberegning | |
| Blog/guide data-strukturer | |

---

## 9. Android permissions

| Permission | Bruges til | Hvis afvist |
|---|---|---|
| `ACCESS_FINE_LOCATION` | Vis position på kort, nærhed-alerts | Kort virker uden position, "shelter nær mig" disabled |
| `ACCESS_BACKGROUND_LOCATION` | Rute-tracking mens appen er minimeret | Tracking virker kun med appen åben i forgrunden |
| `CAMERA` | Tag fotos af shelters | Kun galleri-valg tilgængeligt |
| `READ_MEDIA_IMAGES` | Vælg foto fra galleri | Foto-upload disabled |
| `INTERNET` | Alt netværk | Auto-granted |
| `FOREGROUND_SERVICE_LOCATION` | Baggrunds-GPS notification | Kræves for baggrunds-tracking |

Alle permissions anmodes "just-in-time" — først når brugeren forsøger en handling der kræver det, med en forklaring af hvorfor.

---

## 10. Fejlhåndtering og crash reporting

- **Sentry** (`@sentry/react-native`) til crash reporting og performance monitoring
- **Error boundaries** i React Native: per-tab error boundary der viser "Noget gik galt" med retry-knap
- **Netværksfejl:** Automatisk retry med backoff. Skelner mellem "offline" (vis cached data) og "server-fejl" (vis fejlbesked med retry)
- **Kort-fejl:** Fallback til cached tiles, eller besked "Download kort for dette område" hvis ingen cache

---

## 11. Build og deployment

- **EAS Build** (Expo Application Services) til cloud builds — genererer signeret AAB/APK
- **Signing key:** Genereres via EAS og opbevares i Expo's cloud (eller lokalt med `eas credentials`)
- **Distribution under udvikling:** Internal testing track i Play Console, eller direkte APK via EAS
- **Play Store krav:** App-ikon (512x512), feature graphic (1024x500), min. 4 screenshots, privacy policy (eksisterer allerede på shelterdk.dk/privacy), aldersrating
- **OTA updates:** `expo-updates` til JavaScript-opdateringer uden ny Play Store build

---

## 12. Deep linking

Expo Router understøtter Android App Links:
- `shelterdk.dk/shelter/[slug]` → åbner shelter-detalje i appen
- `shelterdk.dk/danmark/[region]` → åbner områdeside i appen
- Kræver `.well-known/assetlinks.json` på websiden for verifikation
- Brugere uden appen sendes til websiden som normalt

---

## 13. Testing

- **Shared logic:** Vitest (eksisterer allerede i projektet) til unit tests af shared/ koden
- **App-specifikke tests:** Jest + React Native Testing Library for komponent-tests
- **E2E:** Manual testing checklist for GPS, offline, kamera (svært at automatisere pålideligt)
- **GPS-testing:** Expo Go understøtter mock locations på Android emulator

---

## 14. Ikke i scope (v1)

- iOS-version (kan tilføjes senere — Expo understøtter begge platforme)
- Admin-funktioner (forbliver web-only)
- Bruger-authentication / login (device UUID i stedet)
- Push-notifikationer (v2)
- Turvenner (v2 — kræver mere kompleks backend)
- Play Store ASO/marketing
