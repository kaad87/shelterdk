// web/app/api/admin/pending-shelter-submissions/route.ts
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

function isAdmin(request: NextRequest | Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const url = new URL(request.url);
  const query = url.searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shelter_submissions")
    .select(
      "id, type, status, shelter_name, location_text, capacity, description, facilities, booking_url, contact_name, contact_email, source_info, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    if (String(error.message).includes("shelter_submissions")) {
      return Response.json({ submissions: [], setupRequired: true });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ submissions: data ?? [] });
}
