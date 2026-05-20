// web/lib/shelter-submissions.ts

export type SubmissionType = "owner_registration" | "user_tip";
export type SubmissionStatus = "pending" | "approved" | "rejected";

/** Canonical facility keys stored in the `facilities` JSONB column */
export const FACILITY_KEYS = [
  "vand",
  "toilet",
  "baalplads",
  "parkering",
  "hunde_tilladt",
] as const;
export type FacilityKey = (typeof FACILITY_KEYS)[number];

export const FACILITY_LABELS: Record<FacilityKey, string> = {
  vand: "💧 Vand",
  toilet: "🚽 Toilet",
  baalplads: "🔥 Bålplads",
  parkering: "🅿️ Parkering",
  hunde_tilladt: "🐕 Hund tilladt",
};

export interface ShelterSubmission {
  id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  shelter_name: string;
  location_text: string;
  lat: number | null;
  lng: number | null;
  photo_urls: string[];
  capacity: number | null;
  description: string | null;
  facilities: Partial<Record<FacilityKey, boolean>> | null;
  booking_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  source_info: string | null;
  admin_note: string | null;
  rejected_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  shelter_id: string | null;
  wants_booking: boolean;
}

/** Payload shape accepted by POST /api/submit-shelter */
export interface SubmitShelterPayload {
  type: SubmissionType;
  shelter_name: string;
  location_text: string;
  website?: string;
  lat?: number | null;
  lng?: number | null;
  photo_urls?: string[];
  capacity?: number | null;
  description?: string;
  facilities?: Partial<Record<FacilityKey, boolean>>;
  booking_url?: string;
  contact_name?: string;
  contact_email?: string;
  source_info?: string;
  wants_booking?: boolean;
}

/** Photo path pattern for submissions bucket: pending/{uuid}.{ext} */
export const PHOTO_PATH_REGEX = /^pending\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i;
