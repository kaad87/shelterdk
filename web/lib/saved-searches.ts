import { randomBytes } from "crypto";
import type { SoegFilters } from "@/lib/soeg-db";
import type { Shelter } from "@/types/shelter";
import { isStructuredBookable } from "@shared/lib/shelter-detail";

/**
 * Saved-search infrastruktur — backend for F11 (CRO-review).
 *
 * En SavedSearch repræsenterer en bruger der har bedt om e-mail når nye
 * shelters matcher hendes filtre. Flow:
 *
 *   1. Bruger udfylder modal → POST /api/save-search → row oprettes
 *      med `confirmed_at = null` + e-mail med bekræftelseslink.
 *   2. Bruger klikker linket → GET /api/save-search/[token]/confirm →
 *      sætter `confirmed_at = now()`.
 *   3. Daglig cron (`/api/cron/saved-search-alerts`) finder nye shelters
 *      pr. bekræftet søgning og sender alert hvis matches > 0.
 *   4. Bruger kan altid afmelde via unsubscribe-link (samme token).
 */

export interface SavedSearchRow {
  id: string;
  email: string;
  region: string | null;
  q: string | null;
  area: string | null;
  filters: SoegFilters;
  token: string;
  confirmed_at: string | null;
  last_run_at: string | null;
  last_notified_at: string | null;
  notify_count: number;
  created_at: string;
}

/** Genererer et 32-tegns URL-safe token (base64url). */
export function generateSavedSearchToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Validerer e-mail på en pragmatisk måde — vi accepterer alle adresser
 * der ser fornuftige ud og lader Resend afvise resten. Bevidst lempelig
 * for at undgå false negatives (fx + i lokal-delen, lange TLDs).
 */
export function isValidEmailFormat(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

/**
 * Bygger /soeg?... URL fra en gemt søgning (uden at miste filtre).
 * Bruges i e-mailen så brugeren kan klikke direkte ind på sin søgning.
 */
export function buildSavedSearchUrl(
  baseOrigin: string,
  search: Pick<SavedSearchRow, "region" | "q" | "area" | "filters">
): string {
  const params = new URLSearchParams();
  if (search.region) params.set("region", search.region);
  if (search.q) params.set("q", search.q);
  if (search.area) params.set("area", search.area);
  for (const [key, value] of Object.entries(search.filters ?? {})) {
    if (typeof value === "boolean" && value) params.set(key, "1");
    if (typeof value === "number" && value > 0) params.set(key, String(value));
    if (typeof value === "string" && value) params.set(key, value);
  }
  const qs = params.toString();
  return `${baseOrigin}/soeg${qs ? `?${qs}` : ""}`;
}

/**
 * Læsbar oversigt over en gemt søgnings filtre — bruges i e-mails så
 * brugeren kan se HVAD de har gemt.
 */
export function describeSavedSearch(search: Pick<SavedSearchRow, "region" | "q" | "area" | "filters">): string {
  const parts: string[] = [];
  if (search.q) parts.push(`"${search.q}"`);
  if (search.region) parts.push(`i ${search.region}`);
  else if (!search.q && !search.area) parts.push("i hele Danmark");
  if (search.area) parts.push(`område ${search.area}`);

  const filterLabels: Record<string, string> = {
    bookbar: "bookbar",
    vand: "vand",
    toilet: "toilet",
    hund: "hund tilladt",
    baalplads: "bålplads",
    bord_baenk: "bord/bænke",
    strand: "strand",
    bruser: "bruser/bad",
    handicap: "handicapegnet",
    anmeldelser: "anmeldelser",
  };
  const flags = Object.entries(search.filters ?? {})
    .filter(([, v]) => v === true)
    .map(([k]) => filterLabels[k])
    .filter(Boolean);
  if (flags.length > 0) parts.push(`med ${flags.join(", ")}`);

  if (search.filters?.min_pladser && search.filters.min_pladser > 0) {
    parts.push(`min. ${search.filters.min_pladser} pladser`);
  }
  return parts.join(" ") || "Alle shelters";
}

/**
 * Tjekker om en shelter matcher en gemt søgnings facility-filtre.
 *
 * Tager IKKE højde for `q`/`area` (DB-query'en gør det); kun de
 * boolean-flags der findes på shelter-rækken.
 */
export function matchesSavedSearch(shelter: Shelter, filters: SoegFilters | null | undefined): boolean {
  if (!filters) return true;
  if (filters.bookbar && !isStructuredBookable(shelter)) return false;
  if (filters.vand && shelter.water !== true) return false;
  if (filters.toilet) {
    const t = shelter.toilet ?? "unknown";
    if (t !== "flush" && t !== "mulch") return false;
  }
  // For geofa-baserede filtre matcher vi præcis som DB-queryen i soeg-db.ts
  // gør. Konventionen er ilike "%ja%" (case-insensitive substring) for alle
  // Ja/Nej-flag — robust mod casing- og whitespace-drift i GEOFA-data.
  const geofa = (shelter as Shelter & { geofa_raw?: Record<string, unknown> }).geofa_raw ?? {};
  const geofaLower = (key: string): string => String(geofa?.[key] ?? "").toLowerCase();
  if (filters.hund && !geofaLower("hunde_tilladt").includes("ja")) return false;
  if (filters.baalplads && !geofaLower("baalplads").includes("ja")) return false;
  if (filters.bord_baenk && !geofaLower("bord_baenk").includes("ja")) return false;
  if (filters.strand && !geofaLower("strand_naerhed").includes("ja")) return false;
  if (filters.bruser && !geofaLower("bruser_bad").includes("ja")) return false;
  // handicap: DB bruger or() med to specifikke værdier; matchesSavedSearch
  // bruger case-insensitive prefix-match for at fange casing-drift.
  if (filters.handicap) {
    const h = geofaLower("handicap");
    if (!h.includes("handicapegnet") && !h.includes("delvist")) return false;
  }
  // gratis: DB bruger eq "Nej" — case-insensitive her for samme robusthed.
  if (filters.gratis && geofaLower("betaling") !== "nej") return false;
  if (filters.anmeldelser) {
    const reviews = shelter.google_user_ratings_total ?? 0;
    if (reviews <= 0) return false;
  }
  if (filters.min_pladser && filters.min_pladser > 0) {
    const cap = shelter.capacity ?? 0;
    if (cap < filters.min_pladser) return false;
  }
  return true;
}
