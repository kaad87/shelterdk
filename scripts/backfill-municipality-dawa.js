#!/usr/bin/env node
/**
 * Udfyld shelters.municipality og shelters.area_slug fra DAWA reverse geocoding.
 *
 * Henter alle shelters hvor municipality er null, kalder DAWA kommuner/reverse
 * med (x=longitude, y=latitude), og opdaterer rækken med kommunenavn + area_slug.
 *
 * Kræver: .env med NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY
 *          (eller NEXT_PUBLIC_SUPABASE_ANON_KEY hvis RLS tillader update).
 *
 * Kør: npm run backfill:municipality
 *   --dry-run     vis kun hvad der ville blive opdateret
 *   --alle        fuld genkørsel: alle shelters med location (ikke kun dem uden municipality)
 *   --delay=300   ms mellem hvert DAWA-kald (standard 300)
 */

const fs = require("fs");
const path = require("path");

// Kør altid fra shelter-roden (projektmappen)
const SHELTER_ROOT = path.join(__dirname, "..");
process.chdir(SHELTER_ROOT);

// Load .env
function loadEnv() {
  const dirs = [process.cwd(), path.join(process.cwd(), "web"), path.dirname(__dirname)];
  for (const dir of dirs) {
    for (const name of [".env.local", ".env"]) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf8");
        for (const line of content.split("\n")) {
          const t = line.trim();
          if (t && !t.startsWith("#") && t.includes("=")) {
            const eq = t.indexOf("=");
            const key = t.slice(0, eq).trim();
            const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
            if (!process.env[key]) process.env[key] = val;
          }
        }
        return;
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const DAWA_BASE = "https://api.dataforsyningen.dk/kommuner/reverse";
const DEFAULT_DELAY_MS = 300;

/** Parse POINT(lon lat) → { lon, lat } or null */
function parseLocation(location) {
  if (!location || typeof location !== "string") return null;
  const m = location.match(/POINT\s*\(\s*([\d.eE+-]+)\s+([\d.eE+-]+)\s*\)/i);
  if (!m) return null;
  const lon = parseFloat(m[1]);
  const lat = parseFloat(m[2]);
  if (Number.isFinite(lon) && Number.isFinite(lat)) return { lon, lat };
  return null;
}

/**
 * Map kommunenavn til SEO area_slug (matcher public.areas.slug fra migration 023).
 * Specifikke områder tjekkes først; resten får generisk slug fra kommunenavn.
 */
function municipalityToAreaSlug(municipality) {
  if (!municipality || typeof municipality !== "string") return null;
  const name = municipality.trim();
  const lower = name.toLowerCase();

  // Normaliser til "x kommune" / "x regionskommune" for lookup
  const key = lower.endsWith(" kommune") || lower.endsWith(" regionskommune") || lower.endsWith(" by")
    ? lower
    : lower + " kommune";

  // Jylland – Søhøjlandet
  if (["silkeborg kommune", "skanderborg kommune"].includes(key)) return "soehojlandet";

  // Jylland – Nationalpark Thy
  if (key === "thisted kommune") return "nationalpark-thy";

  // Jylland – Rold Skov og Rebild Bakker
  if (["rebild kommune", "mariagerfjord kommune", "aalborg kommune"].includes(key)) return "rold-skov-rebild";

  // Jylland – Limfjorden (kommuner rundt om fjorden)
  const limfjordenKommuner = [
    "viborg kommune", "struer kommune", "lemvig kommune", "skive kommune", "morsø kommune",
    "jammerbugt kommune", "brønderslev kommune", "hjørring kommune", "randers kommune",
    "norddjurs kommune", "favrskov kommune", "samsø kommune",
  ];
  if (limfjordenKommuner.some((k) => key === k)) return "limfjorden";

  // Jylland – Vadehavet
  if (["tønder kommune", "esbjerg kommune", "varde kommune", "ribe kommune"].includes(key)) return "vadehavet";

  // Jylland – Hærvejen (rute-kommuner som ikke allerede har andet område)
  const haervejenKommuner = [
    "haderslev kommune", "kolding kommune", "vejle kommune", "horsens kommune", "hedensted kommune",
    "ringkøbing-skjern kommune", "holstebro kommune", "herning kommune", "ikast-brande kommune",
  ];
  if (haervejenKommuner.some((k) => key === k)) return "haervejen";

  // Fyn og Øerne – Det Sydfynske Øhav
  if (["langeland kommune", "ærø kommune", "svendborg kommune", "faaborg-midtfyn kommune", "nyborg kommune", "assens kommune"].includes(key)) return "sydfynske-oeehav";

  // Fyn og Øerne – Hindsholm og Nordfyn
  if (["nordfyns kommune", "kerteminde kommune", "odense kommune"].includes(key)) return "hindsholm-nordfyn";

  // Sjælland – Lolland (egen landingsside)
  if (["lolland kommune", "guldborgsund kommune"].includes(key)) return "lolland";

  // Sjælland – Sydsjælland og Møn (Møns Klint, Camønoen)
  if (["vordingborg kommune", "faxe kommune", "stevns kommune"].includes(key)) return "sydsjaelland-moen";

  // Sjælland – Odsherred
  if (key === "odsherred kommune") return "odsherred";

  // Sjælland – Kongernes Nordsjælland
  const kongernesNordsjaelland = [
    "gribskov kommune", "hillerød kommune", "helsingør kommune", "fredensborg kommune",
    "hörsholm kommune", "rudersdal kommune", "lyngby-taarbæk kommune", "gentofte kommune",
    "gladsaxe kommune", "furesø kommune", "allerød kommune", "egedal kommune", "frederikssund kommune",
  ];
  if (kongernesNordsjaelland.some((k) => key === k)) return "kongernes-nordsjaelland";

  // Sjælland – Skjoldungernes Land (Roskilde Fjord)
  if (["roskilde kommune", "lejre kommune"].includes(key)) return "skjoldungernes-land";

  // Øer / særlige
  if (key === "bornholms regionskommune") return "bornholm";

  // Fallback: slug fra kommunenavn (til kommuner uden eget område i areas-tabellen)
  const slug = lower
    .replace(/\s+(kommune|regionskommune|by)$/i, "")
    .replace(/\s+/g, "-")
    .replace(/[æå]/g, "a")
    .replace(/ø/g, "o")
    .replace(/[^a-z0-9-]/g, "");
  return slug || null;
}

/** Ét DAWA-kald for (lon, lat). Returnerer { municipality } eller null. */
async function dawaReverseOne(lon, lat) {
  // DAWA eksempel bruger x=12.58 (lon), y=55.68 (lat) – altså x=lon, y=lat
  const url = `${DAWA_BASE}?x=${encodeURIComponent(lon)}&y=${encodeURIComponent(lat)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const item = Array.isArray(data) ? data[0] : data;
  if (!item || typeof item !== "object") return null;
  const navn = item.navn ?? item.nome ?? item.name;
  if (typeof navn === "string" && navn.trim()) return { municipality: navn.trim() };
  return null;
}

/** Hent kommune for (lon, lat). Ved 404 (punkt i vand) prøves forskydninger mod land. */
async function dawaReverse(lon, lat) {
  let r = await dawaReverseOne(lon, lat);
  if (r) return r;
  // Fallback: prøv 200 m og 500 m i fire retninger (havne ligger ofte lige ved land)
  for (const offset of [0.002, 0.005]) {
    for (const [dlat, dlon] of [[offset, 0], [-offset, 0], [0, offset], [0, -offset]]) {
      await sleep(150);
      r = await dawaReverseOne(lon + dlon, lat + dlat);
      if (r) return r;
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const alle = args.includes("--alle");
  const delayArg = args.find((a) => a.startsWith("--delay="));
  const delayMs = delayArg ? parseInt(delayArg.split("=")[1], 10) || DEFAULT_DELAY_MS : DEFAULT_DELAY_MS;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("FEJL: Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY/ANON_KEY i .env");
    process.exit(1);
  }

  let createClient;
  try {
    createClient = require("@supabase/supabase-js").createClient;
  } catch (e) {
    const webModules = path.join(__dirname, "..", "web", "node_modules");
    try {
      createClient = require(path.join(webModules, "@supabase", "supabase-js")).createClient;
    } catch (e2) {
      console.error("Supabase-pakken findes ikke. Kør fra repo-rod: node scripts/backfill-municipality-dawa.js");
      console.error("  eller fra web: cd web && npm run backfill:municipality");
      process.exit(1);
    }
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log(alle ? "Henter alle shelters med location (fuld genkørsel)..." : "Henter shelters uden municipality...");
  const rows = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabase.from("shelters").select("id, title, location").not("location", "is", null);
    if (!alle) query = query.is("municipality", null);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) {
      console.error("Supabase fejl:", error.message);
      process.exit(1);
    }
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  const withCoords = rows.filter((r) => parseLocation(r.location));
  console.log(`Fundet ${rows.length} shelters; ${withCoords.length} har gyldig location.`);
  if (withCoords.length === 0) {
    console.log("Intet at gøre.");
    return;
  }

  if (dryRun) {
    console.log("(--dry-run: ingen opdateringer)");
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < withCoords.length; i++) {
    const row = withCoords[i];
    const coords = parseLocation(row.location);
    if (!coords) continue;
    const { id, title } = row;
    process.stdout.write(`[${i + 1}/${withCoords.length}] ${(title || id).slice(0, 40)}... `);

    const result = await dawaReverse(coords.lon, coords.lat);
    await sleep(delayMs);

    if (!result) {
      console.log("ingen kommune");
      fail++;
      continue;
    }

    const areaSlug = municipalityToAreaSlug(result.municipality);
    if (!dryRun) {
      const { error } = await supabase
        .from("shelters")
        .update({
          municipality: result.municipality,
          area_slug: areaSlug,
        })
        .eq("id", id);
      if (error) {
        console.log("fejl:", error.message);
        fail++;
        continue;
      }
    }
    console.log(`${result.municipality} → ${areaSlug || "(ingen slug)"}`);
    ok++;
  }

  console.log(`\nFærdig: ${ok} opdateret, ${fail} uden kommune/fejl.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
