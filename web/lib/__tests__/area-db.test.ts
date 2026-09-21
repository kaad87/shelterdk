import { describe, it, expect } from "vitest";
import { areaShelterFilter } from "@/lib/area-db";

describe("areaShelterFilter", () => {
  it("bruger area_slug når området ikke har kommuner", () => {
    expect(areaShelterFilter({ slug: "vadehavet", kommuner: null })).toEqual({ column: "area_slug", op: "eq", value: "vadehavet" });
  });
  it("bruger kommune-listen når området er en landsdel (fx Sønderjylland)", () => {
    const kommuner = ["Aabenraa", "Sønderborg", "Tønder", "Haderslev"];
    expect(areaShelterFilter({ slug: "soenderjylland", kommuner })).toEqual({ column: "kommune", op: "in", value: kommuner });
  });
  it("tom kommune-liste falder tilbage til area_slug", () => {
    expect(areaShelterFilter({ slug: "x", kommuner: [] }).op).toBe("eq");
  });
});
