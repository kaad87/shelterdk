// web/app/api/submit-shelter/route.ts
import { createAdminClient } from "@/utils/supabase/server-admin";
import { enforcePublicRateLimit } from "@/lib/public-rate-limit";
import type { SubmissionType, FacilityKey, SubmitShelterPayload } from "@/lib/shelter-submissions";
import { FACILITY_KEYS, PHOTO_PATH_REGEX } from "@/lib/shelter-submissions";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_PER_WINDOW = 3;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DESCRIPTION_LENGTH = 4000;
const VALID_TYPES: SubmissionType[] = ["owner_registration", "user_tip"];

export async function POST(request: Request) {
  const rateLimited = await enforcePublicRateLimit(request, {
    scope: "submit-shelter",
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    maxHits: MAX_PER_WINDOW,
    errorMessage: "For mange forsøg. Prøv igen om lidt.",
  });
  if (rateLimited) {
    return rateLimited;
  }

  // Parse body
  let body: Partial<SubmitShelterPayload>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return Response.json({ success: true }, { status: 201 });
  }

  const type = body.type?.trim() as SubmissionType | undefined;
  const shelter_name = body.shelter_name?.trim();
  const location_text = body.location_text?.trim();

  // Validate required fields
  if (!type || !VALID_TYPES.includes(type)) {
    return Response.json(
      { error: "Feltet 'type' skal være 'owner_registration' eller 'user_tip'" },
      { status: 400 }
    );
  }
  if (!shelter_name || shelter_name.length === 0) {
    return Response.json({ error: "Shelterens navn er påkrævet" }, { status: 400 });
  }
  if (shelter_name.length > 200) {
    return Response.json({ error: "Navn må højst være 200 tegn" }, { status: 400 });
  }
  if (!location_text || location_text.length === 0) {
    return Response.json({ error: "Placering er påkrævet" }, { status: 400 });
  }
  if (location_text.length > 200) {
    return Response.json({ error: "Placering må højst være 200 tegn" }, { status: 400 });
  }

  // Email validation for owner_registration
  const contact_email = body.contact_email?.trim() || null;
  if (contact_email && !EMAIL_REGEX.test(contact_email)) {
    return Response.json({ error: "Ugyldig email-adresse" }, { status: 400 });
  }
  if (type === "owner_registration") {
    if (!contact_email) {
      return Response.json({ error: "Email er påkrævet for ejere/operatører" }, { status: 400 });
    }
  }

  // source_info length
  const source_info = body.source_info?.trim() || null;
  if (source_info && source_info.length > 500) {
    return Response.json(
      { error: "Beskrivelse må højst være 500 tegn" },
      { status: 400 }
    );
  }

  const description = body.description?.trim() || null;
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return Response.json(
      { error: `Beskrivelse må højst være ${MAX_DESCRIPTION_LENGTH} tegn` },
      { status: 400 }
    );
  }

  const booking_url = body.booking_url?.trim() || null;
  if (booking_url) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(booking_url);
    } catch {
      return Response.json({ error: "Bookinglink skal være en gyldig URL" }, { status: 400 });
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return Response.json(
        { error: "Bookinglink skal starte med http:// eller https://" },
        { status: 400 }
      );
    }
  }

  // Validate lat/lng — both must be present or both absent
  let lat: number | null = null;
  let lng: number | null = null;
  if (body.lat != null || body.lng != null) {
    const rawLat = body.lat;
    const rawLng = body.lng;
    if (
      typeof rawLat !== "number" || !isFinite(rawLat) ||
      rawLat < -90 || rawLat > 90
    ) {
      return Response.json({ error: "Ugyldig breddegrad (lat)" }, { status: 400 });
    }
    if (
      typeof rawLng !== "number" || !isFinite(rawLng) ||
      rawLng < -180 || rawLng > 180
    ) {
      return Response.json({ error: "Ugyldig længdegrad (lng)" }, { status: 400 });
    }
    lat = rawLat;
    lng = rawLng;
  }

  // Validate photo_urls — max 5, each must match path pattern
  let photo_urls: string[] = [];
  if (Array.isArray(body.photo_urls)) {
    if (body.photo_urls.length > 5) {
      return Response.json({ error: "Maks 5 billeder" }, { status: 400 });
    }
    for (const p of body.photo_urls) {
      if (typeof p !== "string" || !PHOTO_PATH_REGEX.test(p)) {
        return Response.json(
          { error: "Ugyldigt billede-sti format" },
          { status: 400 }
        );
      }
    }
    photo_urls = body.photo_urls;
  }

  // Sanitise facilities — only allow canonical keys
  let facilities: Partial<Record<FacilityKey, boolean>> | null = null;
  if (body.facilities && typeof body.facilities === "object") {
    facilities = {};
    for (const key of FACILITY_KEYS) {
      if (key in body.facilities) {
        facilities[key] = Boolean(body.facilities[key]);
      }
    }
    if (Object.keys(facilities).length === 0) facilities = null;
  }

  // Optional numeric fields
  let capacity: number | null = null;
  if (body.capacity != null) {
    if (
      typeof body.capacity !== "number" ||
      !isFinite(body.capacity) ||
      body.capacity < 1
    ) {
      return Response.json(
        { error: "Kapacitet skal være mindst 1 person" },
        { status: 400 }
      );
    }
    capacity = Math.floor(body.capacity);
  }

  const wants_booking = body.wants_booking === true;

  const supabase = createAdminClient();
  const { error } = await supabase.from("shelter_submissions").insert({
    type,
    shelter_name,
    location_text,
    lat,
    lng,
    photo_urls,
    capacity,
    description,
    facilities,
    booking_url,
    contact_name: body.contact_name?.trim() || null,
    contact_email,
    source_info,
    wants_booking,
  });

  if (error) {
    console.error("shelter_submissions insert:", error);
    return Response.json({ error: "Kunne ikke gemme. Prøv igen." }, { status: 500 });
  }

  return Response.json({ success: true }, { status: 201 });
}
