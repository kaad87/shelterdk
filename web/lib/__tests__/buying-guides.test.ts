import { describe, it, expect } from "vitest";
import { rankGuideEntries, type GuideEntryWithProduct } from "@/lib/buying-guides";

function entry(id: string, rank: number, inStock: boolean, blocked = false): GuideEntryWithProduct {
  return {
    id,
    rank,
    award_label: null,
    editorial_note: "",
    pros: [],
    cons: [],
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
