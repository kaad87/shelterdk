#!/usr/bin/env node
/**
 * Genererer seo_title for shelters – titel med bynavn til lokal SEO.
 * Original title bevares i title-kolonnen; seo_title gemmes separat.
 *
 * Kræver: .env/.env.local med NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (eller ANON_KEY).
 *         Kolonnen seo_title (TEXT) skal findes – kør migration 026_add_seo_title.sql først.
 *
 * Kør: node scripts/generateSeoTitles.js
 *   --limit=N   max shelters per kørsel (standard 99999). --limit=0 = alle
 *   --dry-run   vis kun hvad der ville blive opdateret
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);

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
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getStr(raw, ...keys) {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function isValidCityName(value) {
  if (!value || typeof value !== "string") return false;
  const t = value.trim();
  return t.length > 0 && !/^\d+$/.test(t);
}

function kommuneToBy(value) {
  if (!value || typeof value !== "string") return value;
  const t = value.trim();
  const s = t.toLowerCase();
  if (s.endsWith(" regionskommune")) {
    const m = { "bornholms regionskommune": "Rønne", "københavns by": "København" };
    if (m[s]) return m[s];
    return t.replace(/\s+Regionskommune$/i, "").trim() || t;
  }
  if (s.endsWith(" kommune")) return t.replace(/\s+Kommune$/i, "").trim() || t;
  return t;
}

function getCity(shelter) {
  const place = shelter.place && typeof shelter.place === "string" ? shelter.place.trim() : null;
  if (isValidCityName(place)) return place;
  const kommune =
    shelter.kommune && typeof shelter.kommune === "string" ? shelter.kommune.trim() : null;
  if (isValidCityName(kommune)) return kommuneToBy(kommune);
  const raw = shelter.geofa_raw || {};
  const postnrBy = getStr(raw, "postnr_by");
  if (postnrBy) {
    const cleaned = postnrBy.replace(/^\s*\d+\s*[,-]?\s*/, "").trim();
    if (isValidCityName(cleaned)) return cleaned;
  }
  const belKommune = getStr(raw, "beliggenhedskommune");
  if (isValidCityName(belKommune)) return belKommune;
  return null;
}

function buildSeoTitle(shelter) {
  const name = (shelter.title || "").trim();
  const city = getCity(shelter);
  const region = (shelter.region ?? "").trim() || "Danmark";
  const by = city || (region !== "Danmark" ? region : null);
  const suffix = " | Shelterdk.dk";

  const isGenericOnly =
    !name ||
    /^shelter\s*$/i.test(name) ||
    /^shelterplads\s*$/i.test(name);

  if (isGenericOnly) {
    const raw = shelter.geofa_raw || {};
    const place = shelter.place && typeof shelter.place === "string" ? shelter.place.trim() : null;
    const vejnavn = getStr(raw, "vejnavn");
    if (by && place && place !== by) return `Shelter ved ${place} i ${by}${suffix}`;
    if (by && vejnavn && vejnavn.length > 2) return `Shelter ved ${vejnavn} i ${by}${suffix}`;
    if (by && region !== "Danmark") return `Shelter i ${by}, ${region}${suffix}`;
    if (by) return `Shelter i ${by}${suffix}`;
    return `Shelter - Overnatning i naturen${suffix}`;
  }

  if (!by) return name + suffix;

  const nameLower = name.toLowerCase();
  const byLower = by.toLowerCase();
  if (nameLower.includes(byLower)) return name + suffix;

  return `${name} i ${by}${suffix}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = 99999;
  let dryRun = false;
  for (const a of args) {
    if (a.startsWith("--limit=")) limit = Math.max(0, parseInt(a.slice(8), 10));
    if (a === "--dry-run") dryRun = true;
  }
  if (limit === 0) limit = 99999;
  return { limit, dryRun };
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Mangler NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY i .env");
    process.exit(1);
  }

  const { limit, dryRun } = parseArgs();

  let createClient;
  try {
    createClient = require("@supabase/supabase-js").createClient;
  } catch {
    createClient = require(path.join(ROOT, "web", "node_modules", "@supabase", "supabase-js"))
      .createClient;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: shelters, error } = await supabase
    .from("shelters")
    .select("id, title, region, kommune, place, geofa_raw")
    .is("duplicate_of_shelter_id", null)
    .is("seo_title", null)
    .limit(limit);

  if (error) {
    if (error.code === "42703") {
      console.error(
        "Fejl: Kolonnen 'seo_title' findes ikke. Kør migration 026_add_seo_title.sql i Supabase."
      );
    } else {
      console.error("Supabase fejl:", error);
    }
    process.exit(1);
  }

  if (!shelters?.length) {
    console.log("Ingen shelters fundet uden seo_title. Alle er opdateret.");
    return;
  }

  console.log(`Fundet ${shelters.length} shelters uden seo_title. Genererer...${dryRun ? " (dry-run)" : ""}`);

  let ok = 0;
  let err = 0;

  for (let i = 0; i < shelters.length; i++) {
    const s = shelters[i];
    const seoTitle = buildSeoTitle(s);
    if (!dryRun) {
      const { error: upErr } = await supabase
        .from("shelters")
        .update({ seo_title: seoTitle })
        .eq("id", s.id);
      if (upErr) {
        console.error(`[${i + 1}/${shelters.length}] ${s.title}:`, upErr.message);
        err++;
        continue;
      }
    }
    ok++;
    if ((i + 1) % 100 === 0 || i === shelters.length - 1) {
      console.log(`[${i + 1}/${shelters.length}] ${s.title} → ${seoTitle.slice(0, 50)}...`);
    }
  }

  console.log(`\nFærdig. Opdateret: ${ok}, fejl: ${err}${dryRun ? " (dry-run – ingen ændringer)" : ""}`);
  if (!dryRun && ok > 0 && shelters.length >= limit) {
    console.log("Kør scriptet igen for at behandle resten.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
