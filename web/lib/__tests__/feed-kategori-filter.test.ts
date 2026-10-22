import { describe, expect, it } from "vitest";
import { kategoriFor, prisOk, FEED_KATEGORIER } from "@/lib/feed-kategori-filter";

describe("kategoriFor", () => {
  it("tager ikke sutsko og hjemmesko med som vandresandal", () => {
    // "NOU Emilian W Leather Cork Moc" beskriver sig selv som damesutsko.
    expect(kategoriFor("NOU Emilian W Leather Cork Moc V2", "Sandaler")).toBeNull();
    expect(kategoriFor("Glerups Slipper Wool", "Fodtøj")).toBeNull();
  });

  it("tager ikke byjakker og lange frakker med som dunjakke", () => {
    expect(kategoriFor("Patagonia Mens Cotton Down Jacket", "Jakker")).toBeNull();
    expect(kategoriFor("Patagonia Womens Cotton Down Parka", "Jakker")).toBeNull();
    expect(kategoriFor("Helly Hansen Womens Essence Long Down Coat", "Jakker")).toBeNull();
    expect(kategoriFor("Berghaus Mens Explorer Down Jacket", "Jakker")).toBe("dunjakke");
  });

  it("fanger de fem kategorier vi importerer", () => {
    expect(kategoriFor("Keen Newport H2 Sandal", "Sandaler")).toBe("vandresandal");
    expect(kategoriFor("Patagonia Better Sweater Fleece", "Fleecejakker")).toBe("fleece");
    expect(kategoriFor("Rab Microlight Dunjakke", "Jakker")).toBe("dunjakke");
    expect(kategoriFor("Fjällräven Abisko Trekkingbukser", "Bukser")).toBe("vandrebukser");
    expect(kategoriFor("Buff Bøllehat", "Huer og kasketter")).toBe("solhat");
  });

  it("lader alt andet ligge", () => {
    // Pro Outdoor har 49.556 varer og Outdoornu 32.611. Importeres de hele,
    // sekstendobles en tabel hvor 98 % allerede er ubrugt.
    for (const navn of [
      "Savage Gear Spinnestang 9 fod",
      "Shimano Spinnehjul 4000",
      "Garmin Metaldetektor",
      "Herre Skjorte Flannel",
      "Badeshorts Trunks Navy",
    ]) {
      expect(kategoriFor(navn, "Diverse"), navn).toBeNull();
    }
  });

  it("skelner en fleecehandske fra en fleecetrøje", () => {
    // Udelukkelsen laeses paa produktNAVNET, ikke paa kategorinavnet, saa en
    // handske i kategorien "Fleecejakker" stadig falder fra.
    expect(kategoriFor("Fleece Handsker Sort", "Fleecejakker")).toBeNull();
    expect(kategoriFor("Fleece Hue", "Huer")).toBeNull();
    expect(kategoriFor("Fleece Sokker", "Sokker")).toBeNull();
  });

  it("tager en dunvest med som dunjakke", () => {
    // Der er ikke laengere en vestkategori: \bvest\b fangede jagtveste,
    // loebeveste, varmeveste og et landkort ("Kyst til Kyst Vest"). Dunveste
    // er det eneste fra den gruppe vi vil have, og de fanges her.
    expect(kategoriFor("Rab Microlight Dunvest", "Veste")).toBe("dunjakke");
    expect(kategoriFor("Haglöfs Mimic Vest", "Veste")).toBeNull();
    expect(kategoriFor("Calazo Kyst til Kyst Vest - Blåvands Huk 1:25000", "Kort")).toBeNull();
    expect(kategoriFor("Pinewood Dogsport 2.0 Vest Dame", "Veste")).toBeNull();
  });

  it("tager ikke en redningsvest med", () => {
    expect(kategoriFor("Redningsvest 50N Voksen", "Veste")).toBeNull();
    expect(kategoriFor("Refleksvest gul", "Sikkerhed")).toBeNull();
  });

  it("tager ikke hundeudstyr og boernetoej med", () => {
    expect(kategoriFor("Hundesandal pote", "Hund")).toBeNull();
    expect(kategoriFor("Børne fleecetrøje", "Børn")).toBeNull();
  });

  it("tager imod en tom kategori fra feedet", () => {
    expect(kategoriFor("Patagonia Fleece Jakke", null)).toBe("fleece");
    expect(kategoriFor("", null)).toBeNull();
  });

  it("har ikke to regler med samme kategori", () => {
    const k = FEED_KATEGORIER.map((x) => x.kategori);
    expect(new Set(k).size).toBe(k.length);
  });
});

describe("laek fundet i de rigtige feeds", () => {
  it("udelukker teenage- og ungdomsvarer", () => {
    // Slap igennem, da ALDRIG kun havde danske ord. Feedenes navne er engelske.
    expect(kategoriFor("The North Face Teen Reversible North Down Jacket", "Jakker > Dunjakker")).toBeNull();
    expect(kategoriFor("Youth Fleece Jacket", "Fleece")).toBeNull();
    expect(kategoriFor("Boys Zip-Off Trousers", "Bukser")).toBeNull();
  });

  it("udelukker en vare i boerne-grenen af kategoritraeet, selv om navnet er neutralt", () => {
    expect(kategoriFor("Glacier Full Zip", "Brands > The North Face > Børn > Fleece")).toBeNull();
  });

  it("tager ikke en bomuldshaettetroeje med, blot fordi den ligger i fleece-kategorien", () => {
    expect(kategoriFor("Mens Drew Peak Pullover Hoodie", "Overdele > Fleece")).toBeNull();
    expect(kategoriFor("Mens Crewneck Sweatshirt", "Overdele > Fleece")).toBeNull();
  });

  it("beholder en rigtig fleecehoodie", () => {
    expect(kategoriFor("Mens Canyonlands Fleece Hoodie", "Overdele > Fleece")).toBe("fleece");
  });
});

describe("prisOk", () => {
  it("holder en parka til 13.000 kr ude af dunjakke", () => {
    expect(prisOk("dunjakke", 2499)).toBe(true);
    expect(prisOk("dunjakke", 13049.95)).toBe(false);
  });

  it("laader kategorier uden graense vaere", () => {
    expect(prisOk("lejrsko", 99999)).toBe(true);
  });

  it("siger ja til en kategori den ikke kender", () => {
    // Saa en stavefejl i importkoden ikke tavst smider alt vaek.
    expect(prisOk("findes-ikke", 500)).toBe(true);
  });
});
