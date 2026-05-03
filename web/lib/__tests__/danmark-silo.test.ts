import { describe, expect, it } from "vitest";
import {
  buildDistinctByLandingPages,
  shouldRedirectMunicipalityToByPage,
} from "@/lib/danmark-silo";

describe("buildDistinctByLandingPages", () => {
  it("uses the expanded by-page count when a known city only exists on municipality level", () => {
    const result = buildDistinctByLandingPages(
      [
        { id: "1", place: "Grindsted", kommune: "Billund" },
        { id: "2", place: "Grindsted", kommune: "Billund" },
        { id: "3", place: null, kommune: "Billund" },
        { id: "4", place: "Sønder Omme", kommune: "Billund" },
        { id: "5", place: "Hejnsvig", kommune: "Billund" },
        { id: "6", place: "Filskov", kommune: "Billund" },
        { id: "7", place: "Vorbasse", kommune: "Billund" },
        { id: "8", place: "Vejle", kommune: "Vejle" },
        { id: "9", place: "Vejle", kommune: "Vejle" },
      ],
      1
    );

    expect(result).toEqual(
      expect.arrayContaining([
        { place: "Billund", count: 7 },
        { place: "Grindsted", count: 2 },
        { place: "Vejle", count: 2 },
      ])
    );
  });

  it("does not add arbitrary municipality-only names to the by universe", () => {
    const result = buildDistinctByLandingPages(
      [
        { id: "1", place: "Assens", kommune: "Assens" },
        { id: "2", place: null, kommune: "Faaborg-Midtfyn" },
      ],
      1
    );

    expect(result).toEqual([{ place: "Assens", count: 1 }]);
  });

  it("matches the by-page union logic instead of the raw place count", () => {
    const result = buildDistinctByLandingPages(
      [
        { id: "1", place: "Billund", kommune: "Billund" },
        { id: "2", place: "Grindsted", kommune: "Billund" },
        { id: "3", place: "Sønder Omme", kommune: "Billund" },
        { id: "4", place: null, kommune: "Billund" },
      ],
      1
    );

    expect(result).toEqual(
      expect.arrayContaining([{ place: "Billund", count: 4 }])
    );
  });

  it("adds København from the same synonym coverage as the search page", () => {
    const result = buildDistinctByLandingPages(
      [
        { id: "1", place: "Kastrup", kommune: "Tårnby" },
        { id: "2", place: "Ballerup", kommune: "Ballerup" },
        { id: "3", place: "Hedehusene", kommune: "Høje-Taastrup" },
        { id: "4", place: "Lyngby", kommune: "Lyngby-Taarbæk" },
        { id: "5", place: "Vallensbæk Landsby", kommune: "Vallensbæk" },
      ],
      1
    );

    expect(result).toEqual(
      expect.arrayContaining([{ place: "København", count: 4 }])
    );
  });

  it("redirects municipality pages when the by page has the exact same shelter set", () => {
    expect(
      shouldRedirectMunicipalityToByPage(
        "Billund",
        [{ id: "1" }, { id: "2" }, { id: "3" }],
        [{ id: "3" }, { id: "2" }, { id: "1" }]
      )
    ).toBe(true);
  });

  it("keeps municipality pages when the by page covers a different shelter set", () => {
    expect(
      shouldRedirectMunicipalityToByPage(
        "Billund",
        [{ id: "1" }, { id: "2" }, { id: "3" }],
        [{ id: "1" }, { id: "2" }]
      )
    ).toBe(false);
  });

  it("keeps non-city municipality pages even when the shelter sets match", () => {
    expect(
      shouldRedirectMunicipalityToByPage(
        "Faaborg-Midtfyn",
        [{ id: "1" }, { id: "2" }],
        [{ id: "2" }, { id: "1" }]
      )
    ).toBe(false);
  });
});
