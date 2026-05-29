import { areaOgImage, size, contentType } from "@/lib/subpage-og";

export { size, contentType };
export const alt = "Shelters i området – ShelterDK";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return areaOgImage(slug);
}
