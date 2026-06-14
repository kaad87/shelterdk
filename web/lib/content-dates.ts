import fs from "node:fs";
import path from "node:path";
import commitDates from "@/lib/generated/content-commit-dates.json";

// Build-tid-manifest: filsti (relativ til cwd) → seneste git-commit-ISO-dato.
// Genereres i prebuild af scripts/generate-content-commit-dates.mjs. Bruges som
// reel "sidst ændret"-dato for sitemap-lastmod, så statiske sider ikke alle
// melder deploy-tidspunktet (fil-mtime) ved hvert build.
const COMMIT_DATES: Record<string, string> = commitDates as Record<string, string>;

function toDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : undefined;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

export function getFileModified(...relativeParts: string[]): Date | undefined {
  // Foretræk git-commit-datoen (reel "sidst ændret") frem for fil-mtime, der på
  // Netlify blot er checkout/deploy-tidspunktet. Falder tilbage til mtime lokalt
  // eller hvis filen ikke er i manifestet.
  const key = relativeParts.join("/");
  const committed = COMMIT_DATES[key];
  if (committed) {
    const parsed = new Date(committed);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  try {
    return fs.statSync(path.join(process.cwd(), ...relativeParts)).mtime;
  } catch {
    return undefined;
  }
}

export function getSitePageModified(canonicalPath: string): string | undefined {
  const segments = canonicalPath.split("/").filter(Boolean);
  const modified = getFileModified("app", "(site)", ...segments, "page.tsx");
  return modified?.toISOString();
}

export function newestIsoDate(
  ...values: Array<Date | string | null | undefined>
): string | undefined {
  const newest = values
    .map((value) => toDate(value))
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return newest?.toISOString();
}
