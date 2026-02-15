/**
 * Debug-API: tjek om et shelter findes i DB.
 * Kun til development – kan fjernes i prod.
 * GET /api/debug/shelter/shelters-ved-gyldendal-havn-87118
 */
import { NextResponse } from "next/server";
import { createPublicClient } from "@/utils/supabase/server-public";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = createPublicClient();

  const [r1, r2] = await Promise.all([
    supabase
      .from("shelters")
      .select("id, title, slug, region, kommune, duplicate_of_shelter_id")
      .eq("slug", slug)
      .is("duplicate_of_shelter_id", null)
      .maybeSingle(),
    supabase
      .from("shelters")
      .select("id, title, slug, region, kommune, duplicate_of_shelter_id")
      .eq("slug", slug)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    slug,
    canonical: r1.data,
    any: r2.data,
    errors: { canonical: r1.error, any: r2.error },
  });
}
