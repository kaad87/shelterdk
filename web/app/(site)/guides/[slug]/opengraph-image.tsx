import { getGuideBySlug } from "@/data/guides";
import { createEditorialOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/editorial-og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);

  return createEditorialOgImage({
    eyebrow: "ShelterDK Guide",
    title: guide?.title ?? "Guide til sheltertur",
    subtitle:
      guide?.excerpt ??
      "Praktiske råd og inspiration til naturovernatning, udstyr og planlægning af shelterture.",
    tag: guide?.category ?? "Guide",
  });
}
