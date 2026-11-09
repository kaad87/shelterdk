// Genererer data/shelter-duplicate-redirects.json: 308-redirects fra
// dublet-shelters' silo-URL til det kanoniske shelters silo-URL.
//
// HVORFOR EN GENERERET LISTE OG IKKE ET redirect() I SIDEN:
// shelter-detaljeruten er statisk (●). Et permanentRedirect() fra en
// static-/ISR-render kan Next 14 ikke sende som 308 — der er ingen response at
// sætte status på, så den skriver i stedet en HTML-fil med
// <meta http-equiv="refresh">, som udleveres med status 200 og kun layoutet.
// Målt på netop disse URL'er: 200 + meta-refresh, både fra page.tsx, fra et
// layout.tsx og fra generateMetadata. En browser følger refreshen, så det ser
// rigtigt ud manuelt; Google ser en 200 uden indhold = soft-404.
// next.config.js-redirects rammer FØR routing og giver en rigtig 308. Det er
// samme løsning som de 17 kommunesider (commit ab19c61).
//
// Kør efter dedupe_shelters_by_google_place.py, og commit JSON'en:
//   node scripts/generate-shelter-duplicate-redirects.mjs
//
// Bliver listen bagud, er konsekvensen et ærligt 404 på den dublet-URL der
// mangler — ikke en soft-404. Siden selv svarer 404 for alt den ikke kender.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const WEB_ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(WEB_ROOT, "data", "shelter-duplicate-redirects.json");

function readEnvLocal() {
  const raw = readFileSync(path.join(WEB_ROOT, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

/** Samme transliteration som slugifySegment i shared/lib/slug.ts (ø→oe, å→aa). */
function slugifySegment(name) {
  return (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// next.config.js kanoniserer region-slugs FØR disse regler rammer:
//   /danmark/fyn-og-oeerne/:rest*  → /danmark/fyn/:rest*
//   /danmark/sjaelland/:kommune/:rest* → /danmark/sjaelland-og-oeerne/:kommune/:rest*
// Shelter-undersider bor derfor på det LANGE sjælland-slug og det KORTE fyn-slug.
// `from` skal skrives i den form requestet reelt har, når det rammer vores regel.
const REGION_SLUG_AFTER_CANONICALIZATION = {
  sjaelland: "sjaelland-og-oeerne",
  "fyn-og-oeerne": "fyn",
};

function siloPath(region, kommune, slug) {
  const raw = slugifySegment(region);
  const regionSlug = REGION_SLUG_AFTER_CANONICALIZATION[raw] ?? raw;
  const kommuneSlug = kommune && kommune.trim() ? slugifySegment(kommune) : "ukendt-kommune";
  return `/danmark/${regionSlug}/${kommuneSlug}/${slug}`;
}

/**
 * PostgREST udleverer HØJST 1000 rækker pr. request, uanset ?limit=. Uden
 * paginering manglede 60 af 130 dubletter deres kanoniske række og blev
 * sprunget over som "intet mål" — altså 60 URL'er der ville 404'e i stedet for
 * at 308'e. Hent derfor i sider med Range-headeren.
 */
async function rest(env, query) {
  const PAGE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${query}`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Range: `${from}-${from + PAGE - 1}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
  }
}

const env = readEnvLocal();

const duplicates = await rest(
  env,
  "shelters?select=id,slug,region,kommune,duplicate_of_shelter_id" +
    "&duplicate_of_shelter_id=not.is.null&region=not.is.null&slug=not.is.null&limit=2000"
);
const canonicals = await rest(
  env,
  "shelters?select=id,slug,region,kommune&duplicate_of_shelter_id=is.null" +
    "&region=not.is.null&slug=not.is.null&limit=5000"
);
const byId = new Map(canonicals.map((row) => [row.id, row]));

const entries = [];
const skipped = [];
for (const dup of duplicates) {
  const canonical = byId.get(dup.duplicate_of_shelter_id);
  if (!canonical) {
    // Dublet uden kanonisk række (eller kanonisk uden region/slug): siden
    // svarer 404 for den — ærligt, og bedre end et redirect-loop.
    skipped.push(dup.slug);
    continue;
  }
  const from = siloPath(dup.region, dup.kommune, dup.slug);
  const to = siloPath(canonical.region, canonical.kommune, canonical.slug);
  if (from === to) {
    skipped.push(dup.slug);
    continue;
  }
  entries.push({ slug: dup.slug, canonicalSlug: canonical.slug, from, to });
}

// Stabil rækkefølge, så JSON'en ikke støjer i diffs.
entries.sort((a, b) => a.from.localeCompare(b.from, "da"));

// En kæde (A→B hvor B selv redirecter) ville koste et ekstra hop; der må ikke
// være nogen, da `to` altid er en ikke-dublet.
const froms = new Set(entries.map((e) => e.from));
const chained = entries.filter((e) => froms.has(e.to));
if (chained.length > 0) {
  throw new Error(`Kædede redirects: ${chained.map((e) => e.from).join(", ")}`);
}

writeFileSync(OUT, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
console.log(`${entries.length} redirects skrevet til data/shelter-duplicate-redirects.json`);
if (skipped.length > 0) {
  console.log(`${skipped.length} dubletter sprunget over (intet kanonisk mål): ${skipped.join(", ")}`);
}
