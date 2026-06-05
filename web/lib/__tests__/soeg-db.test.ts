import { describe, expect, it } from "vitest";
import type { Shelter } from "@/types/shelter";
import { prunePlaceOutliersForExactQuery, aggregateUnitAvailability } from "@/lib/soeg-db";

describe("aggregateUnitAvailability (multi-unit pladser)", () => {
  // Solvognen: 6 units, 5 bookede, 1 fri → pladsen er STADIG ledig (delvist).
  it("markerer plads som 'partial' når kun nogle units er bookede", () => {
    const units = [
      { shelter_id: "A", id: "u1" },
      { shelter_id: "A", id: "u2" },
      { shelter_id: "A", id: "u3" },
      { shelter_id: "A", id: "u4" },
      { shelter_id: "A", id: "u5" },
      { shelter_id: "A", id: "u6" },
    ];
    const booked = new Set(["u2", "u3", "u4", "u5", "u6"]); // 5 af 6
    const result = aggregateUnitAvailability(units, booked);
    expect(result.get("A")).toBe("partial");
  });

  it("markerer plads som 'booked' kun når ALLE units er bookede", () => {
    const units = [
      { shelter_id: "A", id: "u1" },
      { shelter_id: "A", id: "u2" },
    ];
    expect(aggregateUnitAvailability(units, new Set(["u1", "u2"])).get("A")).toBe("booked");
  });

  it("enkelt-unit plads: 1 booket → 'booked'", () => {
    const units = [{ shelter_id: "S", id: "only" }];
    expect(aggregateUnitAvailability(units, new Set(["only"])).get("S")).toBe("booked");
  });

  it("plads uden bookede units optræder slet ikke i resultatet", () => {
    const units = [
      { shelter_id: "S", id: "a" },
      { shelter_id: "S", id: "b" },
    ];
    expect(aggregateUnitAvailability(units, new Set()).has("S")).toBe(false);
  });

  it("flere pladser samtidig vurderes uafhængigt", () => {
    const units = [
      { shelter_id: "full", id: "f1" },
      { shelter_id: "full", id: "f2" },
      { shelter_id: "some", id: "s1" },
      { shelter_id: "some", id: "s2" },
      { shelter_id: "none", id: "n1" },
    ];
    const booked = new Set(["f1", "f2", "s1"]);
    const result = aggregateUnitAvailability(units, booked);
    expect(result.get("full")).toBe("booked");
    expect(result.get("some")).toBe("partial");
    expect(result.has("none")).toBe(false);
  });

  it("ignorerer units uden shelter_id", () => {
    const units = [{ shelter_id: null, id: "x" }];
    expect(aggregateUnitAvailability(units, new Set(["x"])).size).toBe(0);
  });
});

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
