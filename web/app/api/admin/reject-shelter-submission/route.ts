// web/app/api/admin/reject-shelter-submission/route.ts
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";
import { sendShelterRejectedEmail } from "@/lib/email";

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

  let body: { submissionId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const submissionId = body.submissionId?.trim();
  if (!submissionId || !UUID_REGEX.test(submissionId)) {
    return Response.json({ error: "Mangler eller ugyldigt submissionId" }, { status: 400 });
  }

  const reason = body.reason?.trim();
  if (!reason) {
    return Response.json({ error: "Årsag til afvisning er påkrævet" }, { status: 400 });
  }
  if (reason.length > 1000) {
    return Response.json({ error: "Årsag må højst være 1000 tegn" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch submission to get photo_urls and contact info
  const { data: submission, error: fetchError } = await supabase
    .from("shelter_submissions")
    .select("id, shelter_name, contact_email, photo_urls")
    .eq("id", submissionId)
    .eq("status", "pending")
    .single();

  if (fetchError || !submission) {
    return Response.json({ error: "Ansøgning ikke fundet" }, { status: 404 });
  }

  // Update status — guard on pending so a concurrent approve is treated as 409.
  // .select("id") lets us check whether any row was actually updated.
  const { data: updatedRows, error: updateError } = await supabase
    .from("shelter_submissions")
    .update({
      status: "rejected",
      rejected_reason: reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("status", "pending") // idempotency guard
    .select("id");

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  // 0 rows updated means the submission was already processed (approved or rejected).
  // Bail out before side effects (photo deletion, email).
  if (!updatedRows || updatedRows.length === 0) {
    return Response.json(
      { error: "Ansøgning er allerede behandlet" },
      { status: 409 }
    );
  }

  // Delete photos from shelter-submissions bucket
  const photoPaths: string[] = Array.isArray(submission.photo_urls)
    ? submission.photo_urls
    : [];

  for (const storagePath of photoPaths) {
    const { error: removeError } = await supabase.storage
      .from("shelter-submissions")
      .remove([storagePath]);
    if (removeError) {
      console.error(`Failed to delete photo ${storagePath}:`, removeError);
    }
  }

  // Send rejection email
  if (submission.contact_email) {
    try {
      await sendShelterRejectedEmail({
        toEmail: submission.contact_email,
        shelterName: submission.shelter_name,
        reason,
        submissionId,
      });
    } catch (emailErr) {
      console.error("Rejection email failed:", emailErr);
      // Submission already rejected — log and continue
    }
  }

  return Response.json({ ok: true });
}
