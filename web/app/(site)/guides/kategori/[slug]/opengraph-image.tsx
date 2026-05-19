import { getGuideCategories, type GuideCategory } from "@/data/guides";
import { createEditorialOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/editorial-og";
import { slugifySegment } from "@/lib/slug";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const CATEGORY_SUBTITLES: Record<GuideCategory, string> = {
  Pakkeliste: "Tjeklister og pakkelister til shelterture, så du har styr på udstyr og de små detaljer.",
  Regler: "Få overblik over regler for shelter, booking, teltning og god adfærd i dansk natur.",
  Begynder: "Begynderguides til valg af shelter, planlægning og tryg første overnatning i det fri.",
  Mad: "Nemme ideer til mad over bål og måltider, der fungerer på sheltertur.",
  Vinter: "Råd om vinterovernatning, varme og sikkerhed på kolde shelterture.",
  Udstyr: "Guides til sovegrej, beklædning og udstyr, der giver en bedre tur i naturen.",
  Natur: "Inspiration til naturområder, landskaber og nationalparker med gode sheltermuligheder.",
};

function getCategoryBySlug(slug: string): GuideCategory | undefined {
  return getGuideCategories().find((category) => slugifySegment(category) === slug);
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  return createEditorialOgImage({
    eyebrow: "ShelterDK Guidekategori",
    title: category ? `Guides om ${category.toLowerCase()}` : "Guides til shelters og naturovernatning",
    subtitle: category ? CATEGORY_SUBTITLES[category] : "Praktiske guides til shelters, natur og turplanlægning.",
    tag: category ?? "Guides",
  });
}
