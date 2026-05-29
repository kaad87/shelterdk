import { facetRegionOgImage, size, contentType } from "@/lib/subpage-og";

export { size, contentType };
export const alt = "Shelters med faciliteter i regionen – ShelterDK";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  return facetRegionOgImage("handicap", region);
}
