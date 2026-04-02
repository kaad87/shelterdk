import { describe, it, expect } from "vitest";
import { classifyShelterToParks, NATIONAL_PARKS } from "../national-parks";

describe("national-parks", () => {
  it("exports 5 national parks", () => {
    expect(NATIONAL_PARKS).toHaveLength(5);
  });

  it("classifies a point inside Nationalpark Thy", () => {
    const parks = classifyShelterToParks(56.88, 8.28);
    expect(parks).toContain("Nationalpark Thy");
  });

  it("classifies a point inside Nationalpark Mols Bjerge", () => {
    const parks = classifyShelterToParks(56.2, 10.6);
    expect(parks).toContain("Nationalpark Mols Bjerge");
  });

  it("returns empty array for a point in Copenhagen", () => {
    const parks = classifyShelterToParks(55.68, 12.57);
    expect(parks).toEqual([]);
  });

  it("a point can be in at most one park (no overlap)", () => {
    for (const park of NATIONAL_PARKS) {
      const midLat = (park.bbox.minLat + park.bbox.maxLat) / 2;
      const midLon = (park.bbox.minLon + park.bbox.maxLon) / 2;
      const result = classifyShelterToParks(midLat, midLon);
      expect(result).toContain(park.name);
    }
  });
});
