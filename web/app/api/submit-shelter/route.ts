// web/app/api/submit-shelter/route.ts
import { createAdminClient } from "@/utils/supabase/server-admin";
import type { SubmissionType, FacilityKey, SubmitShelterPayload } from "@/lib/shelter-submissions";
import { FACILITY_KEYS } from "@/lib/shelter-submissions";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;
const ipTimestamps = new Map<string, number[]>();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_TYPES: SubmissionType[] = ["owner_registration", "user_tip"];

export async function POST(request: Request) {
  // Rate limiting — same pattern as /api/contact/route.ts
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const timestamps = ipTimestamps.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return Response.json(
      { error: "For mange forsøg. Prøv igen om lidt." },
      { status: 429 }
    );
  }
  recent.push(now);
  ipTimestamps.set(ip, recent);

  // Parse body
  let body: Partial<SubmitShelterPayload>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
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

  // Flow 1: email required + format check
  const contact_email = body.contact_email?.trim() || null;
  if (type === "owner_registration") {
    if (!contact_email) {
      return Response.json({ error: "Email er påkrævet for ejere/operatører" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(contact_email)) {
      return Response.json({ error: "Ugyldig email-adresse" }, { status: 400 });
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
  const capacity =
    typeof body.capacity === "number" && body.capacity > 0
      ? Math.floor(body.capacity)
      : null;

  const supabase = createAdminClient();
  const { error } = await supabase.from("shelter_submissions").insert({
    type,
    shelter_name,
    location_text,
    capacity,
    description: body.description?.trim() || null,
    facilities,
    booking_url: body.booking_url?.trim() || null,
    contact_name: body.contact_name?.trim() || null,
    contact_email,
    source_info,
  });

  if (error) {
    console.error("shelter_submissions insert:", error);
    return Response.json({ error: "Kunne ikke gemme. Prøv igen." }, { status: 500 });
  }

  return Response.json({ success: true }, { status: 201 });
}
