import { createEditorialOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/editorial-og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return createEditorialOgImage({
    eyebrow: "ShelterDK Guides",
    title: "Guides til shelters og naturovernatning",
    subtitle:
      "Praktiske guides til regler, udstyr, pakkelister og planlægning af gode shelterture i Danmark.",
    tag: "Guides",
  });
}
