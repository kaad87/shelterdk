#!/usr/bin/env node
/**
 * Tjek hvilke billed-URL'er der virker – og om Google-billeder fejler mere end andre.
 * Kør: node scripts/check-image-urls.js [--slug=shelter-i-true-skov-10055] [--limit=20]
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
const slugArg = args.find((a) => a.startsWith("--slug="));
const slug = slugArg ? slugArg.split("=")[1] : null;
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = parseInt(limitArg?.split("=")[1] || "20", 10);

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
  });
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Mangler NEXT_PUBLIC_SUPABASE_URL og SUPABASE key i .env");
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

  let q = supabase
    .from("shelters")
    .select("id, title, slug, image_url, image_urls")
    .is("duplicate_of_shelter_id", null)
    .not("image_url", "is", null)
    .neq("image_url", "")
    .limit(limit);

  if (slug) {
    q = q.eq("slug", slug);
  }

  const { data: shelters, error } = await q;

  if (error) {
    console.error("Supabase fejl:", error);
    process.exit(1);
  }
  if (!shelters?.length) {
    console.log("Ingen shelters med image_url fundet.");
    return;
  }

  console.log(`Tjekker ${shelters.length} shelter(s)...\n`);

  const results = { google: { ok: 0, fail: 0 }, other: { ok: 0, fail: 0 } };
  const failed = [];

  for (const s of shelters) {
    const urls = [s.image_url, ...(s.image_urls || [])].filter(Boolean);
    for (const url of urls) {
      if (!url || typeof url !== "string" || !url.startsWith("http")) continue;
      const host = getHost(url);
      const { ok, status } = await headCheck(url);
      const google = isGoogleHost(url);
      const key = google ? "google" : "other";
      if (ok) results[key].ok++;
      else {
        results[key].fail++;
        failed.push({ shelter: s.title, slug: s.slug, host, status, url: url.slice(0, 80) + "…" });
      }
    }
  }

  console.log("--- Resultat ---");
  console.log("Google (lh3.googleusercontent.com):", results.google.ok, "OK,", results.google.fail, "fejl");
  console.log("Andre hosts:", results.other.ok, "OK,", results.other.fail, "fejl");
  console.log("");

  if (failed.length > 0) {
    console.log("Fejlede URL'er:");
    failed.forEach((f) => {
      console.log(`  ${f.shelter} (${f.slug}) | ${f.host} | ${f.status}`);
    });
  }
}

main().catch(console.error);
