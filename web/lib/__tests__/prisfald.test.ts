import { describe, it, expect } from "vitest";
import { findPrisfald, medPrisfald, kortDato, type Prispunkt } from "../prisfald";

const IDAG = "2026-11-16";
const p = (observeret: string, price: number): Prispunkt => ({ observeret, price });

describe("findPrisfald", () => {
  it("finder faldet og daterer det til den dag den nuvaerende pris begyndte", () => {
    // Maalt 16/11 2026: Trangia 25-3 hos backpackerlife.
    const fald = findPrisfald([p("2026-11-02", 739), p("2026-11-14", 495)], 495, IDAG);
    expect(fald).toEqual({ foer: 739, nu: 495, pct: 33, siden: "2026-11-14" });
  });

  it("giver intet fald naar prisen aldrig har roert sig", () => {
    // Det er hele pointen: feedet kan paastaa 70 % rabat paa en vare, hvis
    // pris har staaet stille i al den tid vi har kigget.
    expect(findPrisfald([p("2026-11-02", 251.95)], 251.95, IDAG)).toBeNull();
  });

  it("giver intet fald uden historik", () => {
    expect(findPrisfald([], 495, IDAG)).toBeNull();
  });

  it("lader sig ikke narre af en prisstigning lige foer faldet", () => {
    // 500 -> 700 -> 500 er ikke et tilbud. Referencen er den LAVESTE pris i
    // vinduet foer faldet, ikke den seneste.
    const serie = [p("2026-11-02", 500), p("2026-11-10", 700), p("2026-11-14", 500)];
    expect(findPrisfald(serie, 500, IDAG)).toBeNull();
  });

  it("maaler et trinvist fald mod det laveste trin, ikke mod toppen", () => {
    const serie = [p("2026-11-02", 739), p("2026-11-08", 595), p("2026-11-14", 495)];
    expect(findPrisfald(serie, 495, IDAG)).toMatchObject({ foer: 595, pct: 17, siden: "2026-11-14" });
  });

  it("tier naar historikken er bagud i forhold til varens pris", () => {
    // Prishistorikken skrives defensivt i synken og kan mangle en dag. Saa
    // kan faldet ikke dateres, og en udateret paastand er ingen paastand.
    expect(findPrisfald([p("2026-11-02", 739), p("2026-11-14", 495)], 449, IDAG)).toBeNull();
  });

  it("kraever at vi har set varen nogle dage foer faldet", () => {
    // En vare der kommer ind i kataloget til 899 og falder til 299 dagen
    // efter, har vi ikke grundlag for at kalde nedsat.
    expect(findPrisfald([p("2026-11-13", 899), p("2026-11-14", 299)], 299, IDAG)).toBeNull();
    expect(findPrisfald([p("2026-11-11", 899), p("2026-11-14", 299)], 299, IDAG)).not.toBeNull();
  });

  it("holder op med at kalde det et fald, naar prisen har staaet i over 30 dage", () => {
    const serie = [p("2026-11-02", 739), p("2026-11-14", 495)];
    expect(findPrisfald(serie, 495, "2026-12-14")).not.toBeNull();
    expect(findPrisfald(serie, 495, "2026-12-15")).toBeNull();
  });

  it("ser kun 30 dage tilbage fra faldet, men husker prisen der gjaldt ved vinduets start", () => {
    // Historikken logger kun aendringer. Prisen 400 fra august gjaldt stadig
    // 30 dage foer faldet og er derfor referencen; 300 fra juni gjaldt ikke
    // laengere og maa ikke traekke referencen ned.
    const serie = [
      p("2026-06-01", 300),
      p("2026-08-01", 400),
      p("2026-11-14", 320),
    ];
    expect(findPrisfald(serie, 320, IDAG)).toMatchObject({ foer: 400, pct: 20 });
  });

  it("ignorerer fald under 5 %", () => {
    expect(findPrisfald([p("2026-11-02", 500), p("2026-11-14", 480)], 480, IDAG)).toBeNull();
    expect(findPrisfald([p("2026-11-02", 500), p("2026-11-14", 475)], 475, IDAG)).toMatchObject({ pct: 5 });
  });

  it("er ligeglad med raekkefoelgen den faar serien i", () => {
    const fald = findPrisfald([p("2026-11-14", 495), p("2026-11-02", 739)], 495, IDAG);
    expect(fald).toMatchObject({ foer: 739, siden: "2026-11-14" });
  });

  it("taeller ikke oerestoej som en prisaendring", () => {
    // 495 og 495,00 fra to synk er samme pris; faldet begyndte den 14.
    const serie = [p("2026-11-02", 739), p("2026-11-14", 495), p("2026-11-15", 495.2)];
    expect(findPrisfald(serie, 495.2, IDAG)).toMatchObject({ siden: "2026-11-14" });
  });
});

describe("medPrisfald", () => {
  const vare = { id: "x", price: 495, price_original: 837.95, discount_pct: 41 };

  it("erstatter feedets foer-pris med vores egen reference", () => {
    const ud = medPrisfald(vare, { foer: 739, nu: 495, pct: 33, siden: "2026-11-14" });
    expect(ud.price_original).toBe(739);
    expect(ud.discount_pct).toBe(33);
    expect(ud.prisfald?.siden).toBe("2026-11-14");
  });

  it("fjerner feedets rabat helt, naar vi ikke selv har set et fald", () => {
    const ud = medPrisfald(vare, null);
    expect(ud.price_original).toBeNull();
    expect(ud.discount_pct).toBeNull();
    expect(ud.prisfald).toBeNull();
  });
});

describe("kortDato", () => {
  it("skriver datoen paa dansk uden aarstal", () => {
    expect(kortDato("2026-11-14")).toBe("14. nov.");
    expect(kortDato("2026-05-02")).toBe("2. maj");
  });
});
