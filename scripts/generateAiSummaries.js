#!/usr/bin/env node
/**
 * Genererer AI-opsummeringer for shelters via OpenAI API.
 * Henter shelters hvor ai_summary er NULL og description findes,
 * kalder gpt-4o-mini og opdaterer ai_summary i Supabase.
 *
 * Kræver: .env/.env.local med NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *          (eller ANON_KEY) og OPENAI_API_KEY.
 *
 * Kør: node scripts/generateAiSummaries.js
 *   --limit=50      max shelters per kørsel (standard 50)
 *   --delay=500     ms mellem API-kald (standard 500)
 *   --dry-run       vis kun hvad der ville blive opdateret
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
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const BATCH_SIZE = 50;
const DEFAULT_DELAY_MS = 500;

const SYSTEM_PROMPT = `Du er en friluftsekspert. Læs følgende shelter-beskrivelse og returner præcis 3 korte, fængende bulletpoints på dansk, der fremhæver det vigtigste (fx faciliteter, beliggenhed eller natur). Returner det som ren tekst med et bindestreg (-) foran hvert punkt.`;

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = BATCH_SIZE;
  let delayMs = DEFAULT_DELAY_MS;
  let dryRun = false;
  for (const a of args) {
    if (a.startsWith("--limit="))
      limit = Math.max(1, parseInt(a.slice(8), 10)) || BATCH_SIZE;
    if (a.startsWith("--delay="))
      delayMs = Math.max(0, parseInt(a.slice(8), 10)) || DEFAULT_DELAY_MS;
    if (a === "--dry-run") dryRun = true;
  }
  return { limit, delayMs, dryRun };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Mangler NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY (eller ANON_KEY) i .env");
    process.exit(1);
  }
  if (!OPENAI_API_KEY) {
    console.error("Mangler OPENAI_API_KEY i .env");
    process.exit(1);
  }

  const { limit, delayMs, dryRun } = parseArgs();

  let createClient;
  try {
    createClient = require("@supabase/supabase-js").createClient;
  } catch {
    const webModules = path.join(__dirname, "..", "web", "node_modules");
    createClient = require(path.join(webModules, "@supabase", "supabase-js")).createClient;
  }

  const webModules = path.join(__dirname, "..", "web", "node_modules");
  const mod = require(path.join(webModules, "openai"));
  const OpenAI = mod.default ?? mod;
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: shelters, error: fetchError } = await supabase
    .from("shelters")
    .select("id, title, slug, description")
    .is("ai_summary", null)
    .is("duplicate_of_shelter_id", null)
    .not("description", "is", null)
    .neq("description", "")
    .limit(limit);

  if (fetchError) {
    console.error("Supabase fejl (hent shelters):", fetchError);
    process.exit(1);
  }

  if (!shelters || shelters.length === 0) {
    console.log("Ingen shelters fundet uden ai_summary og med description.");
    return;
  }

  console.log(`Fundet ${shelters.length} shelters. Starter generering...${dryRun ? " (dry-run)" : ""}`);

  let ok = 0;
  let err = 0;

  for (let i = 0; i < shelters.length; i++) {
    const s = shelters[i];
    const rawDesc = s.description || "";
    const plain = stripHtml(rawDesc).slice(0, 3000);
    if (!plain) {
      console.log(`[${i + 1}/${shelters.length}] ${s.title}: spring over (tom beskrivelse)`);
      continue;
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: plain },
        ],
      });

      const content = completion.choices?.[0]?.message?.content?.trim();
      if (!content) {
        console.log(`[${i + 1}/${shelters.length}] ${s.title}: tom respons fra OpenAI`);
        err++;
        continue;
      }

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from("shelters")
          .update({ ai_summary: content })
          .eq("id", s.id);

        if (updateError) {
          console.error(`[${i + 1}/${shelters.length}] ${s.title}: Supabase update fejl:`, updateError.message);
          err++;
          continue;
        }
      }

      ok++;
      const preview = content.slice(0, 80).replace(/\n/g, " ");
      console.log(`[${i + 1}/${shelters.length}] ${s.title}: ${preview}...${dryRun ? " (dry-run)" : ""}`);

      if (i < shelters.length - 1) await sleep(delayMs);
    } catch (e) {
      console.error(`[${i + 1}/${shelters.length}] ${s.title}:`, e.message || e);
      err++;
    }
  }

  console.log(`\nFærdig. Opdateret: ${ok}, fejl: ${err}${dryRun ? " (dry-run – ingen ændringer)" : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
