import { redirect } from "next/navigation";
import { getAreaBySlug } from "@/lib/area-db";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Omdiriger til kort/liste-siden for området. */
export default async function OmraadeSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const area = await getAreaBySlug(slug);
  if (!area) redirect("/soeg");
  redirect(`/soeg?area=${encodeURIComponent(slug)}`);
}
