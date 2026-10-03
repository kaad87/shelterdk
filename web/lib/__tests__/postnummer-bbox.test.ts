import { describe, it, expect } from "vitest";
import { fetchPostnummerBbox, lookupPostnummer } from "@/lib/postnummer";

describe("fetchPostnummerBbox", () => {
  it("laver ingen netværkskald — DAWA er lukket, og der findes ingen åben afløser", async () => {
    const original = globalThis.fetch;
    let kaldt = false;
    globalThis.fetch = (async () => {
      kaldt = true;
      throw new Error("der må ikke kaldes ud");
    }) as typeof fetch;
    try {
      expect(await fetchPostnummerBbox("8410")).toBeNull();
      expect(kaldt).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("lookupPostnummer", () => {
  it("bærer stadig faldet tilbage til bynavn", () => {
    expect(lookupPostnummer("8410")).toBe("Rønde");
    expect(lookupPostnummer("0000")).toBeNull();
  });
});
