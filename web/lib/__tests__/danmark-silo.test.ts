import { describe, expect, it } from "vitest";
import { buildDistinctByLandingPages } from "@/lib/danmark-silo";

describe("buildDistinctByLandingPages", () => {
  it("adds Billund from municipality counts even when no exact place rows exist", () => {
    const result = buildDistinctByLandingPages(
      [
        { place: "Grindsted", count: 7 },
        { place: "Vejle", count: 5 },
      ],
      [
        { kommune: "Billund", count: 17 },
        { kommune: "Vejle", count: 12 },
      ],
      1
    );

    expect(result).toEqual(
      expect.arrayContaining([
        { place: "Billund", count: 17 },
        { place: "Grindsted", count: 7 },
        { place: "Vejle", count: 12 },
      ])
    );
  });

  it("does not add arbitrary municipality-only names to the by universe", () => {
    const result = buildDistinctByLandingPages(
      [{ place: "Grindsted", count: 7 }],
      [{ kommune: "Faaborg-Midtfyn", count: 9 }],
      1
    );

    expect(result).toEqual([{ place: "Grindsted", count: 7 }]);
  });
});
