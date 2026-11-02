import { describe, it, expect } from "vitest";
import { produktSlug, tildelProduktSlugs, translitterer, type SlugVare } from "@/lib/produkt-slug";

describe("produktSlug", () => {
  it("skriver de danske bogstaver ud i stedet for at tabe dem", () => {
    // NFD roerer ikke oe, saa et raat [^a-z0-9]-filter delte "Stormkøkken"
    // i "stormk" og "kken".
    expect(produktSlug("Stormkøkken")).toBe("stormkoekken");
    expect(produktSlug("Haglöfs Musca -13")).toBe("haglofs-musca-13");
    expect(translitterer("Blåbær")).toBe("blaabaer");
  });

  it("giver tom streng for et navn uden bogstaver eller tal", () => {
    expect(produktSlug("---")).toBe("");
    expect(produktSlug(null)).toBe("");
  });
});

describe("tildelProduktSlugs", () => {
  const v = (id: string, product_name: string, display_name: string | null = null): SlugVare => ({
    id,
    product_name,
    brand: null,
    display_name,
    display_brand: null,
  });

  it("giver hver vare dens egen slug naar navnene er forskellige", () => {
    const { slugs, uden } = tildelProduktSlugs([
      v("b", "Sovepose - Haglöfs Musca -13"),
      v("a", "Sandal - Keen Mens Arroyo II"),
    ]);
    expect(slugs.get("a")).toBe("keen-mens-arroyo-ii");
    expect(slugs.get("b")).toBe("haglofs-musca-13");
    expect(uden).toEqual([]);
  });

  it("lader det laveste id vinde ved navnesammenfald", () => {
    // De tre Treklife Rain-varer kolliderede faktisk: rentNavn skaerer
    // feedets typeforstavelse vaek, saa Regnjakke, Regnbukser og Regnsaet
    // alle blev "Treklife Rain Packaway".
    const varer = [
      v("outmore-3", "Regnsæt herre - Treklife Rain Packaway"),
      v("outmore-1", "Regnjakke herre - Treklife Rain Packaway"),
      v("outmore-2", "Regnbukser herre - Treklife Rain Packaway"),
    ];
    const { slugs, uden } = tildelProduktSlugs(varer);
    expect(slugs.size).toBe(1);
    expect(slugs.get("outmore-1")).toBe("treklife-rain-packaway");
    expect(uden.map((u) => u.id).sort()).toEqual(["outmore-2", "outmore-3"]);
    expect(uden[0].grund).toBe("kollision");
    expect(uden[0].taberFor).toBe("outmore-1");
  });

  it("afgoer en kollision ens uanset raekkefoelgen ind", () => {
    const a = [v("z", "Treklife Rain Packaway"), v("y", "Treklife Rain Packaway")];
    const b = [v("y", "Treklife Rain Packaway"), v("z", "Treklife Rain Packaway")];
    expect([...tildelProduktSlugs(a).slugs.keys()]).toEqual(
      [...tildelProduktSlugs(b).slugs.keys()]
    );
  });

  it("display_name loeser kollisionen", () => {
    const { slugs, uden } = tildelProduktSlugs([
      v("outmore-1", "Regnjakke herre - Treklife Rain Packaway"),
      v("outmore-2", "Regnbukser herre - Treklife Rain Packaway", "Treklife Rain Packaway Regnbukser"),
    ]);
    expect(slugs.size).toBe(2);
    expect(uden).toEqual([]);
  });

  it("melder en vare uden brugbart navn som tomt-navn", () => {
    const { slugs, uden } = tildelProduktSlugs([v("a", "---")]);
    expect(slugs.size).toBe(0);
    expect(uden[0].grund).toBe("tomt-navn");
  });
});
