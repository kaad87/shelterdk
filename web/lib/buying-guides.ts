import { createClient } from "@supabase/supabase-js";
import type { AffiliateProduct } from "@/lib/affiliate-products";

function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export interface BuyingGuide {
  id: string;
  slug: string;
  title: string;
  category: string;
  intro: string | null;
  body_md: string | null;
  sources: { title: string; url: string }[] | null;
  faq: { q: string; a: string }[] | null;
  seo_title: string | null;
  seo_description: string | null;
  hero_image_url: string | null;
  status: "draft" | "published";
  last_reviewed_at: string | null;
  author: string | null;
  updated_at: string;
}

export interface GuideEntryWithProduct {
  id: string;
  rank: number;
  award_label: string | null;
  editorial_note: string;
  pros: string[];
  cons: string[];
  score: number | null;
  best_for: string | null;
  product: AffiliateProduct & { specs?: Record<string, unknown> | null };
}

/** Sortér entries efter rank; demotér udsolgte/blokerede til bunden (behold dem). */
export function rankGuideEntries(entries: GuideEntryWithProduct[]): GuideEntryWithProduct[] {
  const available = (e: GuideEntryWithProduct) => e.product.in_stock && !e.product.is_blocked;
  return [...entries].sort((a, b) => {
    const av = available(a) ? 0 : 1;
    const bv = available(b) ? 0 : 1;
    if (av !== bv) return av - bv;
    return a.rank - b.rank;
  });
}

const PRODUCT_COLS =
  "id, retailer, brand, product_name, description, category_mapped, price, price_original, discount_pct, in_stock, stock_count, image_url, affiliate_url, is_blocked, specs";

export async function getPublishedGuides(): Promise<BuyingGuide[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("buying_guides")
    .select("*")
    .eq("status", "published")
    .order("updated_at", { ascending: false });
  return (data as BuyingGuide[]) ?? [];
}

export async function getPublishedGuideSlugs(): Promise<string[]> {
  return (await getPublishedGuides()).map((g) => g.slug);
}

export async function getGuideBySlug(
  slug: string
): Promise<{ guide: BuyingGuide; entries: GuideEntryWithProduct[] } | null> {
  const sb = getServiceClient();
  const { data: guide } = await sb
    .from("buying_guides")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!guide) return null;

  const { data: rawEntries } = await sb
    .from("buying_guide_entries")
    .select("id, rank, award_label, editorial_note, pros, cons, score, best_for, affiliate_product_id")
    .eq("guide_id", guide.id);

  const ids = (rawEntries ?? []).map((e) => e.affiliate_product_id as string);
  if (ids.length === 0) return { guide: guide as BuyingGuide, entries: [] };

  const { data: products } = await sb.from("affiliate_products").select(PRODUCT_COLS).in("id", ids);
  const byId = new Map(((products ?? []) as GuideEntryWithProduct["product"][]).map((p) => [p.id, p]));

  const entries: GuideEntryWithProduct[] = (rawEntries ?? [])
    .map((e) => {
      const product = byId.get(e.affiliate_product_id as string);
      if (!product) return null;
      return {
        id: e.id as string,
        rank: e.rank as number,
        award_label: (e.award_label as string | null) ?? null,
        editorial_note: (e.editorial_note as string | null) ?? "",
        pros: (e.pros as string[] | null) ?? [],
        cons: (e.cons as string[] | null) ?? [],
        score: (e.score as number | null) ?? null,
        best_for: (e.best_for as string | null) ?? null,
        product,
      } satisfies GuideEntryWithProduct;
    })
    .filter((e): e is GuideEntryWithProduct => e !== null);

  return { guide: guide as BuyingGuide, entries: rankGuideEntries(entries) };
}
