import {
  getByLandingData,
  getDistinctByLandingPages,
} from "@/lib/danmark-silo";
import { segmentSlugToName } from "@/lib/slug";
import { createEditorialOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/editorial-og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Shelter i en dansk by – ShelterDK";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ by_slug: string }>;
}) {
  const { by_slug } = await params;
  const places = await getDistinctByLandingPages(1);
  const placeName = segmentSlugToName(by_slug, places.map((p) => p.place));

  // If the slug doesn't resolve to a known city, render a generic by-page
  // OG card rather than 404'ing — social crawlers don't always respect 404.
  if (!placeName) {
    return createEditorialOgImage({
      eyebrow: "Byer i Danmark",
      title: "Shelter ved danske byer",
      subtitle: "Find shelters tæt på din by – kort, faciliteter og booking.",
      tag: "ShelterDK",
    });
  }

  const { shelters, usesMunicipalityExpansion } = await getByLandingData(placeName);
  const count = shelters.length;
  const bookable = shelters.filter(
    (s) => !!s.booking_url && String(s.booking_url).trim() !== ""
  ).length;
  const free = count - bookable;

  const subtitleParts: string[] = [];
  if (count > 0) subtitleParts.push(`${count} shelter${count !== 1 ? "s" : ""}`);
  if (bookable > 0) subtitleParts.push(`${bookable} kan bookes`);
  if (free > 0) subtitleParts.push(`${free} gratis`);
  const subtitle =
    subtitleParts.length > 0
      ? subtitleParts.join(" · ")
      : `Find shelter ${usesMunicipalityExpansion ? `i og omkring ${placeName}` : `i ${placeName}`}`;

  return createEditorialOgImage({
    eyebrow: usesMunicipalityExpansion ? `I og omkring ${placeName}` : `By · ${placeName}`,
    title: `Shelter i ${placeName}`,
    subtitle,
    tag: "ShelterDK",
  });
}
