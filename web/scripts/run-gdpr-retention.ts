/**
 * GDPR retention cleanup runner.
 *
 * Intended to be invoked via cron (Vercel/Netlify scheduled function or
 * external cron hitting /api/cron/gdpr-retention). Can also be run ad-hoc
 * locally with:
 *
 *   npx tsx scripts/run-gdpr-retention.ts
 */

import fs from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { runRetentionCleanup } from "@/lib/gdpr-retention";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const envCandidates = [
  path.resolve(scriptDir, "../.env.local"),
  path.resolve(scriptDir, "../../.env"),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    loadDotenv({ path: envPath, override: false });
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const result = await runRetentionCleanup();
  console.log(
    JSON.stringify(
      { startedAt, finishedAt: new Date().toISOString(), ...result },
      null,
      2
    )
  );
  if (result.errors.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
