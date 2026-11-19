import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { showInFeedAdAt, inFeedAdIndex } from "../adsense";

const WEB_ROOT = path.resolve(__dirname, "..", "..");

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
  it("placerer første plads som kort nummer 2", () => {
    // Nov 2026: flyttet fra 4 til 1. Affiliate-kortet paa plads 5 blev set 172
    // gange paa ti dage; de fleste scroller ikke saa langt. Aug 2026 var det
    // flyttet fra 6 til 4 af samme grund (11,89 % viewability paa plads 6).
    expect(adPositions(60)[0]).toBe(1);
  });

  it("holder loftet på 3 annoncer uanset listelængde", () => {
    expect(adPositions(60)).toEqual([1, 6, 11]);
    expect(adPositions(500)).toHaveLength(3);
  });

  it("lander paa ulige grid-pladser, og det er gitrenes dense-flow der forhindrer huller", () => {
    // Foer 13/11 2026 skulle pladserne staa paa LIGE celler, ellers efterlod
    // en AdSense-blok i fuld bredde et hul i 2-kolonners gitre. Siden har alle
    // gitre grid-flow-row-dense (testen nedenfor), og saa udfylder det naeste
    // kort hullet. Den test er nu det der beskytter layoutet, ikke pariteten.
    expect(adGridSlots(60)).toEqual([1, 7, 13]);
  });

  it("viser ingen annoncer i korte lister", () => {
    expect(adPositions(4)).toEqual([]);
    expect(adPositions(0)).toEqual([]);
    expect(adPositions(5)).toEqual([1]);
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

describe("gitre med in-feed-annoncer taaler et element i fuld bredde", () => {
  // <AdInFeed> udvider sig til col-span-full naar kolonnen er under
  // AD_MIN_WIDTH. Lander udvidelsen paa en ulige celle, rykker browseren den
  // ned til naeste raekkestart og efterlader et hul ved siden af det
  // foregaaende kort. Beslutningen traeffes af en maaling i browseren, saa
  // hverken pladsens nummer eller hullet kan beregnes serverside: det kan kun
  // undgaas med dense i gitteret.
  //
  // Testen laeser kilden, fordi jsdom ikke layouter grid og derfor ikke kan
  // se hullet. Den fanger det der faktisk gaar galt: at et NYT gitter
  // tilfoejes uden klassen.
  const DENSE = "grid-flow-row-dense";

  function gitreMedInFeedSlot(): { fil: string; linje: number; klasser: string }[] {
    const rod = WEB_ROOT;
    const fundet: { fil: string; linje: number; klasser: string }[] = [];
    const gaa = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        // __tests__ springes over: en komponenttest rendrer pladsen alene,
        // uden et gitter, og det er ikke et layout nogen besoegende ser.
        if (e.name === "node_modules" || e.name === ".next" || e.name === "__tests__" || e.name.startsWith(".")) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { gaa(p); continue; }
        if (!e.name.endsWith(".tsx")) continue;
        const kilde = readFileSync(p, "utf8");
        // Kun filer der faktisk RENDRER pladsen. Uden importkravet ville en
        // omtale af <InFeedSlot> i en kommentar (fx i AdInFeed) taelle med.
        if (!kilde.includes('from "@/components/InFeedSlot"')) continue;
        const linjer = kilde.split("\n");
        const maal = new Set<number>();
        linjer.forEach((l, n) => {
          if (!l.includes("<InFeedSlot")) return;
          for (let i = n; i >= Math.max(0, n - 15); i--) {
            if (linjer[i].includes("grid-cols")) { maal.add(i); return; }
          }
          throw new Error(`${p}:${n + 1} rendrer <InFeedSlot> uden et gitter over sig`);
        });
        for (const i of maal) {
          fundet.push({ fil: path.relative(rod, p), linje: i + 1, klasser: linjer[i].trim() });
        }
      }
    };
    gaa(path.join(rod, "app"));
    gaa(path.join(rod, "components"));
    return fundet;
  }

  it("findes der overhovedet nogen at tjekke", () => {
    // Uden den her ville testen bestaa tavst hvis soegningen holdt op med at
    // finde noget, fx efter en omlaegning af mappestrukturen.
    expect(gitreMedInFeedSlot().length).toBeGreaterThanOrEqual(15);
  });

  it("har dense paa hvert eneste af dem", () => {
    const uden = gitreMedInFeedSlot().filter((g) => !g.klasser.includes(DENSE));
    expect(uden.map((g) => `${g.fil}:${g.linje}`)).toEqual([]);
  });
});
