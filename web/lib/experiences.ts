export interface ShelterExperience {
  id: string;
  shelter_id: string;
  author_name: string;
  body: string;
  photo_urls: string[];
  cover_photo_index: number;
  status: "pending" | "approved" | "rejected";
  rejected_reason: string | null;
  created_at: string;
  approved_at: string | null;
}

/** Experience with joined shelter info — used in admin and feeds */
export interface ShelterExperienceWithShelter extends ShelterExperience {
  shelter: { title: string; slug: string } | null;
}

/** Payload for creating an experience */
export interface CreateExperiencePayload {
  experienceId: string;      // pre-allocated UUID from upload-url step
  shelter_id: string;
  author_name: string;
  body: string;
  photo_paths: string[];     // Storage paths returned by upload-url route
  cover_photo_index: number;
}

/** Returns the public Storage URL for a photo path */
export function experiencePhotoUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/experience-photos/${path}`;
}

/** Truncates text to maxLen chars, appending "…" if needed */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}
