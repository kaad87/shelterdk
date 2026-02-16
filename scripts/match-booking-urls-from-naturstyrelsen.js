#!/usr/bin/env node
/**
 * Matcher shelters i DB mod naturstyrelsen_scraped.json og foreslår/opdaterer booking_url.
 * Bruger slug-match: DB slug uden trailing -12345 sammenlignes med sti fra book.naturstyrelsen.dk/sted/{slug}/.
 *
 * Kræver: .env med NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY (eller ANON_KEY).
 *
 * Kør: node scripts/match-booking-urls-from-naturstyrelsen.js
 *   --dry-run   vis kun hvad der ville blive opdateret (standard)
 *   --apply     opdater booking_url i DB for matchende shelters
 *   --only-empty   match kun shelters hvor booking_url er null/tom (lad eksisterende stå)
 */

const fs = require("fs");
const path = require("path");

const SHELTER_ROOT = path.join(__dirname, "..");
process.chdir(SHELTER_ROOT);

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

const SCRAPED_PATH = path.join(SHELTER_ROOT, "naturstyrelsen_scraped.json");

/** Hent slug fra book.naturstyrelsen.dk/sted/XYZ/ -> XYZ */
function slugFromBookingUrl(url) {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  const base = "https://book.naturstyrelsen.dk/sted/";
  if (!u.toLowerCase().startsWith(base)) return null;
  const rest = u.slice(base.length).replace(/\/+$/, "").trim();
  if (!rest) return null;
  return rest.toLowerCase();
}

/** DB slug uden trailing -12345 -> kan matche Naturstyrelsens sti */
function baseSlugFromDb(slug) {
  if (!slug || typeof slug !== "string") return null;
  return slug.replace(/-[0-9]+$/, "").trim().toLowerCase() || null;
}

/** Byg map: scraped slug -> booking_url fra naturstyrelsen_scraped.json */
function loadScrapedIndex() {
  if (!fs.existsSync(SCRAPED_PATH)) {
    console.error("Mangler", SCRAPED_PATH);
    process.exit(1);
  }
  const raw = fs.readFileSync(SCRAPED_PATH, "utf8");
  const features = JSON.parse(raw);
  const index = new Map();
  for (const f of features) {
    const props = f.properties || {};
    const url = (props.booking_url || props.source_url || "").trim();
    const slug = slugFromBookingUrl(url);
    if (slug) index.set(slug, url);
  }
  return index;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let apply = false;
  let onlyEmpty = false;
  for (const a of args) {
    if (a === "--apply") apply = true;
    else if (a === "--only-empty") onlyEmpty = true;
  }
  return { apply, onlyEmpty };
}

async function main() {
  const { apply, onlyEmpty } = parseArgs();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env");
    process.exit(1);
  }

  const scrapedIndex = loadScrapedIndex();
  console.log(`Indlæst ${scrapedIndex.size} Naturstyrelsen-steder fra ${path.basename(SCRAPED_PATH)}\n`);

  let createClient;
  try {
    createClient = require("@supabase/supabase-js").createClient;
  } catch (e) {
    try {
      createClient = require(path.join(__dirname, "..", "web", "node_modules", "@supabase", "supabase-js")).createClient;
    } catch (e2) {
      console.error("Supabase-pakken findes ikke. Kør fra repo-rod.");
      process.exit(1);
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const pageSize = 1000;
  const shelters = [];
  let offset = 0;
  while (true) {
    const { data: rows, error } = await supabase
      .from("shelters")
      .select("id, title, slug, booking_url")
      .not("slug", "is", null)
      .neq("slug", "")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error("Supabase fejl:", error.message);
      process.exit(1);
    }
    shelters.push(...(rows || []));
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`Hentet ${shelters.length} shelters fra DB.\n`);

  const toUpdate = [];
  for (const s of shelters) {
    const base = baseSlugFromDb(s.slug);
    if (!base) continue;
    const scrapedUrl = scrapedIndex.get(base);
    if (!scrapedUrl) continue;
    const current = (s.booking_url || "").trim();
    if (onlyEmpty && current) continue;
    if (current === scrapedUrl) continue;
    toUpdate.push({
      id: s.id,
      title: s.title,
      slug: s.slug,
      current: current || "(tom)",
      booking_url: scrapedUrl,
    });
  }

  if (toUpdate.length === 0) {
    console.log("Ingen shelters matchede med scraped data (eller alle har allerede korrekt URL).");
    return;
  }

  console.log(`Fundet ${toUpdate.length} shelter(s) der kan få opdateret booking_url:\n`);
  toUpdate.forEach((u) => {
    console.log(`  ${u.slug}`);
    console.log(`    Nuværende: ${u.current}`);
    console.log(`    Ny:       ${u.booking_url}`);
  });

  if (!apply) {
    console.log("\n(--dry-run) Kør med --apply for at opdatere DB. Evt. --only-empty for kun dem uden booking_url.");
    return;
  }

  console.log("\nOpdaterer DB...");
  let ok = 0;
  for (const u of toUpdate) {
    const { error } = await supabase.from("shelters").update({ booking_url: u.booking_url }).eq("id", u.id);
    if (error) console.error(`  Fejl ${u.slug}: ${error.message}`);
    else ok++;
  }
  console.log(`Opdateret: ${ok} shelter(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
