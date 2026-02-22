#!/usr/bin/env node
/**
 * Lister URLs for shelters (localhost:3000).
 *   --updated   vis kun shelters med seo_description (de der viser AI-tekst)
 *   --limit=N   max antal (standard 10 uden --updated, 50 med --updated)
 * Kør: node scripts/listShelterUrls.js [--updated] [--limit=50]
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

const args = process.argv.slice(2);
const updated = args.includes("--updated");
const limit = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || (updated ? "50" : "10"), 10);

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Mangler NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY i .env");
    process.exit(1);
  }

  let createClient;
  try {
    createClient = require("@supabase/supabase-js").createClient;
  } catch {
    createClient = require(path.join(ROOT, "web", "node_modules", "@supabase", "supabase-js")).createClient;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const q = supabase
    .from("shelters")
    .select("id, title, slug, region, kommune")
    .is("duplicate_of_shelter_id", null)
    .limit(limit);

  if (updated) {
    q.not("seo_description", "is", null).neq("seo_description", "");
  } else {
    q.is("seo_description", null).not("description", "is", null).neq("description", "");
  }

  const { data: shelters, error } = await q;

  if (error) {
    console.error("Supabase fejl:", error);
    process.exit(1);
  }

  if (!shelters?.length) {
    console.log(updated ? "Ingen shelters med seo_description fundet." : "Ingen shelters fundet.");
    return;
  }

  const base = "http://localhost:3000";
  console.log(updated
    ? `Shelters med opdateret AI-beskrivelse (viser seo_description): ${shelters.length}\n`
    : `Shelters uden seo_description (næste i kø til rewriteDescriptions): ${shelters.length}\n`);

  function slugify(s) {
    if (!s || typeof s !== "string") return "";
    return s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/æ/g, "ae")
      .replace(/ø/g, "oe")
      .replace(/å/g, "aa")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  shelters.forEach((s, i) => {
    const short = `${base}/shelter/${s.slug}`;
    const r = (s.region || "").trim();
    const k = (s.kommune || "").trim();
    const full =
      r && r !== "Danmark"
        ? `${base}/danmark/${slugify(r)}/${k ? slugify(k) : "ukendt-kommune"}/${s.slug}`
        : short;
    console.log(`[${i + 1}] ${s.title}`);
    console.log(`    ${full}\n`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
