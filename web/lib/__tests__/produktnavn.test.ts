import { describe, expect, it } from "vitest";
import { rentNavn, rentMaerke, navnBehoeverHaand } from "../produktnavn";

// Alle navne herunder er rigtige produktnavne fra kataloget 1. november 2026.
// Ingen af dem er opdigtet: udledningen skal maales mod det feedene faktisk
// skriver, ikke mod noget jeg har fundet paa.

describe("rentMaerke", () => {
  it("bruger menneskets rettelse foerst", () => {
    expect(
      rentMaerke({ product_name: "Stol - Treklife Low-back UL Chair", brand: "Noget", display_brand: "Treklife" })
    ).toBe("Treklife");
  });

  it("bruger feedets brand-felt naar det er udfyldt", () => {
    expect(rentMaerke({ product_name: "Deuter First Aid Kit Waterproof Koi", brand: "Deuter" })).toBe("Deuter");
  });

  it("genkender maerket i navnet, naar feedet ikke oplyser det", () => {
    // backpackerlife har brand tomt paa alle 2.101 varer.
    expect(rentMaerke({ product_name: "Stol - Treklife Low-back UL Chair", brand: null })).toBe("Treklife");
    expect(rentMaerke({ product_name: "Pandelampe - Black Diamond Storm 450", brand: null })).toBe("Black Diamond");
    expect(rentMaerke({ product_name: "Dry bag - Sea to Summit Big River - 20 liter", brand: null })).toBe(
      "Sea to Summit"
    );
  });

  it("tager det laengste maerke, ikke det foerste ord", () => {
    // "Black" og "Sea" er ikke maerker. Laengste match skal vinde.
    expect(rentMaerke({ product_name: "Pandelampe - Black Diamond Storm 450", brand: null })).not.toBe("Black");
    expect(rentMaerke({ product_name: "Telt - Sea to Summit Telos TR3 - Grøn", brand: null })).not.toBe("Sea");
  });

  it("genkender ikke for generiske ord som maerke", () => {
    // "Pro" ER et maerke (PRO cykeldele), men \bpro\b rammer modelnavne.
    expect(rentMaerke({ product_name: "Fjällräven Vidda Pro Lite Zip-Off Trousers", brand: null })).not.toBe("Pro");
    expect(rentMaerke({ product_name: "Lundhags Saruk Pro 60 L Regular Long", brand: null })).not.toBe("Pro");
  });

  it("giver null naar der ikke er noget maerke nogen steder", () => {
    expect(rentMaerke({ product_name: "Dry bag - 8 liter", brand: null })).toBeNull();
    expect(rentMaerke({ product_name: "Hue - Mountain - Sort", brand: null })).toBeNull();
  });
});

describe("rentNavn: den strukturelle regel", () => {
  it("dropper feedets typebeskrivelse foran maerket", () => {
    // backpackerlife skriver "Typebeskrivelse - Maerke Model - specs".
    expect(rentNavn({ product_name: "Stol - Treklife Low-back UL Chair", brand: null })).toBe(
      "Treklife Low-back UL Chair"
    );
    expect(rentNavn({ product_name: "Dry bag - Sea to Summit Big River - 20 liter", brand: null })).toBe(
      "Sea to Summit Big River 20 liter"
    );
    expect(rentNavn({ product_name: "Pandelampe - Black Diamond Storm 450", brand: null })).toBe(
      "Black Diamond Storm 450"
    );
  });

  it("virker ogsaa paa typeord der ikke staar i nogen ordliste", () => {
    // Det var hele grunden til at vaelge en strukturel regel: en ordliste
    // manglede straks "Base layer unisex", "Hue med kvast" og "Pandebaand".
    expect(rentNavn({ product_name: "Base layer unisex - Trespass Unite 360", brand: null })).toBe(
      "Trespass Unite 360"
    );
    expect(rentNavn({ product_name: "Hue med kvast - Trespass Kellisa", brand: null })).toBe("Trespass Kellisa");
    expect(rentNavn({ product_name: "Uldunderbukser herre - Ulvang Rav - 100 % merino uld", brand: null })).toBe(
      "Ulvang Rav 100 % merino uld"
    );
  });

  it("rører ikke outmore-formatet, hvor maerket staar foerst", () => {
    expect(
      rentNavn({ product_name: "Black Diamond Storm 450 Pandelampe - Black", brand: "Black Diamond" })
    ).toBe("Black Diamond Storm 450 Pandelampe");
  });
});

describe("rentNavn: stoej der aldrig er en del af navnet", () => {
  it("fjerner farve, stoerrelse og lagerbesked", () => {
    expect(
      rentNavn({
        product_name: "Camelbak Thrive Flip Straw 32oz - Oxford - Str. 1L / 32 oz - Drikkeflaske",
        brand: "Camelbak",
      })
    ).toBe("Camelbak Thrive Flip Straw 32oz Oxford");
    expect(
      rentNavn({ product_name: "Vandrebukser dame - Trespass Sola (L tilbage)", brand: null })
    ).toBe("Trespass Sola");
    expect(
      rentNavn({ product_name: "Carinthia G-loft Isg 2.0 Jacket - Black - Str. XXL - Jakke", brand: "Carinthia" })
    ).toBe("Carinthia G-loft Isg 2.0 Jacket");
  });

  it("samler backpackerlifes dobbelte mellemrum", () => {
    expect(
      rentNavn({ product_name: "Fleecetrøje dame  -  Treklife Sherpa V2  -  Grøn", brand: null })
    ).toBe("Treklife Sherpa V2");
  });
});

