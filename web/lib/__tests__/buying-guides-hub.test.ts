import { describe, it, expect } from "vitest";
import { groupGuides, relatedGuides, type HubGuide, HUB_GROUPS } from "@/lib/buying-guides-hub";

const g = (slug: string, category: string, parent_slug: string | null = null): HubGuide => ({
  slug,
  title: slug,
  category,
  intro: null,
  parent_slug,
});

describe("groupGuides", () => {
  it("grupperer guider efter hub-gruppe i defineret rækkefølge", () => {
    const out = groupGuides([g("kniv", "kniv"), g("sovepose", "sovepose"), g("telt", "telt")]);
    const labels = out.map((s) => s.group);
    expect(labels.indexOf("Sovegrej")).toBeLessThan(labels.indexOf("Telte & ly"));
    expect(out.find((s) => s.group === "Sovegrej")!.guides.map((x) => x.slug)).toContain("sovepose");
    expect(out.find((s) => s.group === "Værktøj & udstyr")!.guides.map((x) => x.slug)).toContain("kniv");
  });
  it("udelader tomme grupper", () => {
    const out = groupGuides([g("sovepose", "sovepose")]);
    expect(out.every((s) => s.guides.length > 0)).toBe(true);
  });
  it("ukendt kategori havner i 'Andet' (falder ikke ud)", () => {
    const out = groupGuides([g("x", "ukendt-kat")]);
    expect(out.flatMap((s) => s.guides).map((x) => x.slug)).toContain("x");
  });
});

describe("relatedGuides", () => {
  const all = [
    g("sovepose", "sovepose"),
    g("sovepose-til-vinter", "sovepose", "sovepose"),
    g("liggeunderlag", "liggeunderlag"),
    g("kniv", "kniv"),
  ];
  it("variant viser parent og egen gruppe FØRST, andre grupper kun som udfyldning", () => {
    // Udelukkede før alt uden for gruppen. Det er løsnet med vilje, fordi
    // små grupper efterlod fire guider med ét enkelt link. Kontrakten er nu
    // rækkefølge frem for udelukkelse: forælder og egen gruppe først, og
    // hovedguider fra andre grupper kun hvis der er plads tilbage.
    const r = relatedGuides("sovepose-til-vinter", all).map((x) => x.slug);
    expect(r).not.toContain("sovepose-til-vinter");
    expect(r.indexOf("sovepose")).toBe(0);
    expect(r.indexOf("liggeunderlag")).toBeLessThan(r.indexOf("kniv"));
  });
  it("hovedguide viser egne varianter + søskende", () => {
    const r = relatedGuides("sovepose", all).map((x) => x.slug);
    expect(r).toContain("sovepose-til-vinter");
    expect(r).toContain("liggeunderlag");
  });
  it("cap'er antal", () => {
    expect(relatedGuides("sovepose", all, 1).length).toBeLessThanOrEqual(1);
  });

  it("giver hver kategori i brug en navngiven gruppe", () => {
    // De otte guider oprettet 10.-11. oktober indførte seks nye
    // category-værdier. Tre af dem — elektronik, hygiejne og foerstehjaelp —
    // stod ikke i HUB_GROUPS, så powerbank-, håndklæde- og
    // førstehjælps-guiderne landede i "Andet". Det er synligt som en navnløs
    // sektion og usynligt som manglende søskende-links.
    const iBrug = [
      "sovepose", "liggeunderlag", "haengekoje", "soveudstyr", "telt", "tarp",
      "pandelampe", "lygte", "vandfilter", "drikkedunk", "kogeudstyr",
      "stormkoekken", "frysetorret", "kniv", "rygsaek", "kompas", "drybag",
      "optaending", "campingstol", "myggenet", "siddeunderlag", "uldundertoj",
      "regntoj", "sokker", "fodtoj", "gamacher", "handsker", "hue",
      "elektronik", "hygiejne", "foerstehjaelp",
    ];
    const uden = iBrug.filter(
      (k) => !HUB_GROUPS.some((g) => g.categories.includes(k))
    );
    expect(uden, `kategorier uden hub-gruppe: ${uden.join(", ")}`).toEqual([]);
  });

  it("fylder op fra hovedguider når gruppen er for lille", () => {
    // Gruppen "Sikkerhed & hygiejne" har kun to medlemmer, så begge fik ét
    // enkelt link, skønt loftet er seks. Målt på de 38 guider fik syv under
    // tre links og fire kun ét — og interne links er sitets største
    // uudnyttede løftestang, så den ubrugte kapacitet er en reel udeladelse.
    const alle: HubGuide[] = [
      { slug: "haandklaede", title: "H", category: "hygiejne", intro: null, parent_slug: null },
      { slug: "foerstehjaelp", title: "F", category: "foerstehjaelp", intro: null, parent_slug: null },
      { slug: "sovepose", title: "S", category: "sovepose", intro: null, parent_slug: null },
      { slug: "telt", title: "T", category: "telt", intro: null, parent_slug: null },
      { slug: "kniv", title: "K", category: "kniv", intro: null, parent_slug: null },
      { slug: "telt-variant", title: "TV", category: "telt", intro: null, parent_slug: "telt" },
    ];
    const r = relatedGuides("haandklaede", alle, 6);
    expect(r[0].slug, "søskende i egen gruppe skal stå først").toBe("foerstehjaelp");
    expect(r.length).toBeGreaterThan(1);
    expect(r.map((x) => x.slug)).not.toContain("haandklaede");
  });

  it("fylder kun op med hovedguider, ikke med varianter", () => {
    // En variant uden relation til emnet er et dårligere link end en
    // hovedguide, og den har i forvejen sin forælder som indgang.
    const alle: HubGuide[] = [
      { slug: "haandklaede", title: "H", category: "hygiejne", intro: null, parent_slug: null },
      { slug: "sovepose", title: "S", category: "sovepose", intro: null, parent_slug: null },
      { slug: "sommersovepose", title: "SS", category: "sovepose", intro: null, parent_slug: "sovepose" },
    ];
    const r = relatedGuides("haandklaede", alle, 6).map((x) => x.slug);
    expect(r).toContain("sovepose");
    expect(r).not.toContain("sommersovepose");
  });
});

