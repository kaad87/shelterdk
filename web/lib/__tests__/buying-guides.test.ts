import { describe, it, expect } from "vitest";
import { rankGuideEntries, resolveAwards, type GuideEntryWithProduct } from "@/lib/buying-guides";

function entry(id: string, rank: number, inStock: boolean, blocked = false): GuideEntryWithProduct {
  return {
    id,
    rank,
    award_label: null,
    editorial_note: "",
    pros: [],
    cons: [],
    score: null,
    best_for: null,
    product: { id: `p${id}`, in_stock: inStock, is_blocked: blocked, price: 500 } as GuideEntryWithProduct["product"],
  };
}

describe("rankGuideEntries", () => {
  it("sorterer efter rank stigende", () => {
    const out = rankGuideEntries([entry("b", 2, true), entry("a", 1, true)]);
    expect(out.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("demoterer udsolgte til bunden (men beholder dem)", () => {
    const out = rankGuideEntries([entry("oos", 1, false), entry("ok", 2, true)]);
    expect(out.map((e) => e.id)).toEqual(["ok", "oos"]);
  });

  it("demoterer blokerede til bunden", () => {
    const out = rankGuideEntries([entry("blk", 1, true, true), entry("ok", 2, true)]);
    expect(out.map((e) => e.id)).toEqual(["ok", "blk"]);
  });

  it("blandt demoterede bevares indbyrdes rank-rækkefølge", () => {
    const out = rankGuideEntries([entry("oos2", 5, false), entry("oos1", 3, false)]);
    expect(out.map((e) => e.id)).toEqual(["oos1", "oos2"]);
  });
});

describe("resolveAwards", () => {
  const e = (id: string, rank: number, inStock: boolean, award: string | null, score: number) =>
    ({ id, rank, score, award_label: award, product: { in_stock: inStock, is_blocked: false } }) as unknown as GuideEntryWithProduct;

  it("fjerner prædikatet fra et udsolgt produkt", () => {
    const out = resolveAwards([e("a", 0, false, "Bedst i test", 8.6), e("b", 1, true, "Bedst til prisen", 8.1)]);
    expect(out.find((x) => x.id === "a")!.award_label).toBeNull();
  });

  it("flytter topprædikatet til det bedst scorende produkt der kan købes", () => {
    const out = resolveAwards([e("a", 0, false, "Bedst i test", 8.6), e("b", 1, true, "Bedst til prisen", 8.1), e("c", 2, true, null, 8.3)]);
    expect(out.find((x) => x.id === "c")!.award_label).toBe("Bedst i test");
    expect(out.find((x) => x.id === "b")!.award_label).toBe("Bedst til prisen");
  });

  it("rører ikke prædikaterne når alt er på lager", () => {
    const out = resolveAwards([e("a", 0, true, "Bedst i test", 8.6), e("b", 1, true, "Bedst til prisen", 8.1)]);
    expect(out.map((x) => x.award_label)).toEqual(["Bedst i test", "Bedst til prisen"]);
  });

  it("giver ikke et produkt to prædikater — topprædikatet bortfalder hellere", () => {
    // Eneste tilbageværende produkt er budgetvalget. Det skal ikke pludselig
    // også være testvinder; så står der hellere ingen testvinder.
    const out = resolveAwards([e("a", 0, false, "Bedst i test", 9), e("b", 1, true, "Bedst til prisen", 8.1)]);
    expect(out.filter((x) => x.award_label === "Bedst i test")).toHaveLength(0);
    expect(out.find((x) => x.id === "b")!.award_label).toBe("Bedst til prisen");
  });

  it("udnævner en vinder når ingen af de tilbageværende har et topprædikat", () => {
    // Sker når topproduktet er slettet helt (afmeldt fra feedet). Svarkapslen
    // udnævner altid et førstevalg, så badgen skal sige det samme.
    const out = resolveAwards([e("a", 0, true, "Bedst til prisen", 8.1), e("b", 1, true, null, 8.4), e("c", 2, true, null, 8.2)]);
    expect(out.find((x) => x.id === "b")!.award_label).toBe("Vores valg");
    expect(out.find((x) => x.id === "a")!.award_label).toBe("Bedst til prisen");
  });

  it("efterlader topprædikatet ubrugt hvis intet produkt kan købes", () => {
    const out = resolveAwards([e("a", 0, false, "Bedst i test", 9), e("b", 1, false, "Bedst til prisen", 8)]);
    expect(out.every((x) => x.award_label === null)).toBe(true);
  });
});
