import { describe, it, expect, vi, beforeEach } from "vitest";

/** Svarene databasen giver, ét pr. forespoergsel, i raekkefoelge. */
let svar: { data: unknown[] | null; error: { message: string } | null }[] = [];
let kald = 0;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => {
      const k: Record<string, unknown> = {
        then: (ok: (v: unknown) => unknown) =>
          Promise.resolve(svar[Math.min(kald++, svar.length - 1)]).then(ok),
      };
      for (const m of ["select", "in", "order", "range"]) k[m] = () => k;
      return k;
    },
  }),
}));

import { hentPrisfald, GENFORSOEG_MS } from "../prisfald-opslag";

const RAEKKER = [
  { product_id: "a", observeret: "2026-11-02", price: 739 },
  { product_id: "a", observeret: "2026-11-14", price: 495 },
  { product_id: "b", observeret: "2026-11-02", price: 251.95 },
];
const VARER = [
  { id: "a", price: 495 },
  { id: "b", price: 251.95 },
];
const FEJL = { data: null, error: { message: "TypeError: fetch failed" } };

beforeEach(() => {
  kald = 0;
  GENFORSOEG_MS.splice(0, GENFORSOEG_MS.length, 0, 0);
});

describe("hentPrisfald", () => {
  it("samler raekkerne pr. vare og finder faldet", async () => {
    svar = [{ data: RAEKKER, error: null }];
    const ud = await hentPrisfald(VARER, "2026-11-16");
    expect(ud.get("a")).toEqual({ foer: 739, nu: 495, pct: 33, siden: "2026-11-14" });
    expect(ud.has("b")).toBe(false);
  });

  it("spoerger slet ikke databasen uden varer", async () => {
    svar = [FEJL];
    expect((await hentPrisfald([], "2026-11-16")).size).toBe(0);
    expect(kald).toBe(0);
  });

  it("proever igen efter en tabt forespoergsel", async () => {
    svar = [FEJL, { data: RAEKKER, error: null }];
    const ud = await hentPrisfald(VARER, "2026-11-16");
    expect(ud.get("a")?.pct).toBe(33);
    expect(kald).toBe(2);
  });

  it("kaster naar tre forsoeg i traek fejler", async () => {
    svar = [FEJL];
    await expect(hentPrisfald(VARER, "2026-11-16")).rejects.toThrow("Kunne ikke laese prishistorik");
    expect(kald).toBe(3);
  });
});
