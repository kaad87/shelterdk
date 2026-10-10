import { describe, expect, it } from "vitest";
import { friskBeskrivelse, friskTitel, titelFakta } from "@/lib/guide-title";
import type { GuideEntryWithProduct } from "@/lib/buying-guides";

function entry(price: number | null, inStock = true, isBlocked = false) {
  return {
    id: String(price), rank: 0, award_label: null, editorial_note: "",
    pros: [], cons: [], score: null, best_for: null,
    product: { price, in_stock: inStock, is_blocked: isBlocked },
  } as unknown as GuideEntryWithProduct;
}

describe("titelFakta", () => {
  it("tæller kun produkter der kan købes", () => {
    const f = titelFakta([entry(109), entry(179, false), entry(129), entry(99, true, true)]);
    expect(f.antal).toBe(2);
    expect(f.fraPris).toBe(109);
  });

  it("ser bort fra produkter uden pris, men tæller dem med", () => {
    const f = titelFakta([entry(null), entry(250)]);
    expect(f.antal).toBe(2);
    expect(f.fraPris).toBe(250);
  });

  it("giver ingen fra-pris når intet kan købes", () => {
    const f = titelFakta([entry(109, false), entry(179, false)]);
    expect(f.antal).toBe(0);
    expect(f.fraPris).toBeNull();
  });
});

describe("friskTitel", () => {
  const fem = [entry(109), entry(129), entry(149), entry(179), entry(119)];

  it("retter et forældet antal", () => {
    expect(friskTitel("Bedste drikkedunk 2026 – 6 favoritter, fra 119 kr. | ShelterDK", fem))
      .toBe("Bedste drikkedunk 2026 – 5 favoritter, fra 109 kr. | ShelterDK");
  });

  it("retter en forældet fra-pris alene", () => {
    expect(friskTitel("Bedste tændstål 2026 – 6 favoritter, fra 29 kr. | ShelterDK",
      [entry(39), entry(49), entry(59), entry(69), entry(79), entry(89)]))
      .toBe("Bedste tændstål 2026 – 6 favoritter, fra 39 kr. | ShelterDK");
  });

  it("bøjer favorit i ental", () => {
    expect(friskTitel("Bedste telt 2026 – 6 favoritter, fra 500 kr. | ShelterDK", [entry(2042)]))
      .toBe("Bedste telt 2026 – 1 favorit, fra 2.042 kr. | ShelterDK");
  });

  it("fjerner påstanden helt når intet kan købes", () => {
    expect(friskTitel("Bedste campingstol 2026 – 5 favoritter, fra 243 kr. | ShelterDK",
      [entry(243, false), entry(379, false)]))
      .toBe("Bedste campingstol 2026 | ShelterDK");
  });

  it("rører ikke en titel uden tal-påstande", () => {
    const t = "Bedste myggenet 2026 – hovednet & sovenet til shelter | ShelterDK";
    expect(friskTitel(t, fem)).toBe(t);
  });

  it("lader en titel der allerede passer stå uændret", () => {
    const t = "Bedste drikkedunk 2026 – 5 favoritter, fra 109 kr. | ShelterDK";
    expect(friskTitel(t, fem)).toBe(t);
  });

  it("klarer tusindtalsseparator i den påstående pris", () => {
    expect(friskTitel("Bedste telt 2026 – 2 favoritter, fra 1.299 kr. | ShelterDK",
      [entry(899), entry(1499)]))
      .toBe("Bedste telt 2026 – 2 favoritter, fra 899 kr. | ShelterDK");
  });

  it("tåler tom titel", () => {
    expect(friskTitel(null, fem)).toBeNull();
  });
});

describe("friskBeskrivelse", () => {
  const tre = [entry(149), entry(199), entry(329)];

  it("retter både antal og prisspænd", () => {
    expect(friskBeskrivelse(
      "Vi scorer 6 favoritter – til voksne og børn, fra 119 til 179 kr. – på tæthed.", tre))
      .toBe("Vi scorer 3 favoritter – til voksne og børn, fra 149 til 329 kr. – på tæthed.");
  });

  it("retter et spænd skrevet med tankestreg", () => {
    expect(friskBeskrivelse("Vi scorer 6 favoritter, 119–179 kr.", tre))
      .toBe("Vi scorer 3 favoritter, 149–329 kr.");
  });

  it("fjerner påstande når intet kan købes", () => {
    const ud = friskBeskrivelse(
      "Find den bedste campingstol. Vi scorer 5 favoritter, fra 243 til 499 kr.",
      [entry(243, false)]);
    expect(ud).toBe("Find den bedste campingstol.");
  });

  it("rører ikke en beskrivelse uden tal-påstande", () => {
    const t = "Find det bedste myggenet til shelterture og hængekøje.";
    expect(friskBeskrivelse(t, tre)).toBe(t);
  });

  it("tåler null", () => {
    expect(friskBeskrivelse(null, tre)).toBeNull();
  });
});
