// app/api/turvenner/[slug]/report/route.ts
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

// Auto-remove threshold — requires many unique IPs before removing
const AUTO_REMOVE_THRESHOLD = 10;

/**
 * POST /api/turvenner/[slug]/report
 * Basic IP deduplication: one report per IP per post to prevent abuse.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const supabase = createAdminClient();

  // Extract IP for deduplication
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const { data: post, error: fetchError } = await supabase
    .from("trip_posts")
    .select("id, report_count, reported_by_ips")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (fetchError || !post) {
    return Response.json({ error: "Opslag ikke fundet." }, { status: 404 });
  }

  // Prevent same IP from reporting multiple times
  const reportedIps: string[] = post.reported_by_ips ?? [];
  if (ip !== "unknown" && reportedIps.includes(ip)) {
    return Response.json({ ok: true, message: "Tak for din rapportering." });
  }

  const newIps = ip !== "unknown" ? [...reportedIps, ip] : reportedIps;
  const newCount = (post.report_count || 0) + 1;
  const newStatus = newCount >= AUTO_REMOVE_THRESHOLD ? "removed" : "active";

  await supabase
    .from("trip_posts")
    .update({ report_count: newCount, status: newStatus, reported_by_ips: newIps })
    .eq("id", post.id);

  return Response.json({ ok: true, message: "Tak for din rapportering." });
}
