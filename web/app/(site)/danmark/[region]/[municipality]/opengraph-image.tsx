import { municipalityOgImage, size, contentType } from "@/lib/subpage-og";

export { size, contentType };
export const alt = "Shelters i kommunen – ShelterDK";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ region: string; municipality: string }>;
}) {
  const { region, municipality } = await params;
  return municipalityOgImage(region, municipality);
}
