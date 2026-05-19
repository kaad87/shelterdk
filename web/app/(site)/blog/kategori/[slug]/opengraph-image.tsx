import { getBlogCategories, type BlogCategory } from "@/data/blog";
import { createEditorialOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/editorial-og";
import { slugifySegment } from "@/lib/slug";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const CATEGORY_SUBTITLES: Record<BlogCategory, string> = {
  Guides: "Forklarende og praktiske artikler om shelters, booking, regler og planlægning.",
  Sæson: "Sæsonartikler om forår, sommer, efterår og vinter med fokus på vejr, stemning og timing.",
  Tips: "Praktiske tips til at finde det rigtige shelter og få mere ud af turen i naturen.",
  Udstyr: "Udstyrsanbefalinger og pakketips til shelterture, så du ved hvad der er værd at tage med.",
  Inspiration: "Inspiration til gode destinationer, naturoplevelser og ideer til næste sheltertur.",
};

function getCategoryBySlug(slug: string): BlogCategory | undefined {
  return getBlogCategories().find((category) => slugifySegment(category) === slug);
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  return createEditorialOgImage({
    eyebrow: "ShelterDK Blogkategori",
    title: category ? `Blog om ${category.toLowerCase()}` : "ShelterDK Blog",
    subtitle: category ? CATEGORY_SUBTITLES[category] : "Tips og inspiration til shelterture og naturovernatning.",
    tag: category ?? "Blog",
  });
}
