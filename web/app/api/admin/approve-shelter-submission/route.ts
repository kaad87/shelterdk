// web/app/api/admin/approve-shelter-submission/route.ts
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { slugifySegment } from "@/lib/slug";
import { sendShelterApprovedEmail } from "@/lib/email";
import { createOwnerClaimToken } from "@/lib/owner-claim";

export const dynamic = "force-dynamic";

const TOILET_VALUES = new Set(["flush", "mulch", "none", "unknown"]);

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

function getContentTypeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "jpeg":
    case "jpg":
    default:
      return "image/jpeg";
  }
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    submissionId?: string;
    region?: string;
    kommune?: string;
    place?: string;
    lat?: number;
    lng?: number;
    toiletType?: string;
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

  const toiletType = body.toiletType?.trim() || null;
  if (toiletType !== null && !TOILET_VALUES.has(toiletType)) {
    return Response.json({ error: "Ugyldig toiletType" }, { status: 400 });
  }

  const kommune = body.kommune?.trim() || null;
  const place = body.place?.trim() || null;

  const supabase = createAdminClient();

  // Claim the submission atomically — update status to "approved" while guarding
  // on status=pending. Fetching the submission data in the same round-trip avoids
  // the window where a concurrent reject could sneak in between a separate SELECT
  // and the eventual shelter INSERT.
  const { data: claimedRows, error: claimError } = await supabase
    .from("shelter_submissions")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("status", "pending")
    .select(
      "id, shelter_name, description, capacity, facilities, booking_url, contact_email, photo_urls"
    );

  if (claimError) {
    return Response.json({ error: claimError.message }, { status: 500 });
  }

  // 0 rows means the submission was already approved or rejected.
  if (!claimedRows || claimedRows.length === 0) {
    return Response.json({ error: "Ansøgning er allerede behandlet" }, { status: 409 });
  }

  const submission = claimedRows[0];

  // Generate unique shelter ID and slug
  const newShelterId = crypto.randomUUID();
  const slugBase = slugifySegment(submission.shelter_name);
  const slug = `${slugBase}-${crypto.randomUUID().slice(0, 6)}`;

  // Copy photos from shelter-submissions bucket to shelter-photos bucket
  const submissionsBucket = "shelter-submissions";
  const photosBucket = "shelter-photos";
  const reuploadedUrls: string[] = [];
  const reuploadedPaths: string[] = [];

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
      const contentType = getContentTypeForExt(ext);

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
      reuploadedPaths.push(newPath);
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
    // toiletType is set explicitly by admin during review (null = no toilet).
    toilet: toiletType as "flush" | "mulch" | "none" | "unknown" | null,
    capacity: submission.capacity || null,
    booking_url: submission.booking_url || null,
    // user_image_urls is a plain text[] array, not a wrapped object.
    user_image_urls: reuploadedUrls.length > 0 ? reuploadedUrls : null,
    geofa_raw: Object.keys(geofa_raw).length > 0 ? geofa_raw : null,
  });

  if (insertError) {
    console.error("Shelter insert error:", insertError);
    // Revert submission to pending so it can be re-tried by the admin.
    await supabase
      .from("shelter_submissions")
      .update({ status: "pending", reviewed_at: null })
      .eq("id", submissionId);
    // Delete any photos already copied to shelter-photos to avoid orphans.
    if (reuploadedPaths.length > 0) {
      const { error: photoCleanupError } = await supabase.storage
        .from(photosBucket)
        .remove(reuploadedPaths);
      if (photoCleanupError) {
        console.error("Failed to clean up orphaned shelter-photos after insert rollback:", photoCleanupError);
      }
    }
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  // Revalidér listesider så det nye shelter er synligt straks (ISR er 24t ellers).
  try {
    revalidatePath(`/danmark/${slugifySegment(region)}`);
    if (kommune) revalidatePath(`/danmark/${slugifySegment(region)}/${slugifySegment(kommune)}`);
  } catch (err) {
    console.error("Revalidering efter approve fejlede (ikke-kritisk):", err);
  }

  // Persist shelter_id reference back onto the submission record.
  await supabase
    .from("shelter_submissions")
    .update({ shelter_id: newShelterId })
    .eq("id", submissionId);

  // Clean up source photos from the submissions bucket now that they are in shelter-photos.
  if (photoPaths.length > 0) {
    const { error: cleanupError } = await supabase.storage
      .from(submissionsBucket)
      .remove(photoPaths);
    if (cleanupError) {
      console.error("Failed to clean up submission photos after approval:", cleanupError);
    }
  }

  // Send approval email — INKLUSIV claim-token så ejeren kan oprette
  // konto og administrere bookings selv (bro fra public submission til
  // /ejer/dashboard). Token har 7-dages TTL; ejeren skal bruge det inden
  // det udløber. Hvis token-creation fejler, sender vi stadig approval-
  // emailen (uden link) — shelter er already live + admin kan generere
  // nyt token manuelt.
  if (submission.contact_email) {
    let claimToken: string | null = null;
    try {
      const claim = await createOwnerClaimToken(
        newShelterId,
        submission.contact_email.trim().toLowerCase()
      );
      claimToken = claim?.token ?? null;
    } catch (tokenErr) {
      console.error("Owner claim-token creation failed:", tokenErr);
    }

    try {
      await sendShelterApprovedEmail({
        toEmail: submission.contact_email,
        shelterName: submission.shelter_name,
        shelterSlug: slug,
        submissionId,
        claimToken,
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
