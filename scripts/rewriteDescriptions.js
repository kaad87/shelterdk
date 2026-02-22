#!/usr/bin/env node
/**
 * Omskriver shelter-beskrivelser til unik SEO-tekst via OpenAI gpt-4o-mini.
 * Henter shelters hvor description findes men seo_description er NULL,
 * kalder AI og opdaterer seo_description i Supabase.
 *
 * Kræver: .env/.env.local med NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *          (eller ANON_KEY) og OPENAI_API_KEY.
 *          Kolonnen seo_description (TEXT) skal findes i shelters-tabellen.
 *
 * Kør: node scripts/rewriteDescriptions.js
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

const SYSTEM_PROMPT = `Du er en dansk friluftsekspert, der polerer beskrivelser til en shelter-platform.

Din opgave: Gør teksten mindre kluntet – men ÆNDR BARE FORMULERINGER. Behold ALT indhold og SAMME LÆNGDE.

KRITISK: Forkort ALDRIG. Outputtet skal have omtrent lige så mange ord og sætninger som originalen. Hvis originalen har 3 afsnit, skal outputtet have 3 afsnit. Hvis den har punkter/bullets (fx "Praktisk information"), behold dem alle. Samme antal detaljer, samme niveau af information.

Du må kun:
- Ret uklare eller tungt formulerede sætninger
- Fjerne booking-URL'er og sætninger som "Læs mere og book her: https..."
- Gøre sproget mere flydende

Du må IKKE:
- Forkorte eller sammenfatte afsnit
- Fjerne fakta, faciliteter, praktisk information eller beskrivelser
- Droppe punkter fra lister
- Reducere antallet af sætninger

Hold en neutral, faktuel tone.`;

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = BATCH_SIZE;
  let delayMs = DEFAULT_DELAY_MS;
  let dryRun = false;
  for (const a of args) {
    if (a.startsWith("--limit=")) limit = Math.max(1, parseInt(a.slice(8), 10)) || BATCH_SIZE;
    if (a.startsWith("--delay=")) delayMs = Math.max(0, parseInt(a.slice(8), 10)) || DEFAULT_DELAY_MS;
    if (a === "--dry-run") dryRun = true;
  }
  return { limit, delayMs, dryRun };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(text) {
  if (!text || typeof text !== "string") return "";
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Udled vand fra water-kolonne eller geofa_raw.vandhane */
function getWater(s) {
  if (s.water === true || s.water === false) return s.water;
  const raw = s.geofa_raw || {};
  const v = String(raw.vandhane || "").toLowerCase();
  if (v.includes("ja")) return true;
  if (v.includes("nej")) return false;
  return null;
}

/** Udled toilet fra toilet-kolonne eller geofa */
function getToilet(s) {
  if (s.toilet) return s.toilet;
  const raw = s.geofa_raw || {};
  const v = String(raw.toilet || raw.wc || "").toLowerCase();
  if (v.includes("vand") || v.includes("flush")) return "flush";
  if (v.includes("muld") || v.includes("tør") || v.includes("kompost")) return "mulch";
  if (v.includes("nej") || v.includes("ingen")) return "none";
  return null;
}

/** Udled bålplads fra geofa_raw */
function getFirepit(s) {
  const raw = s.geofa_raw || {};
  const v = String(raw.braende || raw.baalplads || raw.baal || "").toLowerCase();
  if (v.includes("ja")) return true;
  if (v.includes("nej")) return false;
  return null;
}

function buildContext(shelter) {
  const parts = [];
  const name = (shelter.title || "").trim();
  if (name) parts.push(`Navn: ${name}`);

  const area = (shelter.area_slug || shelter.kommune || shelter.region || "").trim();
  if (area) parts.push(`Område: ${area}`);

  const place = (shelter.place || "").trim();
  if (place) parts.push(`Sted: ${place}`);

  const water = getWater(shelter);
  const toilet = getToilet(shelter);
  const firepit = getFirepit(shelter);
  const hasBooking = !!(shelter.booking_url && String(shelter.booking_url).trim());

  const facilities = [];
  if (water === true) facilities.push("vand/drikkevand");
  if (water === false) facilities.push("ingen vand");
  if (toilet === "flush") facilities.push("vandskyllende toilet");
  if (toilet === "mulch") facilities.push("muldtoilet/tørkloset");
  if (toilet === "none") facilities.push("ingen toilet");
  if (firepit === true) facilities.push("bålplads");
  if (hasBooking) facilities.push("bookbar");

  if (facilities.length > 0) parts.push(`Faciliteter: ${facilities.join(", ")}`);
  return parts.join("\n");
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
    createClient = require(path.join(__dirname, "..", "web", "node_modules", "@supabase", "supabase-js"))
      .createClient;
  }

  const webModules = path.join(__dirname, "..", "web", "node_modules");
  const mod = require(path.join(webModules, "openai"));
  const OpenAI = mod.default ?? mod;
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: shelters, error: fetchError } = await supabase
    .from("shelters")
    .select(
      "id, title, slug, description, area_slug, kommune, region, place, water, toilet, geofa_raw, booking_url"
    )
    .is("seo_description", null)
    .is("duplicate_of_shelter_id", null)
    .not("description", "is", null)
    .neq("description", "")
    .limit(limit);

  if (fetchError) {
    if (fetchError.code === "42703") {
      console.error(
        "Fejl: Kolonnen 'seo_description' findes ikke. Kør denne SQL i Supabase:\n  ALTER TABLE public.shelters ADD COLUMN seo_description TEXT;"
      );
    } else {
      console.error("Supabase fejl (hent shelters):", fetchError);
    }
    process.exit(1);
  }

  if (!shelters || shelters.length === 0) {
    console.log("Ingen shelters fundet uden seo_description og med description.");
    return;
  }

  console.log(
    `Fundet ${shelters.length} shelters. Starter omskrivning...${dryRun ? " (dry-run)" : ""}`
  );

  let ok = 0;
  let err = 0;

  for (let i = 0; i < shelters.length; i++) {
    const s = shelters[i];
    const rawDesc = s.description || "";
    const plain = stripHtml(rawDesc).slice(0, 4000);
    if (!plain) {
      console.log(`[${i + 1}/${shelters.length}] ${s.title}: spring over (tom beskrivelse)`);
      continue;
    }

    const context = buildContext(s);
    const userContent = `Kontekst:\n${context}\n\nOriginal beskrivelse:\n${plain}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
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
          .update({ seo_description: content })
          .eq("id", s.id);

        if (updateError) {
          console.error(
            `[${i + 1}/${shelters.length}] ${s.title}: Supabase update fejl:`,
            updateError.message
          );
          err++;
          continue;
        }
      }

      ok++;
      const preview = content.slice(0, 100).replace(/\n/g, " ");
      console.log(
        `[${i + 1}/${shelters.length}] ${s.title}: ${preview}...${dryRun ? " (dry-run)" : ""}`
      );

      if (i < shelters.length - 1) await sleep(delayMs);
    } catch (e) {
      console.error(`[${i + 1}/${shelters.length}] ${s.title}:`, e.message || e);
      err++;
    }
  }

  console.log(
    `\nFærdig. Opdateret: ${ok}, fejl: ${err}${dryRun ? " (dry-run – ingen ændringer)" : ""}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
