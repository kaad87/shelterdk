import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { AdminProducts } from "@/components/AdminProducts";
import type { AdminProduct } from "@/components/AdminProductRow";
import { AdminSyncStatusBar } from "@/components/AdminSyncStatusBar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { absolute: "Admin – Produkter | ShelterDK" },
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    retailer?: string;
    category?: string;
    minDiscount?: string;
    onlyInStock?: string;
    onlyBlocked?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 25;

async function fetchFilteredProducts(
  params: Awaited<PageProps["searchParams"]>
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const page = parseInt(params.page ?? "1", 10);
  const offset = (page - 1) * PAGE_SIZE;

  let q = supabase
    .from("affiliate_products")
    .select(
      "id, retailer, brand, product_name, price, price_original, discount_pct, image_url, category_mapped, in_stock, is_blocked",
      { count: "exact" }
    );

  if (params.q) {
    q = q.textSearch("product_name", params.q.split(/\s+/).join(" & "), {
      type: "websearch",
      config: "danish",
    });
  }
  if (params.retailer) q = q.eq("retailer", params.retailer);
  if (params.category) q = q.eq("category_mapped", params.category);
  if (params.minDiscount)
    q = q.gte("discount_pct", parseInt(params.minDiscount, 10));
  if (params.onlyInStock === "1") q = q.eq("in_stock", true);
  if (params.onlyBlocked === "1") q = q.eq("is_blocked", true);

  q = q
    .order("discount_pct", { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const { data, count } = await q;
  return {
    rows: (data as AdminProduct[]) ?? [],
    totalCount: count ?? 0,
    page,
  };
}

export default async function AdminProduktPage(props: PageProps) {
  const params = await props.searchParams;
  const { rows, totalCount, page } = await fetchFilteredProducts(params);
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-4 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent">
          Hjem
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="hover:text-accent">
          Admin
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Produkter</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-primary">
          Produkter ({totalCount.toLocaleString("da-DK")})
        </h1>
        <AdminSyncStatusBar />
      </div>

      <AdminProducts
        initialRows={rows}
        totalCount={totalCount}
        currentPage={page}
        pageCount={pageCount}
      />

      <div className="mt-6">
        <Link
          href="/admin/produkter/kategorier"
          className="text-sm text-accent underline"
        >
          → Kategori-mapping
        </Link>
      </div>
    </div>
  );
}
