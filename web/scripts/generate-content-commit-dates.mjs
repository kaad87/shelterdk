/**
 * Build-time: skriv et manifest over hver app/(site)-fils SENESTE git-commit-dato.
 *
 * Sitemap'ets `lastmod` for statiske sider stammede fra fil-mtime, som på
 * Netlify = checkout/deploy-tidspunktet → hver side meldte "ændret i dag" ved
 * hvert deploy (freshness-inflation Google kan ignorere). Git-commit-datoen er
 * den reelle "sidst ændret"-dato. Manifestet læses af getFileModified().
 *
 * Kører i prebuild. Fejler aldrig hårdt: kan git ikke læses, skrives et tomt
 * manifest, og getFileModified falder tilbage til fil-mtime som før.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "lib", "generated");
const OUT_FILE = path.join(OUT_DIR, "content-commit-dates.json");
const SCOPE = "app/(site)";

function gitPrefix() {
  // git emitter stier relativt til repo-roden; getFileModified bruger stier
  // relativt til cwd (web/). Beregn prefikset, så nøglerne matcher.
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    const rel = path.relative(top, ROOT).split(path.sep).join("/");
    return rel ? rel + "/" : "";
  } catch {
    return "";
  }
}

function buildMap() {
  const map = {};
  let out;
  try {
    out = execFileSync(
      "git",
      ["-c", "core.quotePath=false", "log", "--format=%cI", "--name-only", "--", SCOPE],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (err) {
    console.warn("content-commit-dates: git utilgængelig — tomt manifest:", err?.message ?? err);
    return map;
  }

  const prefix = gitPrefix();
  const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  let currentDate = null;
  for (const raw of out.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (isoRe.test(line)) {
      currentDate = line;
      continue;
    }
    // Filsti-linje. git log er nyeste-først → første forekomst = seneste commit.
    const key = prefix && line.startsWith(prefix) ? line.slice(prefix.length) : line;
    if (currentDate && !(key in map)) map[key] = currentDate;
  }
  return map;
}

const map = buildMap();
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(map, null, 0) + "\n", "utf8");
console.log(`content-commit-dates: skrev ${Object.keys(map).length} filer → ${path.relative(ROOT, OUT_FILE)}`);
