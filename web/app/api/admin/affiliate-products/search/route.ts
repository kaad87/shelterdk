import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * GET — ?q=&categories= : søg produkter i feed'et (til at bygge guide-entries).
 *
 * `categories` er en komma-liste af affiliate_products.category_mapped-værdier
 * og kommer fra buying_guides.product_categories.
 *
 * Før filtrerede ruten på `category`, som admin sendte fra buying_guides.category
 * — et felt, der er guidens egen etiket og ikke en kategori i kataloget. For 7
 * af 46 udgivne guider ramte det nul varer ("campingstol" findes som
 * "campingmobler", "stormkoekken" som "kogeudstyr", "drybag" som "taske"), så
 * kategorifiltret gav en tom liste, uanset hvad der lå i basen. Det var præcis
 * den fejl, migration 059 oprettede product_categories for at løse, men
 * kolonnen blev aldrig læst af noget.
 *
 * `category` tages fortsat imod, så en gammel klient ikke går i stykker.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const kategorier = (url.searchParams.get("categories") ?? url.searchParams.get("category") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  let query = sb
    .from("affiliate_products")
    .select("id, product_name, brand, retailer, price, category_mapped, in_stock, is_blocked, specs")
    .eq("is_blocked", false)
    .limit(40);
  if (kategorier.length === 1) query = query.eq("category_mapped", kategorier[0]);
  else if (kategorier.length > 1) query = query.in("category_mapped", kategorier);
  if (q) query = query.ilike("product_name", `%${q.replace(/[%]/g, "")}%`);
  query = query.order("product_name", { ascending: true });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}
