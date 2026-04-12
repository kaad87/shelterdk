import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { AdminCategoryMapping } from "@/components/AdminCategoryMapping";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

interface Row {
  retailer: string;
  category_raw: string;
  category_mapped: string | null;
  whitelisted: boolean;
}

export default async function AdminKategorierPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await supabase
    .from("affiliate_category_mapping")
    .select("retailer, category_raw, category_mapped, whitelisted")
    .order("category_mapped", { ascending: true, nullsFirst: false })
    .order("retailer")
    .order("category_raw");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 text-sm text-primary/60">
        <Link href="/admin" className="hover:text-accent">
          Admin
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin/produkter" className="hover:text-accent">
          Produkter
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-primary">Kategorier</span>
      </nav>
      <h1 className="mb-6 font-serif text-2xl font-bold text-primary">
        Kategori-mapping
      </h1>
      <AdminCategoryMapping rows={(data ?? []) as Row[]} />
    </div>
  );
}
