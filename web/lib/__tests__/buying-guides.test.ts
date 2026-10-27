import { describe, it, expect } from "vitest";
import { rankGuideEntries, resolveAwards, type GuideEntryWithProduct, vaelgVinder } from "@/lib/buying-guides";

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

describe("vaelgVinder", () => {
  const e = (rank: number, award: string | null, score: number | null, tilgaengelig = true) =>
    ({ rank, award_label: award, score, tilgaengelig });

  it("vaelger varen med topprædikat, ikke den foerste efter rank", () => {
    // Den rigtige sag: campingstol havde "Vores valg" paa rank 7, mens rank 4
    // var foerst efter rank. llms.txt og hub-kortene navngav rank 4.
    const v = vaelgVinder([e(4, "Bedste komfort u. polstring", 8.1), e(7, "Vores valg", 8.7), e(8, "Bedst til prisen", 8.0)]);
    expect(v?.rank).toBe(7);
  });

  it("springer et topprædikat over, naar varen ikke kan koebes", () => {
    const v = vaelgVinder([e(0, "Vores valg", 9.0, false), e(1, null, 8.2), e(2, null, 8.6)]);
    expect(v?.rank).toBe(2);
  });

  it("arver til hoejeste score blandt dem uden praedikat", () => {
    const v = vaelgVinder([e(0, "Vores valg", 9.0, false), e(1, "Bedst til prisen", 8.9), e(2, null, 8.1), e(3, null, 8.4)]);
    expect(v?.rank).toBe(3);
  });

  it("giver null naar siden ikke selv kan vise et foerstevalg", () => {
    // Alle paa lager har allerede et praedikat, saa resolveAwards udpeger
    // ingen. Da skal llms.txt heller ikke paastaa et.
    const v = vaelgVinder([e(0, "Vores valg", 9.0, false), e(1, "Bedst til prisen", 8.2), e(2, "Bedste robuste", 8.4)]);
    expect(v).toBeNull();
  });

  it("giver null naar intet kan koebes", () => {
    expect(vaelgVinder([e(0, "Vores valg", 9.0, false), e(1, null, 8.0, false)])).toBeNull();
  });
});

describe("ét foerstevalg pr. guide", () => {
  /**
   * Siden, hub-kortet og llms.txt skal navngive samme vare. Fejlen er kommet
   * tilbage to gange med hver sin aarsag: foerst tog hub-kortet den foerste
   * efter rank, og derefter sorterede selve svarkapslen paa hoejeste score,
   * mens badgen beholdt praedikatet, hvor det stod. En ekstern SEO-audit
   * fandt det paa sovepose 27. oktober 2026, og maalingen viste ni af 46
   * guider. Testen fastholder, at der kun er én udregning.
   */
  function medPraedikat(
    id: string,
    rank: number,
    award: string | null,
    score: number
  ): GuideEntryWithProduct {
    return { ...entry(id, rank, true), award_label: award, score };
  }

  const vinderEfter = (entries: GuideEntryWithProduct[]) =>
    vaelgVinder(
      resolveAwards(entries).map((x) => ({
        ...x,
        tilgaengelig: x.product.in_stock && !x.product.is_blocked,
      }))
    );

  it("foelger topprædikatet, ikke den hoejeste score", () => {
    // Sovepose-sagen: Snugpak Travelpak 3 har "Vores valg" paa 8,7, mens Sea
    // to Summit Trek scorer 8,8 uden praedikat. Badgen sagde Snugpak,
    // svarkapslen sagde Sea to Summit.
    const v = vinderEfter([
      medPraedikat("snugpak", 0, "Vores valg", 8.7),
      medPraedikat("seatosummit", 3, null, 8.8),
    ]);
    expect(v?.id).toBe("snugpak");
  });

  it("peger paa den badgen faar, naar topprædikatet er arvet", () => {
    // Topprædikatet sidder paa noget udsolgt, saa resolveAwards giver det til
    // den hoejest scorende uden praedikat. Begge udregninger skal ende der.
    const udsolgt = { ...medPraedikat("udsolgt", 0, "Vores valg", 9.2), product: { ...entry("udsolgt", 0, false).product } };
    const entries = [udsolgt, medPraedikat("b", 1, null, 8.4), medPraedikat("c", 2, null, 8.9)];
    const badge = resolveAwards(entries).find(
      (x) => /^vores valg$/i.test(x.award_label ?? "") && x.product.in_stock
    );
    expect(badge?.id).toBe("c");
    expect(vinderEfter(entries)?.id).toBe("c");
  });
});
