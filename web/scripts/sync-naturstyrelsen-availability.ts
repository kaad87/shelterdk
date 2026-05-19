import fs from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { syncNaturstyrelsenAvailabilityBatch } from "@/lib/naturstyrelsen-availability";

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
  const results = await syncNaturstyrelsenAvailabilityBatch();
  const success = results.filter((result) => result.status === "success");
  const skipped = results.filter((result) => result.status === "skipped");
  const errors = results.filter((result) => result.status === "error");

  console.log(
    JSON.stringify(
      {
        success: success.length,
        skipped: skipped.length,
        errors: errors.length,
        refreshedPidCount: success.filter((result) => result.hadPidRefresh).length,
        sampleErrors: errors.slice(0, 20),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