describe("relatedGuides: jævn fordeling og stabil graf", () => {
  const guide = (slug: string, category: string, parent_slug: string | null = null) => ({
    slug, category, parent_slug, title: slug, intro: null,
  });

  // "Tøj & lag-på-lag" som den ser ud paa sitet: tretten medlemmer, altsaa
  // langt over loftet paa seks.
  const TOEJ = [
    "dunjakke","fleece","gamacher","handsker","hue","regntoj","solhat",
    "uldundertoj","vandrebukser","vandresandal","vandresko","vandresokker","vandrestovler",
  ].map((s) => guide(s, s === "vandresko" || s === "vandrestovler" ? "fodtoj" : s === "vandresokker" ? "sokker" : s));

  it("giver hver guide i en stor gruppe lige mange indgaaende links", () => {
    // Maalt foer: dunjakke fik tolv, mens solhat, vandrebukser, fleece,
    // gamacher og handsker fik nul.
    const ind = new Map(TOEJ.map((g) => [g.slug, 0]));
    for (const g of TOEJ) {
      for (const r of relatedGuides(g.slug, TOEJ, 6)) ind.set(r.slug, (ind.get(r.slug) ?? 0) + 1);
    }
    const tal = [...ind.values()];
    expect(Math.min(...tal)).toBe(6);
    expect(Math.max(...tal)).toBe(6);
  });

  it("aendrer sig ikke naar listens raekkefoelge aendrer sig", () => {
    // getPublishedGuides sorterer efter updated_at faldende, saa listen
    // skifter hver gang en guide rettes. Grafen maa ikke skifte med den.
    const a = relatedGuides("solhat", TOEJ, 6).map((g) => g.slug);
    const b = relatedGuides("solhat", [...TOEJ].reverse(), 6).map((g) => g.slug);
    expect(b).toEqual(a);
  });

  it("peger stadig paa parent og egne varianter foerst", () => {
    const med = [
      guide("sovepose", "sovepose"),
      guide("sovepose-til-vinter", "sovepose", "sovepose"),
      guide("dunsovepose", "sovepose", "sovepose"),
      ...TOEJ,
    ];
    const r = relatedGuides("sovepose-til-vinter", med, 6).map((g) => g.slug);
    expect(r[0]).toBe("sovepose");
  });

  it("fylder op fra hovedguider naar gruppen er for lille", () => {
    const smaa = [
      guide("lanterne", "lygte"),
      guide("pandelampe", "pandelampe"),
      ...TOEJ,
    ];
    expect(relatedGuides("lanterne", smaa, 6)).toHaveLength(6);
  });
});
