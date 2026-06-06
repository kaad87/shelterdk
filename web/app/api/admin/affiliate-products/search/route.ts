import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** GET — ?q=&category= : søg produkter i feed'et (til at bygge guide-entries). */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  let query = sb
    .from("affiliate_products")
    .select("id, product_name, brand, retailer, price, category_mapped, in_stock, is_blocked, specs")
    .eq("is_blocked", false)
    .limit(40);
  if (category) query = query.eq("category_mapped", category);
  if (q) query = query.ilike("product_name", `%${q.replace(/[%]/g, "")}%`);
  query = query.order("product_name", { ascending: true });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}
