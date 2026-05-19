import { createEditorialOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/editorial-og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return createEditorialOgImage({
    eyebrow: "ShelterDK Blog",
    title: "Blog om shelters, friluftsliv og naturovernatning",
    subtitle:
      "Tips, inspiration og redaktionelle indlæg om shelterture, årstider, udstyr og oplevelser i naturen.",
    tag: "Blog",
  });
}
