import type { Shelter } from "@/types/shelter";

/**
 * De felter ShelterMap faktisk bruger. Server-sider skal sende denne slanke
 * form i stedet for fulde Shelter-objekter — alt andet (description,
 * image_urls, google_places m.m.) serialiseres ellers med i RSC-payloaden
 * og kan gøre facetsiderne flere hundrede KB tungere.
 */
export type MapShelter = Pick<
  Shelter,
  "id" | "slug" | "title" | "region" | "kommune" | "image_url" | "location"
>;

export function toMapShelters(shelters: Shelter[]): MapShelter[] {
  return shelters.map(({ id, slug, title, region, kommune, image_url, location }) => ({
    id,
    slug,
    title,
    region,
    kommune,
    image_url,
    location,
  }));
}
