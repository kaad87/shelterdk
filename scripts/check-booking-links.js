#!/usr/bin/env node
/**
 * Tjekker om booking_url på shelters returnerer 404.
 * Rapporterer shelters med defekte links så de kan rettes i databasen.
 *
 * Kræver: .env med NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY (eller ANON_KEY).
 *
 * Kør: node scripts/check-booking-links.js
 *   --delay=200   ms mellem hvert HTTP-kald (standard 200)
 *   --limit=50   max antal URLs at tjekke (standard alle)
 *   --json       udskriv kun 404-listen som JSON (én linje per shelter)
 *   --fix        sæt booking_url = null for defekte links (efter tjek)
 *   --dry-run    ved --fix: vis kun hvad der ville blive opdateret, uden at skrive til DB
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

const DEFAULT_DELAY_MS = 200;

function parseArgs() {
  const args = process.argv.slice(2);
  let delayMs = DEFAULT_DELAY_MS;
  let limit = null;
  let jsonOnly = false;
  let fix = false;
  let dryRun = false;
  for (const a of args) {
    if (a.startsWith("--delay=")) delayMs = Math.max(0, parseInt(a.slice(8), 10)) || DEFAULT_DELAY_MS;
    else if (a.startsWith("--limit=")) limit = Math.max(1, parseInt(a.slice(8), 10));
    else if (a === "--json") jsonOnly = true;
    else if (a === "--fix") fix = true;
    else if (a === "--dry-run") dryRun = true;
  }
  return { delayMs, limit, jsonOnly, fix, dryRun };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * HEAD request med redirect-follow. Returnerer { status, ok } eller { error }.
 */
async function checkUrl(url) {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return { error: "Invalid URL" };
  }
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "ShelterDK-booking-check/1.0" },
    });
    return { status: res.status, ok: res.ok };
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

async function main() {
  const { delayMs, limit, jsonOnly, fix, dryRun } = parseArgs();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env");
    process.exit(1);
  }

  let createClient;
  try {
    createClient = require("@supabase/supabase-js").createClient;
  } catch (e) {
    try {
      createClient = require(path.join(__dirname, "..", "web", "node_modules", "@supabase", "supabase-js")).createClient;
    } catch (e2) {
      console.error("Supabase-pakken findes ikke. Kør fra repo-rod: npm install (i web/) og node scripts/check-booking-links.js");
      process.exit(1);
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const pageSize = 1000;
  const list = [];
  let offset = 0;

  if (!jsonOnly) console.log("Henter samtlige shelters med booking_url (paginering)...");

  while (true) {
    const toFetch = limit != null ? Math.min(pageSize, limit - list.length) : pageSize;
    const { data: rows, error } = await supabase
      .from("shelters")
      .select("id, title, slug, booking_url")
      .not("booking_url", "is", null)
      .neq("booking_url", "")
      .order("id", { ascending: true })
      .range(offset, offset + toFetch - 1);
    if (error) {
      console.error("Supabase fejl:", error.message);
      process.exit(1);
    }
    const chunk = (rows || []).filter((r) => (r.booking_url || "").trim().startsWith("http"));
    list.push(...chunk);
    if (rows.length < toFetch || (limit != null && list.length >= limit)) break;
    offset += toFetch;
  }

  if (!jsonOnly && list.length > 0) console.log(`Fundet ${list.length} shelters med booking_url.\n`);

  if (list.length === 0) {
    if (!jsonOnly) console.log("Ingen shelters med booking_url fundet.");
    return;
  }

  if (!jsonOnly) {
    console.log(`Tjekker ${list.length} booking-URL(s) (delay ${delayMs} ms)...\n`);
  }

  const failed = [];
  let ok = 0;

  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const url = (row.booking_url || "").trim();
    if (!jsonOnly) process.stdout.write(`[${i + 1}/${list.length}] ${(row.title || row.id).slice(0, 45)}... `);

    const result = await checkUrl(url);
    await sleep(delayMs);

    if (result.error) {
      if (!jsonOnly) console.log(`Fejl: ${result.error}`);
      failed.push({
        id: row.id,
        title: row.title,
        slug: row.slug,
        booking_url: url,
        reason: result.error,
      });
      continue;
    }

    if (result.status === 404 || !result.ok) {
      if (!jsonOnly) console.log(`${result.status} (defekt)`);
      failed.push({
        id: row.id,
        title: row.title,
        slug: row.slug,
        booking_url: url,
        status: result.status,
      });
    } else {
      if (!jsonOnly) console.log(`${result.status} OK`);
      ok++;
    }
  }

  if (jsonOnly) {
    failed.forEach((f) => console.log(JSON.stringify(f)));
    return;
  }

  console.log(`\n--- Resultat ---`);
  console.log(`OK: ${ok}`);
  console.log(`Defekte/404: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\nShelters med defekt booking_url (kan rettes i DB eller fjernes):");
    failed.forEach((f) => {
      console.log(`  ${f.slug || f.id}  ${f.booking_url}  ${f.status || f.reason}`);
    });
  }

  if (fix && failed.length > 0) {
    if (dryRun) {
      console.log(`\n(--dry-run) Ville sætte booking_url = null for ${failed.length} shelter(s). Kør uden --dry-run for at opdatere.`);
      return;
    }
    console.log(`\nSætter booking_url = null for ${failed.length} shelter(s)...`);
    let updated = 0;
    for (const f of failed) {
      const { error } = await supabase.from("shelters").update({ booking_url: null }).eq("id", f.id);
      if (error) {
        console.error(`  Fejl for ${f.slug || f.id}: ${error.message}`);
      } else {
        updated++;
      }
      await sleep(50);
    }
    console.log(`Opdateret: ${updated} shelter(s). De viser nu generisk booking-tekst i stedet for link.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
