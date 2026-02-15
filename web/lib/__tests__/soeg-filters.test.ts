import { describe, it, expect } from "vitest";
import { filterSheltersByRegion } from "../soeg-filters";
import type { Shelter } from "@/types/shelter";

function mk(id: string, region: string | null): Shelter {
  return {
    id,
    title: `Shelter ${id}`,
    slug: `shelter-${id}`,
    description: null,
    location: null,
    image_url: null,
    google_rating: null,
    google_user_ratings_total: null,
    booking_url: null,
    duplicate_of_shelter_id: null,
    region,
  } as Shelter;
}

describe("filterSheltersByRegion", () => {
  it("returnerer alle shelters når region er null/undefined/tom", () => {
    const list = [mk("1", "Jylland"), mk("2", "Sjælland"), mk("3", "Fyn")];
    expect(filterSheltersByRegion(list, null)).toEqual(list);
    expect(filterSheltersByRegion(list, undefined)).toEqual(list);
    expect(filterSheltersByRegion(list, "")).toEqual(list);
    expect(filterSheltersByRegion(list, "   ")).toEqual(list);
  });

  it("filtrerer til kun Jylland-shelters", () => {
    const list = [
      mk("1", "Jylland"),
      mk("2", "Sjælland"),
      mk("3", "Jylland"),
      mk("4", "Fyn"),
    ];
    expect(filterSheltersByRegion(list, "Jylland")).toEqual([
      mk("1", "Jylland"),
      mk("3", "Jylland"),
    ]);
  });

  it("matcher region case-sensitivt", () => {
    const list = [mk("1", "Jylland"), mk("2", "jylland")];
    expect(filterSheltersByRegion(list, "Jylland")).toEqual([mk("1", "Jylland")]);
  });

  it("trimmer region og shelter.region", () => {
    const list = [mk("1", "  Jylland  "), mk("2", "Sjælland")];
    expect(filterSheltersByRegion(list, "  Jylland  ")).toEqual([
      mk("1", "  Jylland  "),
    ]);
  });

  it("returnerer tom array når ingen matcher", () => {
    const list = [mk("1", "Sjælland"), mk("2", "Fyn")];
    expect(filterSheltersByRegion(list, "Jylland")).toEqual([]);
  });

  it("håndterer shelter med region null", () => {
    const list = [mk("1", "Jylland"), mk("2", null)];
    expect(filterSheltersByRegion(list, "Jylland")).toEqual([mk("1", "Jylland")]);
  });
});
