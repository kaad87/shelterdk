#!/usr/bin/env node
/**
 * Overblik over fejlede billeder på tværs af shelters.
 * Tæller hvor mange URL'er der fejler, og lister shelters hvor primært billede (image_url) fejler.
 *
 * Kør: node scripts/image-report.js [--limit=500] [--csv]
 *   --limit=N   Max antal shelters at tjekke (default: alle med image_url)
 *   --csv       Udskriv kun CSV med slug,title,primary_ok,any_fail
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);

function loadEnv() {
  const dirs = [process.cwd(), path.join(process.cwd(), "web")];
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

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 10000;
const csvOnly = args.includes("--csv");

function getHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "?";
  }
}

function isGoogleHost(url) {
  return getHost(url).includes("googleusercontent.com");
}

function headCheck(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === "https:" ? https : http;
      const req = lib.request(
        url,
        { method: "HEAD", timeout: 8000 },
        (res) => {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
        }
      );
      req.on("error", (err) => resolve({ ok: false, status: err.message }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, status: "timeout" });
      });
      req.end();
    } catch (e) {
      resolve({ ok: false, status: "invalid URL" });
    }
  });
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Mangler NEXT_PUBLIC_SUPABASE_URL og SUPABASE key i .env / web/.env.local");
    process.exit(1);
  }

  let createClient;
  try {
    createClient = require("@supabase/supabase-js").createClient;
  } catch {
    createClient = require(path.join(ROOT, "web", "node_modules", "@supabase", "supabase-js"))
      .createClient;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let query = supabase
    .from("shelters")
    .select("id, title, slug, image_url, image_urls")
    .is("duplicate_of_shelter_id", null)
    .not("image_url", "is", null)
    .neq("image_url", "")
    .order("id")
    .limit(limit);

  const { data: shelters, error } = await query;

  if (error) {
    console.error("Supabase fejl:", error);
    process.exit(1);
  }
  if (!shelters?.length) {
    console.log("Ingen shelters med image_url fundet.");
    return;
  }

  if (!csvOnly) {
    console.log(`Tjekker ${shelters.length} shelter(s) (max ${limit})...\n`);
  }

  const stats = {
    sheltersTotal: shelters.length,
    sheltersPrimaryFail: 0,
    sheltersAnyFail: 0,
    urls: { google: { ok: 0, fail: 0 }, other: { ok: 0, fail: 0 } },
  };
  const primaryFailed = [];
  const allFailedByShelter = new Map();

  for (let i = 0; i < shelters.length; i++) {
    const s = shelters[i];
    const urls = [s.image_url, ...(s.image_urls || [])].filter(Boolean);
    let primaryOk = true;
    let anyFail = false;

    for (let j = 0; j < urls.length; j++) {
      const url = urls[j];
      if (!url || typeof url !== "string") continue;
      if (!url.startsWith("http")) continue;

      const { ok, status } = await headCheck(url);
      const google = isGoogleHost(url);
      const key = google ? "google" : "other";
      if (ok) stats.urls[key].ok++;
      else {
        stats.urls[key].fail++;
        anyFail = true;
        if (j === 0) primaryOk = false;
        if (!allFailedByShelter.has(s.slug)) {
          allFailedByShelter.set(s.slug, []);
        }
        allFailedByShelter.get(s.slug).push({ url: url.slice(0, 60) + "…", status });
      }
    }

    if (!primaryOk) {
      stats.sheltersPrimaryFail++;
      primaryFailed.push({ slug: s.slug, title: s.title });
    }
    if (anyFail) stats.sheltersAnyFail++;
  }

  if (csvOnly) {
    console.log("slug,title,primary_ok,any_fail");
    for (const s of shelters) {
      const primaryFail = primaryFailed.some((p) => p.slug === s.slug);
      const anyFail = allFailedByShelter.has(s.slug);
      console.log(
        `${s.slug},"${(s.title || "").replace(/"/g, '""')}",${primaryFail ? "nej" : "ja"},${anyFail ? "ja" : "nej"}`
      );
    }
    return;
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log("  OVERSIGT: BILLEDER DER FEJLER");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("Shelters tjekket:        ", stats.sheltersTotal);
  console.log("Shelters hvor primært billede (image_url) fejler:", stats.sheltersPrimaryFail);
  console.log("Shelters med mindst ét fejlet billede:           ", stats.sheltersAnyFail);
  console.log("");

  console.log("URL'er pr. kilde:");
  console.log("  Google (lh3.googleusercontent.com):", stats.urls.google.ok, "OK,", stats.urls.google.fail, "fejl");
  console.log("  Andre hosts:                        ", stats.urls.other.ok, "OK,", stats.urls.other.fail, "fejl");
  console.log("");

  if (primaryFailed.length > 0) {
    console.log("───────────────────────────────────────────────────────────");
    console.log("Shelters med fejlet primært billede (kandidater til at rydde image_url):");
    console.log("───────────────────────────────────────────────────────────");
    primaryFailed.forEach(({ slug, title }) => {
      console.log(`  ${slug}`);
      console.log(`    ${title}`);
    });
    console.log("");
    console.log(`I alt ${primaryFailed.length} shelter(s). Kør f.eks. clear_404_image_urls.py for at sætte image_url til NULL.`);
  }
}

main().catch(console.error);
