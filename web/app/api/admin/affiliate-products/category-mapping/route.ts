import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function PUT(request: NextRequest) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { retailer, category_raw, category_mapped, whitelisted } =
    await request.json();
  if (typeof retailer !== "string" || typeof category_raw !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { error } = await supabase
    .from("affiliate_category_mapping")
    .update({
      category_mapped: category_mapped || null,
      whitelisted: !!whitelisted,
      updated_at: new Date().toISOString(),
    })
    .eq("retailer", retailer)
    .eq("category_raw", category_raw);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
