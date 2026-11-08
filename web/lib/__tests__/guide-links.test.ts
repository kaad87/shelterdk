import { beforeEach, describe, expect, it, vi } from "vitest";

const select = vi.fn();
vi.mock("@/utils/supabase/server-public", () => ({
  createPublicClient: () => ({ from: () => ({ select }) }),
}));

import {
  FORSIDE_GUIDER,
  TEMA_KANDIDATER,
  _nulstilGuideTitelCache,
  MIN_STEDSTOERRELSE,
  erKoldSaeson,
  guideHref,
  resolveGuideLinks,
  stedKandidater,
} from "@/lib/guide-links";

function svar(slugs: string[]) {
  select.mockReturnValue({
    eq: () => Promise.resolve({ data: slugs.map((s) => ({ slug: s, title: `Bedste ${s}` })) }),
  });
}

beforeEach(() => {
  _nulstilGuideTitelCache();
  select.mockReset();
});

describe("guideHref", () => {
  it("maerker linket med kilden, saa tragten kan skelnes i affiliate_clicks", () => {
    expect(guideHref("sovepose", "forside")).toBe("/bedste/sovepose?fra=forside");
    expect(guideHref("vandfilter", "by")).toBe("/bedste/vandfilter?fra=by");
  });

  it("afviser slugs der kan bryde ud af /bedste", () => {
    expect(() => guideHref("../admin", "forside")).toThrow();
    expect(() => guideHref("a b", "forside")).toThrow();
    expect(() => guideHref("", "forside")).toThrow();
  });

  it("afviser en kilde der ikke er i listen", () => {
    // Uden tjekket kunne en tastefejl lave en kilde der aldrig matcher i
    // rapporteringen, og fejlen ville vaere tavs.
    expect(() => guideHref("sovepose", "forsiden" as never)).toThrow();
  });
});

describe("resolveGuideLinks", () => {
  it("springer guider over der ikke er publicerede", async () => {
    svar(["sovepose", "liggeunderlag"]);
    const ud = await resolveGuideLinks([
      { slug: "findes-ikke", reason: "a" },
      { slug: "sovepose", reason: "b" },
    ]);
    expect(ud.map((g) => g.slug)).toEqual(["sovepose"]);
    expect(ud[0].title).toBe("Bedste sovepose");
  });

  it("udelader kandidater hvis betingelse er falsk", async () => {
    svar(["sovepose", "vandfilter"]);
    const ud = await resolveGuideLinks([
      { slug: "vandfilter", reason: "a", when: false },
      { slug: "sovepose", reason: "b" },
    ]);
    expect(ud.map((g) => g.slug)).toEqual(["sovepose"]);
  });

  it("respekterer graensen og beholder raekkefoelgen", async () => {
    svar(["a", "b", "c"]);
    const ud = await resolveGuideLinks(
      [
        { slug: "c", reason: "1" },
        { slug: "a", reason: "2" },
        { slug: "b", reason: "3" },
      ],
      2
    );
    expect(ud.map((g) => g.slug)).toEqual(["c", "a"]);
  });

  it("linker ikke til samme guide to gange", async () => {
    svar(["sovepose"]);
    const ud = await resolveGuideLinks([
      { slug: "sovepose", reason: "foerste" },
      { slug: "sovepose", reason: "anden" },
    ]);
    expect(ud).toHaveLength(1);
    expect(ud[0].reason).toBe("foerste");
  });

  it("giver ingen links naar opslaget fejler, i stedet for at kaste", async () => {
    select.mockReturnValue({ eq: () => Promise.reject(new Error("nede")) });
    await expect(resolveGuideLinks(FORSIDE_GUIDER)).resolves.toEqual([]);
  });

  it("henter kun titlerne én gang, saa blokken ikke koster egress pr. render", async () => {
    svar(["sovepose"]);
    await resolveGuideLinks([{ slug: "sovepose", reason: "a" }]);
    await resolveGuideLinks([{ slug: "sovepose", reason: "a" }]);
    expect(select).toHaveBeenCalledTimes(1);
  });
});

describe("erKoldSaeson", () => {
  it("daekker oktober til marts", () => {
    expect([10, 11, 12, 1, 2, 3].every(erKoldSaeson)).toBe(true);
    expect([4, 5, 6, 7, 8, 9].some(erKoldSaeson)).toBe(false);
  });
});

