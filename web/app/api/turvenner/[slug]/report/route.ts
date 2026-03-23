// app/api/turvenner/[slug]/report/route.ts
import { NextRequest } from "next/server";
import { createPublicClient } from "@/utils/supabase/server-public";

export const dynamic = "force-dynamic";

/**
 * POST /api/turvenner/[slug]/report
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const supabase = createPublicClient();

  const { data: post, error: fetchError } = await supabase
    .from("trip_posts")
    .select("id, report_count")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (fetchError || !post) {
    return Response.json({ error: "Opslag ikke fundet." }, { status: 404 });
  }

  const newCount = (post.report_count || 0) + 1;
  const newStatus = newCount >= 3 ? "removed" : "active";

  await supabase
    .from("trip_posts")
    .update({ report_count: newCount, status: newStatus })
    .eq("id", post.id);

  return Response.json({ ok: true, message: "Tak for din rapportering." });
}
