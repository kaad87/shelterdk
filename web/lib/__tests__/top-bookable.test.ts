import { describe, it, expect } from "vitest";
import { mergeTopByScore } from "@/lib/top-bookable";

const s = (id: string, score: number | null) => ({ id, display_score: score }) as { id: string; display_score: number | null };

describe("mergeTopByScore", () => {
  it("fletter regionlister, sorterer på display_score faldende og klipper til limit", () => {
    const out = mergeTopByScore([[s("a", 10), s("b", 50)], [s("c", 30)]], 2);
    expect(out.map((x) => x.id)).toEqual(["b", "c"]);
  });
  it("fjerner dubletter på id og lægger null-score sidst", () => {
    const out = mergeTopByScore([[s("a", null), s("b", 5)], [s("b", 5), s("d", 1)]], 10);
    expect(out.map((x) => x.id)).toEqual(["b", "d", "a"]);
  });
});
