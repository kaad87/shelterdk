import { describe, it, expect } from "vitest";
import { showInFeedAdAt, inFeedAdIndex } from "../adsense";

/** Hvilke indeks får en annonce i en liste med `total` kort. */
function adPositions(total: number): number[] {
  return Array.from({ length: total }, (_, i) => i).filter((i) => showInFeedAdAt(i, total));
}

describe("showInFeedAdAt", () => {
  it("placerer første annonce efter 3 kort, ikke 6", () => {
    // Aug 2026: flyttet fra 6 til 3. På mobil er grid'et én kolonne, så plads 6
    // lå ~1.800 px nede — in-feed-enheden målte 11,89 % viewability mod
    // bannerets 36,99 %.
    expect(adPositions(60)[0]).toBe(3);
  });

  it("holder loftet på 3 annoncer uanset listelængde", () => {
    expect(adPositions(60)).toEqual([3, 9, 15]);
    expect(adPositions(500)).toHaveLength(3);
  });

  it("viser ingen annoncer i korte lister", () => {
    expect(adPositions(7)).toEqual([]);
    expect(adPositions(0)).toEqual([]);
  });

  it("lader aldrig en annonce stå som sidste eller næstsidste element", () => {
    // Ellers virker den som en footer frem for en del af listen.
    for (const total of [8, 9, 10, 12, 20]) {
      for (const pos of adPositions(total)) {
        expect(total - pos).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("giver stabile, fortløbende numre til React-keys", () => {
    expect(adPositions(60).map(inFeedAdIndex)).toEqual([0, 1, 2]);
  });
});