describe("stedKandidater", () => {
  it("giver ingen blok paa de tynde sider, hvor teksten ville vaere ens", () => {
    // Median paa by-siderne er 1 shelter. Uden taersklen ville flere hundrede
    // sider faa ordret samme tre linjer.
    expect(stedKandidater({ antal: MIN_STEDSTOERRELSE - 1, medVand: 0, maaned: 11 })).toEqual([]);
    expect(stedKandidater({ antal: 1, medVand: 0, maaned: 6 })).toEqual([]);
  });

  it("giver en blok fra og med taersklen", () => {
    expect(
      stedKandidater({ antal: MIN_STEDSTOERRELSE, medVand: 0, maaned: 11 }).length
    ).toBeGreaterThan(0);
  });

  it("naevner stedets eget tal, saa blokken ikke er den samme paa 955 by-sider", () => {
    const k = stedKandidater({ antal: 12, medVand: 5, maaned: 11 });
    const vand = k.find((x) => x.slug === "vandfilter")!;
    expect(vand.reason).toBe("7 af pladserne har ikke vand");
    expect(vand.when).toBe(true);
  });

  it("boejer ental korrekt", () => {
    const k = stedKandidater({ antal: 6, medVand: 5, maaned: 6 });
    expect(k.find((x) => x.slug === "vandfilter")!.reason).toBe("1 af pladserne har ikke vand");
  });

  it("udelader vandfilter naar alle pladser har vand", () => {
    const k = stedKandidater({ antal: 7, medVand: 7, maaned: 6 });
    expect(k.find((x) => x.slug === "vandfilter")!.when).toBe(false);
  });

  it("taeller ikke negativt hvis medVand overstiger antal", () => {
    // Taellingerne kommer fra to forskellige filtre paa by-siden, saa de kan
    // i princippet komme ud af trit. "-2 af pladserne" maa ikke naa siden.
    const k = stedKandidater({ antal: 5, medVand: 9, maaned: 6 });
    expect(k.find((x) => x.slug === "vandfilter")!.when).toBe(false);
  });

  it("skifter sesongguide med maaneden", () => {
    const vinter = stedKandidater({ antal: 5, medVand: 0, maaned: 12 });
    expect(vinter.find((x) => x.slug === "sovepose-til-vinter")!.when).toBe(true);
    expect(vinter.find((x) => x.slug === "liggeunderlag")!.when).toBe(false);

    const sommer = stedKandidater({ antal: 5, medVand: 0, maaned: 7 });
    expect(sommer.find((x) => x.slug === "sovepose-til-vinter")!.when).toBe(false);
    expect(sommer.find((x) => x.slug === "liggeunderlag")!.when).toBe(true);
  });

  it("giver hoejst tre links efter filtrering", async () => {
    svar(["sovepose", "vandfilter", "sovepose-til-vinter", "liggeunderlag"]);
    const ud = await resolveGuideLinks(stedKandidater({ antal: 9, medVand: 2, maaned: 11 }));
    expect(ud.map((g) => g.slug)).toEqual(["sovepose", "vandfilter", "sovepose-til-vinter"]);
  });
});

describe("faste lister", () => {
  it("forsidens guider er unikke og har gyldige slugs", () => {
    const slugs = FORSIDE_GUIDER.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const g of FORSIDE_GUIDER) expect(() => guideHref(g.slug, "forside")).not.toThrow();
  });

  it("hver temaside har mindst to forslag med gyldige slugs", () => {
    for (const [tema, kandidater] of Object.entries(TEMA_KANDIDATER)) {
      expect(kandidater.length, tema).toBeGreaterThanOrEqual(2);
      const slugs = kandidater.map((k) => k.slug);
      expect(new Set(slugs).size, tema).toBe(slugs.length);
      for (const k of kandidater) expect(() => guideHref(k.slug, "tema"), tema).not.toThrow();
    }
  });

  it("ingen begrundelse er tom", () => {
    for (const g of [...FORSIDE_GUIDER, ...Object.values(TEMA_KANDIDATER).flat()]) {
      expect(g.reason.trim()).not.toBe("");
    }
  });

  it("begrundelserne er rigtigt dansk, ikke translittereret ASCII", () => {
    // Kommentarerne i filen er ASCII-translittererede (husets konvention),
    // og begrundelserne er skrevet lige ved siden af. Foerste udgave af
    // forsidens blok naaede helt til skaermen med "nattesoevnen", "naetter"
    // og "paa pladsen". Typen skelner dem ikke, saa det skal en test.
    //
    // Nogle rigtige danske ord indeholder digraferne hen over en
    // stavelsesgraense ("kanoen"). De staar her, saa vagten bliver ved med
    // at vaere skarp i stedet for at blive slaaet fra.
    const RIGTIGE_ORD = /\b(kanoen|kano|zoo)\b/gi;
    const digrafer = /(oe|ae|aa)/i;
    for (const g of [...FORSIDE_GUIDER, ...Object.values(TEMA_KANDIDATER).flat()]) {
      const uden = g.reason.replace(RIGTIGE_ORD, "");
      expect(uden, `"${g.reason}" ligner translitteration af ø/æ/å`).not.toMatch(
        digrafer
      );
    }
  });
});
