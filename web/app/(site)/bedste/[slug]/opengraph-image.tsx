import { getGuideBySlug } from "@/lib/buying-guides";
import { createEditorialOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/editorial-og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getGuideBySlug(slug);

  return createEditorialOgImage({
    eyebrow: "Testet & scoret af ShelterDK",
    title: data?.guide.title ?? "Bedste outdoor-grej",
    subtitle:
      data?.guide.seo_description ??
      data?.guide.intro ??
      "Vi scorer og rangerer outdoor-grej til shelterture — transparent metode, ærlige plusser og minusser.",
    tag: "Købsguide",
  });
}
