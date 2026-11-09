import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  resolveShelterSiloWith,
  shelterSiloPath,
  type ShelterSiloLookups,
} from "@/lib/shelter-silo-resolve";
import type { Shelter } from "@/types/shelter";

vi.mock("@/lib/supabase-pagination", () => ({
  fetchAllShelterRows: vi.fn(async () => []),
  querySupabaseWithRetry: vi.fn(async () => null),
}));

const REPO_WEB_ROOT = path.resolve(__dirname, "..", "..");
const SEGMENT = "app/(site)/danmark/[region]/[municipality]/[shelter_slug]";

function shelter(overrides: Partial<Shelter> & { duplicate_of_shelter_id?: string | null } = {}) {
  return { id: "id-1", title: "Et shelter", slug: "et-shelter-12345", ...overrides } as Shelter;
}

const EMPTY = { shelter: null, region: null, kommune: null };

function lookups(parts: Partial<ShelterSiloLookups>): ShelterSiloLookups {
  return {
    inSilo: async () => EMPTY,
    includingDuplicates: async () => EMPTY,
    canonicalFor: async () => null,
    ...parts,
  };
}

describe("resolveShelterSiloWith", () => {
  it("viser shelteret når slug, region og kommune passer", async () => {
    const found = { shelter: shelter(), region: "Jylland", kommune: "Silkeborg" };
    const result = await resolveShelterSiloWith(
      lookups({ inSilo: async () => found }),
      "jylland",
      "silkeborg",
      "et-shelter-12345"
    );
    expect(result.kind).toBe("found");
  });

  it("svarer not-found på en slug der ikke findes — ikke en tom 200-side", async () => {
    const result = await resolveShelterSiloWith(
      lookups({}),
      "jylland",
      "silkeborg",
      "helt-opdigtet-slug-xyz-123"
    );
    expect(result).toEqual({ kind: "not-found" });
  });

  it("redirecter en dublet-slug til det kanoniske shelters silo-URL", async () => {
    const result = await resolveShelterSiloWith(
      lookups({
        includingDuplicates: async () => ({
          shelter: shelter({ duplicate_of_shelter_id: "canon-id" }),
          region: "Jylland",
          kommune: "Vester Vedsted",
        }),
        canonicalFor: async (id) =>
          id === "canon-id"
            ? { region: "Jylland", kommune: "Esbjerg", slug: "digeborsteshelterne-1-86572" }
            : null,
      }),
      "jylland",
      "vester-vedsted",
      "digeborsteshelterne-3-86573"
    );
    expect(result).toEqual({
      kind: "redirect",
      destination: "/danmark/jylland/esbjerg/digeborsteshelterne-1-86572",
    });
  });

  it("svarer not-found når dubletten ikke har et kanonisk shelter (ingen redirect-loop)", async () => {
    const result = await resolveShelterSiloWith(
      lookups({
        includingDuplicates: async () => ({
          shelter: shelter({ duplicate_of_shelter_id: "borte" }),
          region: "Jylland",
          kommune: "Rebild",
        }),
        canonicalFor: async () => null,
      }),
      "jylland",
      "rebild",
      "en-dublet-98760"
    );
    expect(result).toEqual({ kind: "not-found" });
  });

  it("redirecter til /shelter/<slug> når rækken findes men ligger uden for siloen", async () => {
    const result = await resolveShelterSiloWith(
      lookups({
        includingDuplicates: async () => ({
          shelter: shelter({ duplicate_of_shelter_id: null }),
          region: null,
          kommune: null,
        }),
      }),
      "jylland",
      "silkeborg",
      "uden-region-12345"
    );
    expect(result).toEqual({ kind: "redirect", destination: "/shelter/uden-region-12345" });
  });

  it("redirecter til rigtig region/kommune når pathen er forkert", async () => {
    const result = await resolveShelterSiloWith(
      lookups({
        inSilo: async () => ({
          shelter: shelter(),
          region: "Jylland",
          kommune: "Silkeborg",
        }),
      }),
      "fyn",
      "assens",
      "et-shelter-12345"
    );
    expect(result).toEqual({
      kind: "redirect",
      destination: "/danmark/jylland/silkeborg/et-shelter-12345",
    });
  });

  it("bruger ukendt-kommune-segmentet for shelters uden kommune", async () => {
    expect(shelterSiloPath("Jylland", null, "x-1")).toBe("/danmark/jylland/ukendt-kommune/x-1");
    const result = await resolveShelterSiloWith(
      lookups({ inSilo: async () => ({ shelter: shelter(), region: "Jylland", kommune: null }) }),
      "jylland",
      "ukendt-kommune",
      "et-shelter-12345"
    );
    expect(result.kind).toBe("found");
  });
});

