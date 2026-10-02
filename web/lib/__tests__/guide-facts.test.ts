import { describe, it, expect } from "vitest";
import { guideFacts } from "@/lib/guide-facts";

const e = (price: number, inStock = true, score: number | null = 8) =>
  ({ score, product: { price, in_stock: inStock, is_blocked: false, retailer: "backpackerlife" } }) as never;

describe("guideFacts", () => {
  it("tæller kun produkter der kan købes", () => {
    const f = guideFacts([e(100), e(200), e(300, false)], null);
    expect(f.find((x) => x.label === "Produkter i guiden")!.value).toBe("2 der kan købes nu");
  });

  it("angiver prisspænd i hele kroner", () => {
    const f = guideFacts([e(449), e(2852.5)], null);
    expect(f.find((x) => x.label === "Prisspænd")!.value).toBe("449–2.853 kr.");
  });

  it("viser pris-tjek-datoen når den kendes", () => {
    const f = guideFacts([e(100)], "21. september");
    expect(f.find((x) => x.label === "Priser tjekket")!.value).toBe("21. september, synkroniseret dagligt");
  });

  it("udelader prisspænd når intet kan købes", () => {
    const f = guideFacts([e(100, false)], null);
    expect(f.some((x) => x.label === "Prisspænd")).toBe(false);
  });

  it("siger hvordan vi scorer — så påstanden ikke forveksles med en labtest", () => {
    const f = guideFacts([e(100)], null);
    expect(f.find((x) => x.label === "Sådan scorer vi")!.value).toMatch(/redaktionel vurdering/i);
  });
});
