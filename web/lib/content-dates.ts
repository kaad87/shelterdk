import fs from "node:fs";
import path from "node:path";

function toDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : undefined;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

export function getFileModified(...relativeParts: string[]): Date | undefined {
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
