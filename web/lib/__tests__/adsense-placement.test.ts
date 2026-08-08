import { describe, it, expect } from "vitest";
import { showInFeedAdAt, inFeedAdIndex } from "../adsense";

/** Hvilke shelter-indeks får en annonce indsat før sig i en liste med `total` kort. */
function adPositions(total: number): number[] {
  return Array.from({ length: total }, (_, i) => i).filter((i) => showInFeedAdAt(i, total));
}

/**
 * Annoncens faktiske plads blandt grid'ets børn. Annoncerne optager selv en
 * plads, så den n'te annonce står `n` felter længere fremme end sit shelter-indeks.
 */
function adGridSlots(total: number): number[] {
  return adPositions(total).map((shelterIndex, n) => shelterIndex + n);
}

describe("showInFeedAdAt", () => {
  it("placerer første annonce efter 4 kort, ikke 6", () => {
    // Aug 2026: flyttet fra 6 til 4. På mobil er grid'et én kolonne, så plads 6
    // lå ~1.800 px nede — in-feed-enheden målte 11,89 % viewability mod
    // bannerets 36,99 %.
    expect(adPositions(60)[0]).toBe(4);
  });

  it("holder loftet på 3 annoncer uanset listelængde", () => {
    expect(adPositions(60)).toEqual([4, 9, 14]);
    expect(adPositions(500)).toHaveLength(3);
  });

  it("lander på LIGE grid-pladser, ellers opstår der huller i 2-kolonners grids", () => {
    // Regression, to runder. Er kolonnen smallere end 250 px spænder annoncen
    // over hele rækken, og et 2-kolonners element kan ikke starte midt i en
    // række — det skubbes ned og efterlader et tomt felt hvor der skulle have
    // været et shelter-kort (set på /by/billund).
    //
    // Første forsøg var start 3: hul med det samme. Andet forsøg var start 4 med
    // interval 6, som så rigtigt ud for første annonce men flyttede hullet til
    // nummer to — for annoncerne optager SELV en plads, så den n'te annonce står
    // på grid-plads shelterIndex + n. Derfor måles pariteten på grid-pladsen.
    expect(adGridSlots(60)).toEqual([4, 10, 16]);
    for (const total of [10, 16, 20, 60, 200]) {
      for (const slot of adGridSlots(total)) {
        expect(slot % 2).toBe(0);
      }
    }
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

  it("holder alle tre annoncer inden for de første 15 kort", () => {
    // Hele pointen med at flytte dem op: annoncer længere nede end det bliver
    // ikke set. In-feed-enheden målte 11,89 % viewability med start på plads 6.
    expect(Math.max(...adPositions(200))).toBeLessThanOrEqual(15);
  });
});
