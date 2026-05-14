// web/app/api/admin/approve-shelter-submission/route.ts
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { slugifySegment } from "@/lib/slug";
import { sendShelterApprovedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest | Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const url = new URL(request.url);
  const query = url.searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    submissionId?: string;
    region?: string;
    kommune?: string;
    place?: string;
    lat?: number;
    lng?: number;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const submissionId = body.submissionId?.trim();
  if (!submissionId || !UUID_REGEX.test(submissionId)) {
    return Response.json({ error: "Mangler eller ugyldigt submissionId" }, { status: 400 });
  }

  const region = body.region?.trim();
  if (!region) {
    return Response.json({ error: "Region er påkrævet" }, { status: 400 });
  }

  const lat = body.lat;
  const lng = body.lng;
  if (typeof lat !== "number" || !isFinite(lat) || lat < -90 || lat > 90) {
    return Response.json({ error: "Ugyldig lat" }, { status: 400 });
  }
  if (typeof lng !== "number" || !isFinite(lng) || lng < -180 || lng > 180) {
    return Response.json({ error: "Ugyldig lng" }, { status: 400 });
  }

  const kommune = body.kommune?.trim() || null;
  const place = body.place?.trim() || null;

  const supabase = createAdminClient();

  // Fetch submission
  const { data: submission, error: fetchError } = await supabase
    .from("shelter_submissions")
    .select(
      "id, shelter_name, description, capacity, facilities, booking_url, contact_email, photo_urls"
    )
    .eq("id", submissionId)
    .eq("status", "pending")
    .single();

  if (fetchError || !submission) {
    return Response.json({ error: "Ansøgning ikke fundet" }, { status: 404 });
  }

  // Generate unique shelter ID and slug
  const newShelterId = crypto.randomUUID();
  const slugBase = slugifySegment(submission.shelter_name);
  const slug = `${slugBase}-${crypto.randomUUID().slice(0, 6)}`;

  // Copy photos from shelter-submissions bucket to shelter-photos bucket
  const submissionsBucket = "shelter-submissions";
  const photosBucket = "shelter-photos";
  const reuploadedUrls: string[] = [];
  const reuploadedPaths: string[] = []; // track storage paths for cleanup logging

  const photoPaths: string[] = Array.isArray(submission.photo_urls)
    ? submission.photo_urls
    : [];

  for (const storagePath of photoPaths) {
    try {
      // Download from submissions bucket
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(submissionsBucket)
        .download(storagePath);

      if (downloadError || !fileData) {
        console.error(`Photo download failed for ${storagePath}:`, downloadError);
        continue;
      }

      // Re-upload to shelter-photos bucket
      const ext = storagePath.split(".").pop() ?? "jpg";
      const newPath = `owner/${newShelterId}/${crypto.randomUUID()}.${ext}`;
      const contentType = ext === "png" ? "image/png" : "image/jpeg";

      const { error: uploadError } = await supabase.storage
        .from(photosBucket)
        .upload(newPath, fileData, { contentType, upsert: false });

      if (uploadError) {
        console.error(`Photo re-upload failed for ${storagePath}:`, uploadError);
        continue;
      }

      // Build public URL for shelter-photos (public bucket)
      const { data: urlData } = supabase.storage
        .from(photosBucket)
        .getPublicUrl(newPath);
      reuploadedUrls.push(urlData.publicUrl);
      reuploadedPaths.push(newPath); // track path for cleanup if insert fails
    } catch (err) {
      console.error(`Unexpected error copying photo ${storagePath}:`, err);
    }
  }

  // Build geofa_raw from facilities
  const facilities =
    (submission.facilities as Partial<Record<string, boolean>> | null) ?? {};
  const geofa_raw: Record<string, string> = {};
  if (facilities.baalplads) geofa_raw.baalplads = "Ja";
  if (facilities.hunde_tilladt) geofa_raw.hunde_tilladt = "Ja";

  // Insert shelter — POINT(lng lat) plain text format (parsed by regex on site)
  const location = `POINT(${lng} ${lat})`;

  const { error: insertError } = await supabase.from("shelters").insert({
    id: newShelterId,
    title: submission.shelter_name,
    slug,
    description: submission.description || null,
    location,
    region,
    kommune: kommune || null,
    place: place || null,
    water: facilities.vand ?? false,
    toilet: facilities.toilet ?? false,
    capacity: submission.capacity || null,
    booking_url: submission.booking_url || null,
    user_image_urls: reuploadedUrls.length > 0 ? { urls: reuploadedUrls } : null,
    geofa_raw: Object.keys(geofa_raw).length > 0 ? geofa_raw : null,
  });

  if (insertError) {
    console.error("Shelter insert error:", insertError);
    if (reuploadedPaths.length > 0) {
      console.error(
        `Orphaned photos in shelter-photos bucket for shelter ${newShelterId}:`,
        reuploadedPaths
      );
    }
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  // Update submission status + shelter_id reference
  await supabase
    .from("shelter_submissions")
    .update({
      status: "approved",
      shelter_id: newShelterId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  // Send approval email
  if (submission.contact_email) {
    try {
      await sendShelterApprovedEmail({
        toEmail: submission.contact_email,
        shelterName: submission.shelter_name,
        shelterSlug: slug,
        submissionId,
      });
    } catch (emailErr) {
      console.error("Approval email failed:", emailErr);
      return Response.json(
        { ok: true, shelterId: newShelterId, slug, warning: "Shelter oprettet men email fejlede" },
        { status: 200 }
      );
    }
  }

  return Response.json({ ok: true, shelterId: newShelterId, slug });
}
