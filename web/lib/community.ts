export type CommunitySubmissionType = "comment" | "facilities_update";

export type CommunitySubmissionStatus = "pending" | "approved" | "rejected";

export type TriStateValue = "yes" | "no" | "unknown";

export const FACILITY_FIELDS = [
  { key: "toilet", label: "Toilet" },
  { key: "parkering", label: "Parkering" },
  { key: "baalplads", label: "Bålplads" },
  { key: "legeplads", label: "Legeplads" },
  { key: "fiskeri", label: "Fiskeri" },
  { key: "vand", label: "Vand" },
  { key: "teltplads", label: "Teltplads" },
  { key: "hund", label: "Hund tilladt" },
  { key: "hest", label: "Hest tilladt" },
  { key: "braende", label: "Brænde til bål" },
  { key: "bad", label: "Bad" },
  { key: "elektricitet", label: "Elektricitet" },
  { key: "koeleskab", label: "Køleskab" },
] as const;

export type FacilityFieldKey = (typeof FACILITY_FIELDS)[number]["key"];

export type FacilitiesPayload = Partial<Record<FacilityFieldKey, TriStateValue>>;

export interface CommunityCommentPayload {
  text: string;
}

export function isTriStateValue(v: unknown): v is TriStateValue {
  return v === "yes" || v === "no" || v === "unknown";
}

export function sanitizeCommentText(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeSubmitterName(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseFacilitiesPayload(raw: unknown): FacilitiesPayload {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const out: FacilitiesPayload = {};
  for (const field of FACILITY_FIELDS) {
    const value = input[field.key];
    if (isTriStateValue(value)) out[field.key] = value;
  }
  return out;
}

export function hasAtLeastOneFacilityValue(payload: FacilitiesPayload): boolean {
  return FACILITY_FIELDS.some((f) => payload[f.key] != null);
}