describe("rentNavn: maerket staar én gang og foerst", () => {
  it("saetter maerket foran, naar navnet ikke selv har det", () => {
    expect(
      rentNavn({ product_name: "Hurtigtørrende microfiber håndklæde - 120 x 60 cm - Grå", brand: "Trek Trail" })
    ).toBe("Trek Trail Hurtigtørrende microfiber håndklæde 120 x 60 cm");
  });

  it("flytter maerket frem i stedet for at skrive det to gange", () => {
    // Blev "Treklife Uldunderbukser herre 100% merino uld Treklife".
    expect(
      rentNavn({ product_name: "Uldunderbukser herre - 100% merino uld - Treklife - Sort", brand: null })
    ).toBe("Treklife Uldunderbukser herre 100% merino uld");
  });

  it("fjerner maerket naar feedet skriver det to gange", () => {
    expect(
      rentNavn({
        product_name: "Trek n' eat Trek'n Eat Jægergryde Med Oksekød Og Nudler - Mad",
        brand: "Trek'n Eat",
      })
    ).toBe("Trek'n Eat Jægergryde Med Oksekød Og Nudler");
  });

  it("tilfoejer ikke maerket, naar brand-feltet er laengere end navnet bruger", () => {
    // brand "Columbia Sportswear" mod navnet "Columbia Mountain Croo III".
    expect(
      rentNavn({
        product_name: "Columbia Mountain Croo III Mid Down Jacket Womens",
        brand: "Columbia Sportswear",
      })
    ).toBe("Columbia Mountain Croo III Mid Down Jacket Womens");
  });
});

describe("rentNavn: naar der ikke er nogen model", () => {
  it("beholder typebeskrivelsen, naar maerket ikke staar i navnet", () => {
    // Uden betingelsen blev det "Trek Trail 120 x 60 cm", som ikke er et navn.
    expect(rentNavn({ product_name: "Hurtigtørrende håndklæde - 160 x 80 cm", brand: "Trek Trail" })).toContain(
      "håndklæde"
    );
  });

  it("beholder typebeskrivelsen, naar der kun var maerket tilbage", () => {
    // Maerket staar forrest ogsaa her, fordi det er saadan folk soeger. Det
    // vigtige er at typebeskrivelsen IKKE forsvinder, saa navnet ikke bliver
    // bare "Treklife".
    expect(rentNavn({ product_name: "Myggenet til hovedet - Treklife", brand: null })).toBe(
      "Treklife Myggenet til hovedet"
    );
    expect(rentNavn({ product_name: "Mikropude - Highlander", brand: null })).toBe("Highlander Mikropude");
  });

  it("efterlader feedets navn, naar der hverken er maerke eller model", () => {
    expect(rentNavn({ product_name: "Dry bag - 8 liter", brand: null })).toBe("Dry bag 8 liter");
    expect(rentNavn({ product_name: "Hue - Mountain - Sort", brand: null })).toBe("Hue Mountain");
  });
});

describe("rentNavn: menneskets rettelse vinder", () => {
  it("bruger display_name uaendret", () => {
    expect(
      rentNavn({ product_name: "Dry bag - 8 liter", brand: null, display_name: "Treklife Drybag 8 liter" })
    ).toBe("Treklife Drybag 8 liter");
  });

  it("ignorerer tom display_name", () => {
    expect(rentNavn({ product_name: "Stol - Treklife Low-back UL Chair", brand: null, display_name: "  " })).toBe(
      "Treklife Low-back UL Chair"
    );
  });
});

describe("navnBehoeverHaand", () => {
  it("flager varer uden maerke nogen steder", () => {
    expect(navnBehoeverHaand({ product_name: "Dry bag - 8 liter", brand: null })).toBe(true);
    expect(navnBehoeverHaand({ product_name: "Hue - Mountain - Sort", brand: null })).toBe(true);
    expect(navnBehoeverHaand({ product_name: "Frysetørret mad - Pasta carbonara", brand: null })).toBe(true);
  });

  it("flager navne der er skrumpet til ét ord", () => {
    expect(navnBehoeverHaand({ product_name: "Siddeunderlag - Oppustelig", brand: null })).toBe(true);
  });

  it("flager ikke et navn der blot begynder med et ciffer", () => {
    // "66°North Mens Keilir Hooded Down Jacket" blev flaget af en /^\d/-regel.
    expect(
      navnBehoeverHaand({ product_name: "66°North Mens Keilir Hooded Down Jacket", brand: "66°North" })
    ).toBe(false);
  });

  it("flager ikke de navne udledningen klarer", () => {
    expect(navnBehoeverHaand({ product_name: "Stol - Treklife Low-back UL Chair", brand: null })).toBe(false);
    expect(
      navnBehoeverHaand({ product_name: "Haglöfs Musca -13 Midnight Blue/Mint", brand: "Haglöfs" })
    ).toBe(false);
  });

  it("flager ikke en vare der har faaet et display_name", () => {
    expect(
      navnBehoeverHaand({ product_name: "Dry bag - 8 liter", brand: null, display_name: "Treklife Drybag 8 liter" })
    ).toBe(false);
  });
});
