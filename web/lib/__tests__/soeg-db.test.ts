import { describe, expect, it } from "vitest";
import type { Shelter } from "@/types/shelter";
import { prunePlaceOutliersForExactQuery } from "@/lib/soeg-db";

function mkShelter(
  id: string,
  {
    title,
    place,
    kommune,
    lat,
    lon,
  }: { title: string; place?: string | null; kommune?: string | null; lat: number; lon: number }
): Shelter {
  return {
    id,
    slug: id,
    title,
    place: place ?? null,
    kommune: kommune ?? null,
    region: "Jylland",
    location: `POINT(${lon} ${lat})`,
  } as Shelter;
}

describe("prunePlaceOutliersForExactQuery", () => {
  it("removes obvious place-only outliers far from the dominant search cluster", () => {
    const shelters = [
      mkShelter("1", {
        title: "Shelter ved Morsbøl Søpark",
        place: "Grindsted",
        kommune: "Billund",
        lat: 55.7512,
        lon: 8.8982,
      }),
      mkShelter("2", {
        title: "Shelters ved Tronsøen",
        place: "Grindsted",
        kommune: "Billund",
        lat: 55.7658,
        lon: 8.9248,
      }),
      mkShelter("3", {
        title: "Shelters ved Sønderby Plantage",
        place: "Grindsted",
        kommune: "Billund",
        lat: 55.7429,
        lon: 8.9335,
      }),
      mkShelter("4", {
        title: "Det lille museum ved Hesselhogaard",
        place: "Grindsted",
        kommune: "Varde",
        lat: 55.6406,
        lon: 8.8519,
      }),
      mkShelter("5", {
        title: "Hammer Bakker, Gennem Bakkerne 50E, 9310 Vodskov",
        place: "Grindsted",
        kommune: "Aalborg",
        lat: 57.1373,
        lon: 10.0354,
      }),
    ];

    const result = prunePlaceOutliersForExactQuery(shelters, "Grindsted");

    expect(result.map((shelter) => shelter.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("keeps broad municipality-area matches for queries like Billund", () => {
    const shelters = [
      mkShelter("1", {
        title: "Shelter ved Morsbøl Søpark",
        place: "Grindsted",
        kommune: "Billund",
        lat: 55.7512,
        lon: 8.8982,
      }),
      mkShelter("2", {
        title: "Shelter i Hejnsvig",
        place: "Hejnsvig",
        kommune: "Billund",
        lat: 55.671,
        lon: 8.931,
      }),
      mkShelter("3", {
        title: "Shelter i Filskov",
        place: "Filskov",
        kommune: "Billund",
        lat: 55.804,
        lon: 9.021,
      }),
      mkShelter("4", {
        title: "Shelter nær Billund Lufthavn",
        place: "Billund",
        kommune: "Billund",
        lat: 55.741,
        lon: 9.151,
      }),
    ];

    const result = prunePlaceOutliersForExactQuery(shelters, "Billund");

    expect(result.map((shelter) => shelter.id)).toEqual(["1", "2", "3", "4"]);
  });
});
