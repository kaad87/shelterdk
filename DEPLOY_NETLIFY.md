# Deploy ShelterDK til Netlify

Guide til at få web-appen (i `web/`) live på Netlify med eget domæne.

## Forudsætninger

- GitHub-repo med ShelterDK-koden
- Netlify-konto (gratis på [netlify.com](https://netlify.com))
- Supabase-projekt med `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Trin 1: Opret Netlify-site fra GitHub

1. Gå til [app.netlify.com](https://app.netlify.com)
2. Klik **Add new site** → **Import an existing project**
3. Vælg **GitHub** og godkend adgang til dit shelterdk-repo
4. Vælg repoet (fx `dit-brugernavn/shelterdk`)

---

## Trin 2: Build-indstillinger

Netlify finder typisk selv Next.js, men sæt disse værdier manuelt:

| Indstilling        | Værdi                    |
|--------------------|--------------------------|
| **Base directory** | `web`                    |
| **Build command**  | `npm run build`          |
| **Publish directory** | `web/.next`          |

Hvis Netlify ikke accepterer `web/.next` som publish directory, lad feltet være tomt – Next.js-pluginnet håndterer det.

---

## Trin 3: Environment variables

Før deploy: **Site settings** → **Environment variables** → **Add a variable** (eller **Add from .env**):

| Variabel                     | Værdi                          | Beskrivelse          |
|-----------------------------|--------------------------------|----------------------|
| `NEXT_PUBLIC_SUPABASE_URL`  | Din Supabase-projekt-URL       | Fx `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Din Supabase anon key     | Fra Supabase Dashboard → Settings → API |
| `GA4_MEASUREMENT_ID`        | (valgfri) G-XXXXXXXXXX         | Til server-side page_view for "Kun nødvendige" |
| `GA4_API_SECRET`            | (valgfri) API secret           | GA4 → Data streams → Measurement Protocol API secrets |

Gem ændringerne. Uden GA4-variablerne virker cookiebanneren stadig; du får bare ikke server-side statistik for dem, der vælger kun nødvendige.

---

## Trin 4: netlify.toml

`web/netlify.toml` findes allerede og konfigurerer Next.js-plugin osv.

I Netlify UI (Build settings):
- **Base directory:** `web`
- **Package directory:** `web` (eller `web/`) – Netlify finder netlify.toml her
- **Build command:** `npm run build` eller tom (bruger netlify.toml)
- **Publish directory:** Prøv `.next` hvis feltet ikke kan tømmes – plugin håndterer output

---

## Trin 5: Deploy

1. Klik **Deploy site** (eller vent på automatisk deploy ved push til main)
2. Vent 2–5 minutter
3. Din side er live på fx `random-name-123.netlify.app`

---

## Trin 6: Eget domæne (www.shelterdk.dk)

1. **Netlify:** Site settings → **Domain management** → **Add custom domain**
2. Indtast `www.shelterdk.dk` (eller `shelterdk.dk`)
3. Netlify viser DNS-indstillinger
4. **DNS hos din udbyder** – tilføj/opdater:

   | Type | Navn  | Værdi                    |
   |------|-------|---------------------------|
   | CNAME | www  | `random-name-123.netlify.app` |

   Eller, hvis du bruger A-records:

   | Type | Navn | Værdi           |
   |------|------|------------------|
   | A    | @    | 75.2.60.5        |
   | CNAME | www | dit-site.netlify.app |

5. I Netlify: Klik **Verify DNS configuration** – det kan tage op til 48 timer, ofte hurtigere
6. Netlify kan sætte HTTPS op automatisk (Let's Encrypt)

---

## Fejlfinding

### Build fejler med "Could not find module"
- Tjek at **Base directory** er sat til `web`
- Tjek at `web/package.json` har alle dependencies

### 404 "Page not found" på forsiden
1. **Netlify → Project configuration → Build & deploy → Build settings**
2. Sæt **Base directory** til `web` (hvis ikke allerede)
3. Sørg for at `netlify.toml` er i repo-roden (indeholder `base = "web"` og `@netlify/plugin-nextjs`)
4. Push ændringer til GitHub – Netlify deployer automatisk
5. Eller: **Deploys** → **Trigger deploy** → **Clear cache and deploy site**
6. Tjek **Deploy log** – der må ikke være fejl under "Building" eller "Post processing"

### "Mangler Supabase-credentials"
- Tjek at `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_ANON_KEY` er sat i Netlify
- Tjek at variablerne er gemt og deploy er kørt igen efter ændring

### API-routes returnerer 404
- Next.js-pluginnet håndterer `/api/*` – tjek at `@netlify/plugin-nextjs` bruges
- Kør en ny deploy efter plugin-ændringer

### Chrome: net::ERR_SOCKET_CONNECT_ERROR (Safari virker)
- **Prøv uden www:** Åbn `https://shelterdk.dk` (ikke www) i Chrome. Virker det, er fejlen begrænset til `www.shelterdk.dk`.
- **Netlify Domain management:** Tjek at både `shelterdk.dk` og `www.shelterdk.dk` er tilføjet og at DNS er verificeret. Med Netlify DNS skal både apex og www pege på Netlify.
- **IPv6:** Chrome prøver nogle gange IPv6 først; hvis netværket har dårlig IPv6, kan forbindelsen fejle. Prøv fra et andet netværk eller på en anden enhed.
- **Redirect:** I `web/netlify.toml` er der en 301-redirect fra `https://www.shelterdk.dk` til `https://shelterdk.dk`, så kanonisk URL er uden www. Brug `https://shelterdk.dk` i links og bogmærker.
