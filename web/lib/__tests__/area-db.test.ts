import { describe, it, expect, vi, beforeEach } from "vitest";
import { areaShelterFilter, getAreaBySlug, getAreaBySlugEllerNull } from "@/lib/area-db";

describe("areaShelterFilter", () => {
  it("bruger area_slug når området ikke har kommuner", () => {
    expect(areaShelterFilter({ slug: "vadehavet", kommuner: null })).toEqual({ column: "area_slug", op: "eq", value: "vadehavet" });
  });
  it("bruger kommune-listen når området er en landsdel (fx Sønderjylland)", () => {
    const kommuner = ["Aabenraa", "Sønderborg", "Tønder", "Haderslev"];
    expect(areaShelterFilter({ slug: "soenderjylland", kommuner })).toEqual({ column: "kommune", op: "in", value: kommuner });
  });
  it("tom kommune-liste falder tilbage til area_slug", () => {
    expect(areaShelterFilter({ slug: "x", kommuner: [] }).op).toBe("eq");
  });
});

// ---------------------------------------------------------------- fejl-haandtering

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
const svar: { data: unknown; error: { code?: string; message: string } | null }[] = [];
let kald = 0;
vi.mock("@/utils/supabase/server-public", () => ({
  createPublicClient: () => {
    const builder: Record<string, unknown> = {};
    for (const m of ["from", "select", "eq", "in", "is", "order", "limit"]) builder[m] = () => builder;
    builder.single = () => builder;
    builder.then = (res: (v: unknown) => unknown) => {
      kald++;
      return Promise.resolve(svar.shift() ?? { data: null, error: { message: "tom" } }).then(res);
    };
    return builder;
  },
}));

beforeEach(() => {
  svar.length = 0;
  kald = 0;
});

describe("getAreaBySlug", () => {
  it("giver null, naar omraadet ikke findes", async () => {
    svar.push({ data: null, error: { code: "PGRST116", message: "0 rows" } });
    expect(await getAreaBySlug("findes-ikke")).toBeNull();
    // Ingen grund til et nyt forsoeg paa et svar, der er rigtigt.
    expect(kald).toBe(1);
  });

  it("proever igen én gang ved en netvaerksfejl", async () => {
    svar.push({ data: null, error: { message: "fetch failed" } });
    svar.push({ data: { slug: "bornholm", name: "Bornholm" }, error: null });
    expect((await getAreaBySlug("bornholm"))?.name).toBe("Bornholm");
    expect(kald).toBe(2);
  });

  it("kaster i stedet for at blive til null, hvis fejlen bliver ved", async () => {
    // null ville blive cachet i 24 timer og gjort til notFound() paa siden.
    svar.push({ data: null, error: { message: "fetch failed" } }, { data: null, error: { message: "fetch failed" } });
    await expect(getAreaBySlug("bornholm")).rejects.toThrow(/fetch failed/);
  });

  it("har en variant til sider, hvor omraadet er en bisag", async () => {
    svar.push({ data: null, error: { message: "fetch failed" } }, { data: null, error: { message: "fetch failed" } });
    expect(await getAreaBySlugEllerNull("bornholm")).toBeNull();
  });
});
