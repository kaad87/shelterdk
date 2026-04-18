import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

function isAdmin(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-admin-secret");
  const query = new URL(request.url).searchParams.get("secret");
  return (header === secret || query === secret) && secret.length > 0;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shelter_experiences")
    .select("id, shelter_id, author_name, body, photo_urls, cover_photo_index, status, created_at, shelter:shelters(title, slug)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    if (String(error.message).includes("shelter_experiences")) {
      return Response.json({ experiences: [], setupRequired: true });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ experiences: data ?? [] });
}