describe("statuskoden skal afgøres før render-streamen", () => {
  // Ruten er statisk (●) med dynamicParams = true, så en ukendt slug renderes
  // on-demand i static-generation-tilstand. Dér er der ingen response at sætte
  // status på: notFound() fra render-træet bliver bagt ind i HTML'en (errored
  // suspense boundary) og udleveret med 200 — en soft-404. Målt: 200 både fra
  // page.tsx og fra et layout.tsx uden for enhver Suspense-grænse.
  // generateMetadata kører før streamen, så throwet DÉR sætter statuskoden.
  // Kaldet i page-komponenten skal også blive, og segmentet skal have sin egen
  // not-found.tsx — ellers er 404-kroppen tom.
  const read = (file: string) => {
    const source = readFileSync(path.join(REPO_WEB_ROOT, SEGMENT, file), "utf8");
    return source.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  };

  it("har hverken loading.tsx eller layout.tsx — begge genindfører streamingen", () => {
    expect(existsSync(path.join(REPO_WEB_ROOT, SEGMENT, "loading.tsx"))).toBe(false);
    expect(existsSync(path.join(REPO_WEB_ROOT, SEGMENT, "layout.tsx"))).toBe(false);
  });

  it("har sin egen not-found.tsx, så 404-kroppen ikke er tom", () => {
    expect(existsSync(path.join(REPO_WEB_ROOT, SEGMENT, "not-found.tsx"))).toBe(true);
  });

  it("kalder notFound() i BÅDE generateMetadata og page-komponenten", () => {
    const code = read("page.tsx");
    const meta = code.slice(code.indexOf("export async function generateMetadata"));
    const metaBody = meta.slice(0, meta.indexOf("export default"));
    const pageBody = meta.slice(meta.indexOf("export default"));
    expect(metaBody).toMatch(/\bnotFound\s*\(\)/);
    expect(pageBody).toMatch(/\bnotFound\s*\(\)/);
  });

  it("redirecter IKKE fra siden — en 308 derfra kommer uden Location", () => {
    const code = read("page.tsx");
    expect(code).not.toMatch(/\bredirect\s*\(/);
    expect(code).not.toMatch(/\bpermanentRedirect\s*\(/);
  });
});

describe("dublet-shelters 308'er via next.config.js", () => {
  // Samme begrundelse som de 17 kommunesider (ab19c61): et redirect fra en
  // statisk rute bliver ikke en brugbar 308.
  const entries: { slug: string; canonicalSlug: string; from: string; to: string }[] =
    require(path.join(REPO_WEB_ROOT, "data/shelter-duplicate-redirects.json"));

  it("har eksakte paths uden wildcards, så shelter-sider ikke rammes", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const { from, to } of entries) {
      expect(from).toMatch(/^\/danmark\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/);
      expect(to).toMatch(/^\/danmark\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/);
      expect(from).not.toBe(to);
      expect(from).not.toMatch(/[:*]/);
    }
  });

  it("har ingen dubletter og ingen kæder", () => {
    const froms = entries.map((e) => e.from);
    expect(new Set(froms).size).toBe(froms.length);
    const fromSet = new Set(froms);
    for (const { to } of entries) expect(fromSet.has(to)).toBe(false);
  });

  it("er alle sammen 308-redirects i next.config.js", async () => {
    const nextConfig = require(path.join(REPO_WEB_ROOT, "next.config.js"));
    const redirects: { source: string; destination: string; permanent: boolean }[] =
      await nextConfig.redirects();
    const bySource = new Map(redirects.map((r) => [r.source, r]));
    for (const { from, to } of entries) {
      const rule = bySource.get(from);
      expect(rule, `mangler redirect for ${from}`).toBeDefined();
      expect(rule!.destination).toBe(to);
      expect(rule!.permanent).toBe(true);
    }
  });

  it("bruger det kanoniske region-slug i from, så reglen faktisk nås", () => {
    // next.config.js redirecter /danmark/sjaelland/:kommune/:rest* videre til
    // det lange slug FØR vores regler. En from på det korte slug ville derfor
    // aldrig blive ramt.
    for (const { from } of entries) {
      expect(from.startsWith("/danmark/sjaelland/")).toBe(false);
      expect(from.startsWith("/danmark/fyn-og-oeerne/")).toBe(false);
    }
  });
});

describe("static params for shelter-detaljesiden", () => {
  // Dubletter skal UD af generateStaticParams: deres side redirecter, og et
  // redirect under build-prerender bliver i Next 14 en meta-refresh-side med
  // status 200 (samme fælde som kommunesiderne i ab19c61).
  it("filtrerer dubletter ud af getSheltersForStaticParams", async () => {
    const { getSheltersForStaticParams } = await import("@/lib/danmark-silo");
    const { fetchAllShelterRows } = await import("@/lib/supabase-pagination");

    const calls: string[] = [];
    const query: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of ["select", "not", "neq", "is", "eq", "filter"]) {
      query[method] = (...args: unknown[]) => {
        calls.push(`${method}(${args.map(String).join(",")})`);
        return query;
      };
    }

    vi.mocked(fetchAllShelterRows).mockImplementation(
      async (_select: string, configure?: (q: never) => unknown) => {
        configure?.(query as never);
        return [];
      }
    );

    await getSheltersForStaticParams();

    expect(calls).toContain("is(duplicate_of_shelter_id,null)");
  });
});
